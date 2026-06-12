import React, { useState, useEffect } from 'react';
import './App.css';

// Base backend URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// MOCK DATA for robust offline fallbacks
const MOCK_ANALYTICS = {
  summary: {
    totalRevenue: 2430.00,
    totalOrders: 12,
    totalCustomers: 5,
    lowStockAlerts: 2
  },
  statusDistribution: {
    pending: 3,
    packaged: 2,
    shipped: 4,
    delivered: 2,
    cancelled: 1
  },
  lowStockProducts: [
    { id: 6, name: 'daal', price: 120.00, stock_quantity: 10.50, reorder_level: 12.00, unit: 'kg' },
    { id: 7, name: 'bread', price: 40.00, stock_quantity: 5.00, reorder_level: 8.00, unit: 'piece' }
  ],
  popularProducts: [
    { name: 'atta', quantity: 18.0, revenue: 810.00 },
    { name: 'oil', quantity: 6.0, revenue: 900.00 },
    { name: 'milk', quantity: 8.0, revenue: 480.00 },
    { name: 'sugar', quantity: 4.0, revenue: 160.00 }
  ],
  salesTimeline: [
    { date: '2026-06-08', revenue: 350.00 },
    { date: '2026-06-09', revenue: 580.00 },
    { date: '2026-06-10', revenue: 420.00 },
    { date: '2026-06-11', revenue: 680.00 },
    { date: '2026-06-12', revenue: 400.00 }
  ]
};

const MOCK_INVENTORY = [
  { id: 1, name: 'atta', price: 45.00, stock_quantity: 100.00, reorder_level: 20.00, unit: 'kg' },
  { id: 2, name: 'oil', price: 150.00, stock_quantity: 50.00, reorder_level: 10.00, unit: 'litre' },
  { id: 3, name: 'milk', price: 60.00, stock_quantity: 40.00, reorder_level: 10.00, unit: 'litre' },
  { id: 4, name: 'sugar', price: 40.00, stock_quantity: 80.00, reorder_level: 15.00, unit: 'kg' },
  { id: 5, name: 'potato', price: 25.00, stock_quantity: 150.00, reorder_level: 30.00, unit: 'kg' },
  { id: 6, name: 'daal', price: 120.00, stock_quantity: 10.50, reorder_level: 12.00, unit: 'kg' },
  { id: 7, name: 'bread', price: 40.00, stock_quantity: 5.00, reorder_level: 8.00, unit: 'piece' }
];

