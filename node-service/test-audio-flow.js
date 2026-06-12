require('dotenv').config();
const axios = require('axios');

// Mock Database State
const mockCatalog = [
  { id: 1, name: 'atta', price: 45.00, stock_quantity: 100.00, reorder_level: 20.00, unit: 'kg' },
  { id: 2, name: 'oil', price: 150.00, stock_quantity: 50.00, reorder_level: 10.00, unit: 'litre' },
  { id: 3, name: 'milk', price: 60.00, stock_quantity: 40.00, reorder_level: 10.00, unit: 'litre' },
  { id: 4, name: 'sugar', price: 40.00, stock_quantity: 80.00, reorder_level: 15.00, unit: 'kg' },
  { id: 5, name: 'potato', price: 25.00, stock_quantity: 150.00, reorder_level: 30.00, unit: 'kg' },
  { id: 6, name: 'daal', price: 120.00, stock_quantity: 10.50, reorder_level: 12.00, unit: 'kg' },
  { id: 7, name: 'bread', price: 40.00, stock_quantity: 5.00, reorder_level: 8.00, unit: 'piece' }
];

const mockCustomers = [
  { id: 101, phone: '919876543210', name: 'Yuvraj' }
];

const mockOrders = [];
const mockOrderItems = [];

// Define mock Supabase Client methods
const mockSupabaseClient = {
  from: function(tableName) {
    return {
      select: function(columns) {
        return {
          eq: function(field, value) {
            return {
              maybeSingle: async function() {
                if (tableName === 'customers' && field === 'phone') {
                  const found = mockCustomers.find(c => c.phone === value);
                  return { data: found || null, error: null };
                }
                return { data: null, error: null };
              },
              single: async function() {
                if (tableName === 'customers' && field === 'phone') {
                  const found = mockCustomers.find(c => c.phone === value);
                  return { data: found || null, error: null };
                }
                return { data: null, error: null };
              }
            };
          },
          ilike: function(field, pattern) {
            return {
              then: async function(resolve) {
                if (tableName === 'products' && field === 'name') {
                  const searchStr = pattern.replace(/%/g, '').toLowerCase();
                  const matched = mockCatalog.filter(p => p.name.includes(searchStr));
                  resolve({ data: matched, error: null });
                } else {
                  resolve({ data: [], error: null });
                }
              }
            };
          }
        };
      },
      insert: function(records) {
        return {
          select: function() {
            return {
              single: async function() {
                if (tableName === 'customers') {
                  const newCustomer = { id: mockCustomers.length + 101, ...records };
                  mockCustomers.push(newCustomer);
                  return { data: newCustomer, error: null };
                }
                if (tableName === 'orders') {
                  const newOrder = { id: mockOrders.length + 501, ...records };
                  mockOrders.push(newOrder);
                  return { data: newOrder, error: null };
                }
                return { data: records, error: null };
              }
            };
          },
          then: async function(resolve) {
            if (tableName === 'order_items') {
              const items = Array.isArray(records) ? records : [records];
              items.forEach((item, idx) => {
                mockOrderItems.push({ id: mockOrderItems.length + 1001 + idx, ...item });
              });
              resolve({ error: null });
            } else {
              resolve({ error: null });
            }
          }
        };
      },
      update: function(updateObj) {
        return {
          eq: function(field, value) {
            return {
              then: async function(resolve) {
                if (tableName === 'products' && field === 'id') {
                  const index = mockCatalog.findIndex(p => p.id === value);
                  if (index !== -1) {
                    mockCatalog[index] = { ...mockCatalog[index], ...updateObj };
                  }
                }
                resolve({ error: null });
              }
            };
          }
        };
      }
    };
  }
};

// Override Supabase client factory
const supabaseModule = require('./services/supabase');
supabaseModule.createSupabaseClient = function() {
  return mockSupabaseClient;
};

// Start the Node app on a test port
const app = require('./server');
const PORT = 3005;

let server;

function startNodeServer() {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`[TestRunner] Node test service listening on port ${PORT}`);
      resolve();
    });
  });
}

function stopNodeServer() {
  if (server) {
    server.close();
    console.log('[TestRunner] Node test service stopped.');
  }
}

async function runTests() {
  await startNodeServer();

  try {
    // Test Case 1: Simple JSON Webhook request with text (sanity check)
    console.log('\n--- 🧪 TEST 1: Text Webhook Intent ---');
    const textRes = await axios.post(`http://localhost:${PORT}/webhook`, {
      text: '2kg atta and 1 litre oil please',
      phone: '919876543210',
      name: 'Yuvraj'
    });
    console.log('Test 1 HTTP Response Code:', textRes.status);
    console.log('Test 1 Body:', JSON.stringify(textRes.data, null, 2));

    // Test Case 2: Simple JSON Webhook request with audio_id
    console.log('\n--- 🧪 TEST 2: Audio Webhook (Mock/Fallback Transcript) ---');
    const audioRes = await axios.post(`http://localhost:${PORT}/webhook`, {
      audio_id: 'mock_audio_test_default',
      phone: '918888888888',
      name: 'Aarav Sharma'
    });
    console.log('Test 2 HTTP Response Code:', audioRes.status);
    console.log('Test 2 Body:', JSON.stringify(audioRes.data, null, 2));

    // Test Case 3: Simple JSON Webhook request with audio_id triggering another mock path
    console.log('\n--- 🧪 TEST 3: Audio Webhook (Greeting/Non-order Transcript) ---');
    const audioGreetingRes = await axios.post(`http://localhost:${PORT}/webhook`, {
      audio_id: 'mock_audio_greeting',
      phone: '919876543210',
      name: 'Yuvraj'
    });
    console.log('Test 3 HTTP Response Code:', audioGreetingRes.status);
    console.log('Test 3 Body:', JSON.stringify(audioGreetingRes.data, null, 2));

    // Test Case 4: Audio Webhook mimicking Meta structure
    console.log('\n--- 🧪 TEST 4: Meta WhatsApp Webhook Payload structure ---');
    const metaAudioRes = await axios.post(`http://localhost:${PORT}/webhook`, {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                contacts: [
                  {
                    profile: { name: 'Karan Singh' },
                    wa_id: '917777777777'
                  }
                ],
                messages: [
                  {
                    from: '917777777777',
                    id: 'wamid.HBgLOT...',
                    type: 'audio',
                    audio: {
                      mime_type: 'audio/ogg; codecs=opus',
                      id: 'mock_bread_and_daal'
                    }
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    });
    console.log('Test 4 HTTP Response Code:', metaAudioRes.status);
    console.log('Test 4 Body:', JSON.stringify(metaAudioRes.data, null, 2));

    // Verify Catalog State
    console.log('\n📦 Final Catalog Stocks:');
    console.table(mockCatalog.map(p => ({
      Name: p.name,
      Price: `₹${p.price.toFixed(2)}`,
      'Remaining Stock': `${p.stock_quantity.toFixed(2)} ${p.unit}`
    })));

    console.log('\n🧾 Orders Logged:');
    console.table(mockOrders);

    console.log('\n🎉 ALL AUDIO WORKFLOW TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test execution failed:', err.response?.data || err.message);
  } finally {
    stopNodeServer();
  }
}

// Run the suite!
runTests();
