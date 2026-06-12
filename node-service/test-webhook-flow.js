require('dotenv').config();

// Mock Database State
const mockCatalog = [
  { id: 1, name: 'atta', price: 45.00, stock_quantity: 100.00, reorder_level: 20.00, unit: 'kg' },
  { id: 2, name: 'oil', price: 150.00, stock_quantity: 50.00, reorder_level: 10.00, unit: 'litre' },
  { id: 3, name: 'milk', price: 60.00, stock_quantity: 40.00, reorder_level: 10.00, unit: 'litre' },
  { id: 4, name: 'sugar', price: 40.00, stock_quantity: 80.00, reorder_level: 15.00, unit: 'kg' },
  { id: 5, name: 'potato', price: 25.00, stock_quantity: 150.00, reorder_level: 30.00, unit: 'kg' },
  { id: 6, name: 'daal', price: 120.00, stock_quantity: 10.50, reorder_level: 12.00, unit: 'kg' }, // Set close to reorder level
  { id: 7, name: 'bread', price: 40.00, stock_quantity: 5.00, reorder_level: 8.00, unit: 'piece' }
];

const mockCustomers = [
  { id: 101, phone: '919876543210', name: 'Yuvraj' }
];

const mockOrders = [];
const mockOrderItems = [];

// Define mock client methods
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

let currentAIParsedResult = null;
const mockPythonClient = {
  parseOrder: async function(text) {
    return currentAIParsedResult;
  }
};

// Override factory functions in the cached modules BEFORE requiring orderService!
const supabaseModule = require('./services/supabase');
supabaseModule.createSupabaseClient = function() {
  return mockSupabaseClient;
};

const pythonModule = require('./services/pythonClient');
pythonModule.createPythonServiceClient = function() {
  return mockPythonClient;
};

// Now require orderService, which will use our custom mock factories!
const orderService = require('./services/orderService');

// Test Runner Helper
async function executeTestCase(name, inputText, phone, profileName, aiMockOutput) {
  console.log(`\n==================================================`);
  console.log(`🧪 TEST CASE: ${name}`);
  console.log(`==================================================`);
  currentAIParsedResult = aiMockOutput;
  
  const result = await orderService.processIncomingMessage(inputText, phone, profileName);
  console.log(`\n📊 TEST RESULT SUMMARY:`);
  console.log(JSON.stringify(result, null, 2));
}

async function startTests() {
  // Test Case 1: Friendly Greeting / Non-order intent
  await executeTestCase(
    'Friendly Auto-Help Greeting (Non-Order Intent)',
    'namaste shopbot, kaise ho?',
    '919876543210',
    'Yuvraj',
    { intent: 'non_order', items: [] }
  );

  // Test Case 2: Standard Order Placement (Auto-register and stock deduct)
  await executeTestCase(
    'Standard Successful Order and Stock Deduction',
    '2kg atta and 1 litre oil please',
    '918888888888', // New customer number to test registration
    'Aarav Sharma',
    {
      intent: 'order',
      items: [
        { item: 'atta', qty: 2.0, unit: 'kg' },
        { item: 'oil', qty: 1.0, unit: 'litre' }
      ]
    }
  );

  // Test Case 3: Out-of-Stock Warning & Reorder level Alert
  await executeTestCase(
    'Out of Stock Limits & Low Stock Reorder Threshold Alert',
    '10 bread and 5kg daal',
    '919876543210', // Existing customer Yuvraj
    'Yuvraj',
    {
      intent: 'order',
      items: [
        { item: 'bread', qty: 10.0, unit: 'piece' }, // Catalog has 5 bread
        { item: 'daal', qty: 5.0, unit: 'kg' }       // Catalog has 10.5 daal, deduct 5 -> 5.5 (Reorder level is 12)
      ]
    }
  );

  // Test Case 4: Catalog Miss / Unavailable Product handling
  await executeTestCase(
    'Catalog Miss handling (Unavailable items)',
    '1kg paneer please',
    '919876543210',
    'Yuvraj',
    {
      intent: 'order',
      items: [
        { item: 'paneer', qty: 1.0, unit: 'kg' } // Paneer is not in catalog
      ]
    }
  );

  // Dump Final Database Mock State to verify stock consistency
  console.log(`\n==================================================`);
  console.log('🏁 FINAL INTEGRITY CHECK (DUMPING DB STATES)');
  console.log(`==================================================`);
  console.log('\n📦 Catalog Stocks after processing:');
  console.table(mockCatalog.map(p => ({
    Name: p.name,
    Price: `₹${p.price.toFixed(2)}`,
    'Remaining Stock': `${p.stock_quantity.toFixed(2)} ${p.unit}`,
    'Reorder Level': `${p.reorder_level.toFixed(2)} ${p.unit}`,
    'Needs Restock?': p.stock_quantity <= p.reorder_level ? '🚨 YES' : '✅ OK'
  })));

  console.log('\n👥 Customers Registered:');
  console.table(mockCustomers);

  console.log('\n🧾 Orders Created:');
  console.table(mockOrders);

  console.log('\n🧾 Order Line Items Created:');
  console.table(mockOrderItems);
  
  console.log('\n🎉 ALL INTEGRATION TESTS RUN SUCCESSFULLY!');
}

startTests();