const MOCK_ORDERS = [
  {
    id: 501,
    customer_phone: '919876543210',
    total_amount: 240.00,
    status: 'pending',
    created_at: '2026-06-12T10:15:30Z',
    customers: { name: 'Yuvraj', phone: '919876543210' },
    order_items: [
      { id: 1001, quantity: 2, unit_price: 45.00, products: { name: 'atta', unit: 'kg' } },
      { id: 1002, quantity: 1, unit_price: 150.00, products: { name: 'oil', unit: 'litre' } }
    ]
  },
  {
    id: 502,
    customer_phone: '918888888888',
    total_amount: 200.00,
    status: 'delivered',
    created_at: '2026-06-11T14:30:22Z',
    customers: { name: 'Aarav Sharma', phone: '918888888888' },
    order_items: [
      { id: 1003, quantity: 5, unit_price: 40.00, products: { name: 'bread', unit: 'piece' } }
    ]
  },
  {
    id: 503,
    customer_phone: '919876543210',
    total_amount: 540.00,
    status: 'shipped',
    created_at: '2026-06-11T09:12:05Z',
    customers: { name: 'Yuvraj', phone: '919876543210' },
    order_items: [
      { id: 1004, quantity: 3, unit_price: 120.00, products: { name: 'daal', unit: 'kg' } },
      { id: 1005, quantity: 3, unit_price: 60.00, products: { name: 'milk', unit: 'litre' } }
    ]
  }
];

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionMode, setConnectionMode] = useState('Checking...');

  // Modal / Form States
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    stock_quantity: '',
    reorder_level: '',
    unit: 'piece'
  });

  // Search Filters
  const [orderFilter, setOrderFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Test backend connection
      const healthRes = await fetch(`${API_URL}/health`).catch(() => null);
      
      if (healthRes && healthRes.ok) {
        setConnectionMode('Live API');
        
        // Fetch components
        const [ordersRes, inventoryRes, analyticsRes] = await Promise.all([
          fetch(`${API_URL}/orders`),
          fetch(`${API_URL}/inventory`),
          fetch(`${API_URL}/analytics`)
        ]);

        const ordersData = await ordersRes.json();
        const inventoryData = await inventoryRes.json();
        const analyticsData = await analyticsRes.json();

        setOrders(ordersData);
        setInventory(inventoryData);
        setAnalytics(analyticsData);
      } else {
        // Fallback to Mocks
        setConnectionMode('Offline Demo Mode');
        setOrders(MOCK_ORDERS);
        setInventory(MOCK_INVENTORY);
        setAnalytics(MOCK_ANALYTICS);
      }
    } catch (err) {
      console.error('Fetch error, falling back to mock details:', err);
      setConnectionMode('Offline Demo Mode');
      setOrders(MOCK_ORDERS);
      setInventory(MOCK_INVENTORY);
      setAnalytics(MOCK_ANALYTICS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update Order Status
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      if (connectionMode === 'Live API') {
        const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error('Failed to update status');
        
        // Update state
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(prev => ({ ...prev, status: newStatus }));
        }
        
        // Refresh analytics in background
        fetch(`${API_URL}/analytics`)
          .then(r => r.json())
          .then(data => setAnalytics(data));
      } else {
        // Mock state updates
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(prev => ({ ...prev, status: newStatus }));
        }
        // Update mock analytics distribution
        setAnalytics(prev => {
          const dist = { ...prev.statusDistribution };
          const oldStatus = orders.find(o => o.id === orderId)?.status;
          if (oldStatus && dist[oldStatus] > 0) dist[oldStatus]--;
          dist[newStatus] = (dist[newStatus] || 0) + 1;
          return { ...prev, statusDistribution: dist };
        });
      }
    } catch (err) {
      alert(`Error updating order status: ${err.message}`);
    }
  };

  // Add / Edit Product Submit
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        // Edit flow
        if (connectionMode === 'Live API') {
          const res = await fetch(`${API_URL}/inventory/${editingProduct.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProduct)
          });
          if (!res.ok) throw new Error('Failed to update product');
          const updated = await res.json();
          setInventory(prev => prev.map(p => p.id === editingProduct.id ? updated : p));
        } else {
          setInventory(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...newProduct, price: Number(newProduct.price), stock_quantity: Number(newProduct.stock_quantity), reorder_level: Number(newProduct.reorder_level) } : p));
        }
      } else {
        // Create flow
        if (connectionMode === 'Live API') {
          const res = await fetch(`${API_URL}/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProduct)
          });
          if (!res.ok) throw new Error('Failed to create product');
          const created = await res.json();
          setInventory(prev => [...prev, created]);
        } else {
          const created = {
            id: Date.now(),
            ...newProduct,
            price: Number(newProduct.price),
            stock_quantity: Number(newProduct.stock_quantity),
            reorder_level: Number(newProduct.reorder_level)
          };
          setInventory(prev => [...prev, created]);
        }
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setNewProduct({ name: '', price: '', stock_quantity: '', reorder_level: '', unit: 'piece' });
      
      // Refresh analytics alerts count
      if (connectionMode === 'Live API') {
        fetch(`${API_URL}/analytics`)
          .then(r => r.json())
          .then(data => setAnalytics(data));
      }
    } catch (err) {
      alert(`Error saving product: ${err.message}`);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      if (connectionMode === 'Live API') {
        const res = await fetch(`${API_URL}/inventory/${productId}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete product');
        setInventory(prev => prev.filter(p => p.id !== productId));
      } else {
        setInventory(prev => prev.filter(p => p.id !== productId));
      }
    } catch (err) {
      alert(`Error deleting product: ${err.message}`);
    }
  };

  const openEditProduct = (product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      price: product.price,
      stock_quantity: product.stock_quantity,
      reorder_level: product.reorder_level,
      unit: product.unit
    });
    setIsProductModalOpen(true);
  };

  // Extract customers list dynamically from orders
  const getCustomersList = () => {
    const list = {};
    orders.forEach(order => {
      const phone = order.customer_phone;
      const name = order.customers?.name || 'Customer';
      const date = order.created_at;
      if (!list[phone]) {
        list[phone] = {
          name,
          phone,
          totalOrders: 0,
          totalSpent: 0,
          registeredAt: date
        };
      }
      list[phone].totalOrders++;
      list[phone].totalSpent += Number(order.total_amount);
      if (new Date(date) < new Date(list[phone].registeredAt)) {
        list[phone].registeredAt = date;
      }
    });
    return Object.values(list);
  };

  const filteredOrders = orders.filter(order => {
    const statusMatch = orderFilter === 'all' || order.status === orderFilter;
    const searchString = searchQuery.toLowerCase();
    const customerName = (order.customers?.name || '').toLowerCase();
    const customerPhone = order.customer_phone || '';
    const namePhoneMatch = customerName.includes(searchString) || customerPhone.includes(searchString) || order.id.toString().includes(searchString);
    return statusMatch && namePhoneMatch;
  });

  const filteredInventory = inventory.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomers = getCustomersList().filter(customer => 
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) || customer.phone.includes(searchQuery)
  );

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand-header">
          <div className="logo-icon">🛒</div>
          <h2>ShopBot</h2>
        </div>
        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveTab('overview'); setSearchQuery(''); }}
          >
            📊 Overview
          </button>
          <button 
            className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => { setActiveTab('orders'); setSearchQuery(''); }}
          >
            📦 Orders
            {orders.filter(o => o.status === 'pending').length > 0 && (
              <span className="badge-alert">{orders.filter(o => o.status === 'pending').length}</span>
            )}
          </button>
          <button 
            className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => { setActiveTab('inventory'); setSearchQuery(''); }}
          >
            🍏 Inventory
            {inventory.filter(p => Number(p.stock_quantity) <= Number(p.reorder_level)).length > 0 && (
              <span className="badge-warning">!</span>
            )}
          </button>
          <button 
            className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => { setActiveTab('customers'); setSearchQuery(''); }}
          >
            👥 Customers
          </button>
        </nav>
        <div className="connection-status">
          <span className={`dot ${connectionMode === 'Live API' ? 'live' : 'mock'}`}></span>
          <span>{connectionMode}</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="content-container">
        <header className="content-header">
          <div>
            <h1>Dashboard</h1>
            <p className="subtitle">Welcome to the ShopBot Shop Management Control Panel</p>
          </div>
          <button className="btn btn-secondary refresh-btn" onClick={fetchData}>
            🔄 Refresh Data
          </button>
        </header>

        {loading ? (
          <div className="loader-container">
            <div className="spinner"></div>
            <p>Fetching latest shop information...</p>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && analytics && (
              <div className="tab-pane fade-in">
                {/* Stats Grid */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon revenue">₹</div>
                    <div className="stat-content">
                      <span className="stat-label">Total Revenue</span>
                      <h2 className="stat-value">₹{analytics.summary.totalRevenue.toFixed(2)}</h2>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon orders">📦</div>
                    <div className="stat-content">
                      <span className="stat-label">Total Orders</span>
                      <h2 className="stat-value">{analytics.summary.totalOrders}</h2>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon customers">👥</div>
                    <div className="stat-content">
                      <span className="stat-label">Active Customers</span>
                      <h2 className="stat-value">{analytics.summary.totalCustomers}</h2>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon alerts">🚨</div>
                    <div className="stat-content">
                      <span className="stat-label">Stock Alerts</span>
                      <h2 className="stat-value">{analytics.summary.lowStockAlerts}</h2>
                    </div>
                  </div>
                </div>

                {/* Main Overview Dashboard Split */}
                <div className="overview-split">
                  {/* Left Column: Alerts & Popular items */}
                  <div className="overview-column">
                    <div className="card">
                      <div className="card-header">
                        <h3>🚨 Stock Reorder Alerts</h3>
                      </div>
                      <div className="card-body">
                        {analytics.lowStockProducts.length === 0 ? (
                          <div className="empty-state small">
                            <span className="empty-icon">✅</span>
                            <p>All product stocks are above reorder thresholds!</p>
                          </div>
                        ) : (
                          <div className="alert-list">
                            {analytics.lowStockProducts.map(p => (
                              <div key={p.id} className="alert-item">
                                <div className="alert-details">
                                  <strong>{p.name}</strong>
                                  <span>Current: {p.stock_quantity} {p.unit} (Limit: {p.reorder_level})</span>
                                </div>
                                <button className="btn btn-sm btn-primary" onClick={() => openEditProduct(p)}>
                                  Restock
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="card margin-top">
                      <div className="card-header">
                        <h3>🔥 Popular Products</h3>
                      </div>
                      <div className="card-body">
                        {analytics.popularProducts.length === 0 ? (
                          <p className="no-data">No product sales logged yet.</p>
                        ) : (
                          <div className="popular-list">
                            {analytics.popularProducts.map((p, idx) => (
                              <div key={idx} className="popular-item">
                                <div className="popular-details">
                                  <strong>{p.name}</strong>
                                  <span>Qty Sold: {p.quantity}</span>
                                </div>
                                <div className="popular-revenue">
                                  <span>₹{p.revenue.toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Sales Trends */}
                  <div className="overview-column">
                    <div className="card fill-height">
                      <div className="card-header">
                        <h3>📈 Sales Trends & Distribution</h3>
                      </div>
                      <div className="card-body">
                        <h4>Daily Revenues</h4>
                        {analytics.salesTimeline.length === 0 ? (
                          <p className="no-data">No sales data logged.</p>
                        ) : (
                          <div className="trend-timeline">
                            {analytics.salesTimeline.map((item, idx) => (
                              <div key={idx} className="timeline-bar-row">
                                <span className="timeline-date">{item.date}</span>
                                <div className="bar-container">
                                  <div 
                                    className="timeline-bar" 
                                    style={{ width: `${Math.min(100, (item.revenue / 1000) * 100)}%` }}
                                  ></div>
                                </div>
                                <span className="timeline-amount">₹{item.revenue.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <h4 className="margin-top">Order Status Split</h4>
                        <div className="status-split-bar">
                          {Object.entries(analytics.statusDistribution).map(([status, count]) => {
                            const pct = ((count / analytics.summary.totalOrders) * 100).toFixed(0);
                            return count > 0 ? (
                              <div 
                                key={status} 
                                className={`status-split-part status-${status}`}
                                style={{ width: `${pct}%` }}
                                title={`${status}: ${count} (${pct}%)`}
                              >
                                {status.slice(0, 3)} ({count})
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ORDERS TAB */}
            {activeTab === 'orders' && (
              <div className="tab-pane fade-in">
                {/* Filters Row */}
                <div className="filters-row">
                  <div className="search-box">
                    <input 
                      type="text" 
                      placeholder="Search orders by customer or ID..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="filter-buttons">
                    {['all', 'pending', 'packaged', 'shipped', 'delivered', 'cancelled'].map(status => (
                      <button 
                        key={status}
                        className={`filter-btn ${orderFilter === status ? 'active' : ''}`}
                        onClick={() => setOrderFilter(status)}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orders List */}
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Items Qty</th>
                        <th>Total Value</th>
                        <th>Date & Time</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="no-records-cell">No matching orders found.</td>
                        </tr>
                      ) : (
                        filteredOrders.map(order => {
                          const totalItemsCount = order.order_items?.reduce((sum, item) => sum + Number(item.quantity), 0) || 0;
                          return (
                            <tr key={order.id}>
                              <td><strong>#{order.id}</strong></td>
                              <td>{order.customers?.name || 'Customer'}</td>
                              <td>{order.customer_phone}</td>
                              <td>{totalItemsCount}</td>
                              <td><strong>₹{Number(order.total_amount).toFixed(2)}</strong></td>
                              <td>{new Date(order.created_at).toLocaleString()}</td>
                              <td>
                                <span className={`status-pill status-${order.status}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td>
                                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedOrder(order)}>
                                  View Details
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* INVENTORY TAB */}
            {activeTab === 'inventory' && (
              <div className="tab-pane fade-in">
                {/* Inventory Action Row */}
                <div className="filters-row">
                  <div className="search-box">
                    <input 
                      type="text" 
                      placeholder="Search inventory products..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-primary" onClick={() => { setEditingProduct(null); setNewProduct({ name: '', price: '', stock_quantity: '', reorder_level: '', unit: 'piece' }); setIsProductModalOpen(true); }}>
                    ➕ Add Product
                  </button>
                </div>

                {/* Inventory Table */}
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Product Name</th>
                        <th>Price</th>
                        <th>Stock Available</th>
                        <th>Reorder Level</th>
                        <th>Unit</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventory.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="no-records-cell">No products found.</td>
                        </tr>
                      ) : (
                        filteredInventory.map(product => {
                          const isLowStock = Number(product.stock_quantity) <= Number(product.reorder_level);
                          return (
                            <tr key={product.id} className={isLowStock ? 'low-stock-row' : ''}>
                              <td>{product.id}</td>
                              <td><strong>{product.name}</strong></td>
                              <td>₹{Number(product.price).toFixed(2)}</td>
                              <td>
                                <span className={`stock-text ${isLowStock ? 'low-stock' : 'normal-stock'}`}>
                                  {product.stock_quantity}
                                </span>
                              </td>
                              <td>{product.reorder_level}</td>
                              <td>{product.unit}</td>
                              <td>
                                <span className={`status-pill ${isLowStock ? 'status-cancelled' : 'status-delivered'}`}>
                                  {isLowStock ? 'Low Stock' : 'Good Stock'}
                                </span>
                              </td>
                              <td>
                                <div className="action-buttons-group">
                                  <button className="btn btn-sm btn-secondary" onClick={() => openEditProduct(product)}>
                                    Edit
                                  </button>
                                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteProduct(product.id)}>
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CUSTOMERS TAB */}
            {activeTab === 'customers' && (
              <div className="tab-pane fade-in">
                <div className="filters-row">
                  <div className="search-box">
                    <input 
                      type="text" 
                      placeholder="Search customers by name or phone..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer Name</th>
                        <th>Phone Number</th>
                        <th>First Order Date</th>
                        <th>Total Orders placed</th>
                        <th>Total Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="no-records-cell">No customers found.</td>
                        </tr>
                      ) : (
                        filteredCustomers.map((customer, idx) => (
                          <tr key={idx}>
                            <td><strong>{customer.name}</strong></td>
                            <td>{customer.phone}</td>
                            <td>{new Date(customer.registeredAt).toLocaleDateString()}</td>
                            <td>{customer.totalOrders} orders</td>
                            <td><strong>₹{customer.totalSpent.toFixed(2)}</strong></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ORDER DETAIL DIALOG MODAL */}
      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Order Details - #{selectedOrder.id}</h2>
              <button className="close-btn" onClick={() => setSelectedOrder(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="info-grid">
                <div>
                  <h4>Customer Info</h4>
                  <p><strong>Name:</strong> {selectedOrder.customers?.name || 'Customer'}</p>
                  <p><strong>Phone:</strong> {selectedOrder.customer_phone}</p>
                </div>
                <div>
                  <h4>Order Summary</h4>
                  <p><strong>Date:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</p>
                  <p><strong>Total:</strong> ₹{Number(selectedOrder.total_amount).toFixed(2)}</p>
                </div>
                <div>
                  <h4>Order Status</h4>
                  <span className={`status-pill status-${selectedOrder.status}`}>
                    {selectedOrder.status}
                  </span>
                </div>
              </div>

              <h4>Items Ordered</h4>
              <table className="detail-items-table">
                <thead>
                  <tr>
                    <th>Product Item</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.order_items?.map((item, idx) => (
                    <tr key={idx}>
                      <td><strong>{item.products?.name || 'Unknown Item'}</strong></td>
                      <td>₹{Number(item.unit_price).toFixed(2)}</td>
                      <td>{item.quantity} {item.products?.unit || 'piece'}</td>
                      <td>₹{(Number(item.unit_price) * Number(item.quantity)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="status-management">
                <h4>Pipeline Control Action:</h4>
                <div className="pipeline-controls">
                  <button 
                    className="btn btn-secondary status-pending-btn" 
                    disabled={selectedOrder.status === 'pending'}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'pending')}
                  >
                    Set Pending
                  </button>
                  <button 
                    className="btn btn-secondary status-packaged-btn" 
                    disabled={selectedOrder.status === 'packaged'}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'packaged')}
                  >
                    Set Packaged
                  </button>
                  <button 
                    className="btn btn-secondary status-shipped-btn" 
                    disabled={selectedOrder.status === 'shipped'}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'shipped')}
                  >
                    Set Shipped
                  </button>
                  <button 
                    className="btn btn-success status-delivered-btn" 
                    disabled={selectedOrder.status === 'delivered'}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'delivered')}
                  >
                    Set Delivered
                  </button>
                  <button 
                    className="btn btn-danger status-cancelled-btn" 
                    disabled={selectedOrder.status === 'cancelled'}
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                  >
                    Cancel Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT DIALOG MODAL */}
      {isProductModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsProductModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? 'Edit Product details' : 'Add New Product'}</h2>
              <button className="close-btn" onClick={() => setIsProductModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleProductSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Product Name</label>
                  <input 
                    type="text" 
                    required 
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="e.g. bread"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Price (₹)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      placeholder="e.g. 40.00"
                    />
                  </div>
                  <div className="form-group">
                    <label>Unit of Measure</label>
                    <select 
                      value={newProduct.unit}
                      onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                    >
                      <option value="piece">piece</option>
                      <option value="packet">packet</option>
                      <option value="kg">kg</option>
                      <option value="gm">gm</option>
                      <option value="litre">litre</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Current Stock</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      required 
                      value={newProduct.stock_quantity}
                      onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
                      placeholder="e.g. 100"
                    />
                  </div>
                  <div className="form-group">
                    <label>Reorder Limit</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      required 
                      value={newProduct.reorder_level}
                      onChange={(e) => setNewProduct({ ...newProduct, reorder_level: e.target.value })}
                      placeholder="e.g. 15"
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsProductModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
