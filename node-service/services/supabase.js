const { createClient } = require('@supabase/supabase-js');
const dns = require('dns');
const { localDbClient, initDb } = require('./localDb');

let useLocalDb = false;

// Check if Supabase host is resolvable at startup
function checkSupabaseHost(supabaseUrl) {
  try {
    const url = new URL(supabaseUrl);
    dns.lookup(url.hostname, (err) => {
      if (err) {
        console.warn(`\n====================================================================`);
        console.warn(`⚠️  [Supabase] DNS lookup failed for host "${url.hostname}": ${err.message}`);
        console.warn(`👉  [Supabase] ENOTFOUND / Offline mode detected.`);
        console.warn(`🔌  [Supabase] FALLING BACK to Local JSON File Database!`);
        console.warn(`====================================================================\n`);
        useLocalDb = true;
        // Make sure data folder and json files are initialized
        initDb();
      } else {
        console.log(`[Supabase] Host "${url.hostname}" resolved successfully. Connected to cloud database.`);
      }
    });
  } catch (e) {
    console.error('[Supabase] Invalid URL configured:', supabaseUrl);
    useLocalDb = true;
    initDb();
  }
}

function createSupabaseClient() {
  let supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (process.env.USE_LOCAL_DB === 'true') {
    console.log('[Supabase] Local JSON database forced via environment.');
    initDb();
    return localDbClient;
  }

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Supabase] Missing credentials. Falling back to local database.');
    initDb();
    return localDbClient;
  }

  // Handle accidental inclusion of /rest/v1/ path in SUPABASE_URL
  if (supabaseUrl.endsWith('/rest/v1/')) {
    supabaseUrl = supabaseUrl.substring(0, supabaseUrl.length - 9);
  } else if (supabaseUrl.endsWith('/rest/v1')) {
    supabaseUrl = supabaseUrl.substring(0, supabaseUrl.length - 8);
  }

  // Start connection check
  checkSupabaseHost(supabaseUrl);

  const realClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Return a proxy wrapper that swaps between realClient and localDbClient
  return new Proxy(realClient, {
    get(target, prop) {
      if (useLocalDb) {
        return localDbClient[prop];
      }
      return target[prop];
    }
  });
}

module.exports = {
  createSupabaseClient,
};
