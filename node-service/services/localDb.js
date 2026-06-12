const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

// Default Seed Data
const DEFAULT_DATA = {
  products: [
    { id: 1, name: 'atta', price: 45.00, stock_quantity: 100.00, reorder_level: 20.00, unit: 'kg' },
    { id: 2, name: 'oil', price: 150.00, stock_quantity: 50.00, reorder_level: 10.00, unit: 'litre' },
    { id: 3, name: 'milk', price: 60.00, stock_quantity: 40.00, reorder_level: 10.00, unit: 'litre' },
    { id: 4, name: 'sugar', price: 40.00, stock_quantity: 80.00, reorder_level: 15.00, unit: 'kg' },
    { id: 5, name: 'potato', price: 25.00, stock_quantity: 150.00, reorder_level: 30.00, unit: 'kg' },
    { id: 6, name: 'daal', price: 120.00, stock_quantity: 10.50, reorder_level: 12.00, unit: 'kg' },
    { id: 7, name: 'bread', price: 40.00, stock_quantity: 5.00, reorder_level: 8.00, unit: 'piece' }
  ],
  customers: [
    { id: 101, phone: '919876543210', name: 'Yuvraj' }
  ],
  orders: [],
  order_items: []
};

// Initialize JSON files if they don't exist
function initDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  Object.entries(DEFAULT_DATA).forEach(([tableName, defaultRows]) => {
    const filePath = path.join(DATA_DIR, `${tableName}.json`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultRows, null, 2), 'utf8');
      console.log(`[LocalDB] Created table file: ${tableName}.json`);
    }
  });
}

// Read table rows
function readTable(tableName) {
  initDb();
  const filePath = path.join(DATA_DIR, `${tableName}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`[LocalDB] Error reading table ${tableName}:`, err.message);
    return [];
  }
}

// Write table rows
function writeTable(tableName, data) {
  initDb();
  const filePath = path.join(DATA_DIR, `${tableName}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[LocalDB] Error writing table ${tableName}:`, err.message);
  }
}

class LocalQueryBuilder {
  constructor(tableName) {
    this.tableName = tableName;
    this.filters = [];
    this.sortField = null;
    this.sortAscending = true;
    this.isSingle = false;
    this.isMaybeSingle = false;
    this.insertData = null;
    this.updateData = null;
    this.isDelete = false;
    this.selectColumns = '*';
  }

  select(columns = '*') {
    this.selectColumns = columns;
    return this;
  }

  eq(field, value) {
    this.filters.push(item => item[field] === value);
    return this;
  }

  ilike(field, pattern) {
    const searchStr = pattern.replace(/%/g, '').toLowerCase();
    this.filters.push(item => (item[field] || '').toLowerCase().includes(searchStr));
    return this;
  }

  order(field, options = {}) {
    this.sortField = field;
    this.sortAscending = options.ascending !== false;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(records) {
    this.insertData = records;
    return this;
  }

  update(fields) {
    this.updateData = fields;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  async then(onFulfilled) {
    try {
      let data = readTable(this.tableName);

      // 1. Handle INSERT
      if (this.insertData) {
        const records = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        const newRecords = records.map(rec => {
          let newId = rec.id || Math.floor(Math.random() * 900000) + 100000;
          if (data.length > 0 && !rec.id) {
            newId = Math.max(...data.map(d => d.id || 0)) + 1;
          }
          return { id: newId, created_at: new Date().toISOString(), ...rec };
        });

        data.push(...newRecords);
        writeTable(this.tableName, data);

        let dataOutput = Array.isArray(this.insertData) ? newRecords : newRecords[0];
        return onFulfilled({ data: dataOutput, error: null });
      }

      // 2. Handle UPDATE
      if (this.updateData) {
        let matchedIndices = [];
        data.forEach((item, index) => {
          let match = true;
          for (const filter of this.filters) {
            if (!filter(item)) {
              match = false;
              break;
            }
          }
          if (match) matchedIndices.push(index);
        });

        matchedIndices.forEach(idx => {
          data[idx] = { ...data[idx], ...this.updateData };
        });

        writeTable(this.tableName, data);
        const updatedItems = matchedIndices.map(idx => data[idx]);
        let dataOutput = this.isSingle ? (updatedItems[0] || null) : updatedItems;
        return onFulfilled({ data: dataOutput, error: null });
      }

      // 3. Handle DELETE
      if (this.isDelete) {
        const remaining = data.filter(item => {
          let match = true;
          for (const filter of this.filters) {
            if (!filter(item)) {
              match = false;
              break;
            }
          }
          return !match;
        });

        writeTable(this.tableName, remaining);
        return onFulfilled({ data: [], error: null });
      }

      // 4. Handle SELECT (Read queries)
      let result = [...data];
      for (const filter of this.filters) {
        result = result.filter(filter);
      }

      if (this.sortField) {
        result.sort((a, b) => {
          let valA = a[this.sortField];
          let valB = b[this.sortField];
          if (typeof valA === 'string') {
            return this.sortAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return this.sortAscending ? valA - valB : valB - valA;
        });
      }

      // Nested Joins emulation
      if (this.tableName === 'orders') {
        const customers = readTable('customers');
        const orderItems = readTable('order_items');
        const products = readTable('products');

        result = result.map(order => {
          const cust = customers.find(c => c.phone === order.customer_phone);
          const items = orderItems
            .filter(item => Number(item.order_id) === Number(order.id))
            .map(item => {
              const prod = products.find(p => Number(p.id) === Number(item.product_id));
              return { ...item, products: prod };
            });
          return { ...order, customers: cust, order_items: items };
        });
      } else if (this.tableName === 'order_items') {
        const products = readTable('products');
        result = result.map(item => {
          const prod = products.find(p => Number(p.id) === Number(item.product_id));
          return { ...item, products: prod };
        });
      }

      let dataOutput = result;
      if (this.isSingle) {
        dataOutput = result[0] || null;
      } else if (this.isMaybeSingle) {
        dataOutput = result[0] || null;
      }

      return onFulfilled({ data: dataOutput, count: result.length, error: null });
    } catch (err) {
      console.error('[LocalDB Query Error]:', err.message);
      return onFulfilled({ data: null, error: err });
    }
  }
}

// Main Client Interface Mocking Supabase Client
const localDbClient = {
  from(tableName) {
    return new LocalQueryBuilder(tableName);
  }
};

module.exports = {
  localDbClient,
  initDb
};
