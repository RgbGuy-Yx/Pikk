const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Determine tenant ID from SUPABASE_URL
let tenant = 'tiiglaoqgjjouzojkspp';
const urlStr = process.env.SUPABASE_URL || '';
const match = urlStr.match(/https:\/\/([^.]+)\.supabase/);
if (match) {
  tenant = match[1];
}

const password = process.env.DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;

if (!password) {
  console.error('\n❌ ERROR: DB_PASSWORD is not set!');
  console.log('To set up the database tables, please:');
  console.log('1. Open your Supabase Dashboard -> Project Settings -> Database');
  console.log('2. Copy your Database Password.');
  console.log('3. Add it to node-service/.env: DB_PASSWORD="your_password"');
  console.log('4. Run: node setup-db.js\n');
  process.exit(1);
}

// Method 1: Direct connection on port 5432 (requires IPv6)
const directConfig = {
  host: `db.${tenant}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
};

// Method 2: Connection Pooler on port 6543 (supports IPv4)
const poolerConfig = {
  host: 'aws-0-ap-south-1.pooler.supabase.com', // Standard Mumbai pooler for Indian clients
  port: 6543,
  user: `postgres.${tenant}`,
  password: password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
};

async function executeMigration(client, sqlPath) {
  console.log(`Reading schema from ${sqlPath}...`);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('Executing schema migration...');
  // Split statements by semicolon to run them cleanly
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
    
  for (let statement of statements) {
    // Basic formatting for logging
    const firstLine = statement.split('\n')[0].trim();
    console.log(`Running: "${firstLine}..."`);
    await client.query(statement);
  }
  console.log('✅ Database migrated successfully!');
}

async function run() {
  const sqlPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ Error: schema.sql not found at ${sqlPath}`);
    process.exit(1);
  }

  let client;
  
  // Try Direct IPv6 Connection First
  try {
    console.log(`Attempting direct IPv6 connection to db.${tenant}.supabase.co...`);
    client = new Client(directConfig);
    await client.connect();
    console.log('🔌 Connected directly via IPv6!');
    await executeMigration(client, sqlPath);
    await client.end();
    process.exit(0);
  } catch (error) {
    console.log(`⚠️ Direct connection failed: ${error.message}`);
    console.log('🔄 Retrying via IPv4 Connection Pooler (PgBouncer)...');
  }

  // Fallback to Connection Pooler
  try {
    client = new Client(poolerConfig);
    await client.connect();
    console.log('🔌 Connected via IPv4 Connection Pooler!');
    await executeMigration(client, sqlPath);
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: Could not connect to database using either direct or pooler connection.`);
    console.error('Details:', error.message);
    console.log('\n💡 Please check:');
    console.log('1. That your database password is correct in the .env file.');
    console.log('2. That your Supabase database is active (not paused).');
    process.exit(1);
  }
}

run();
