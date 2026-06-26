import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Users, RefreshCw,
  Search, Plus, Pencil, Trash2, X, AlertTriangle, TrendingUp,
  IndianRupee, Boxes, UserCheck, Bell, ChevronRight, PackageCheck,
  Truck, CircleCheck, CircleX, Clock, PackageOpen, Loader2, ArrowUpRight,
  CircleAlert
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const MOCK_ANALYTICS = {
  summary: { totalRevenue: 2430.00, totalOrders: 12, totalCustomers: 5, lowStockAlerts: 2 },
  statusDistribution: { pending: 3, packaged: 2, shipped: 4, delivered: 2, cancelled: 1 },
  lowStockProducts: [
    { id: 6, name: 'daal', price: 120, stock_quantity: 10.5, reorder_level: 12, unit: 'kg' },
    { id: 7, name: 'bread', price: 40, stock_quantity: 5, reorder_level: 8, unit: 'piece' }
  ],
  popularProducts: [
    { name: 'atta', quantity: 18, revenue: 810 },
    { name: 'oil', quantity: 6, revenue: 900 },
    { name: 'milk', quantity: 8, revenue: 480 },
    { name: 'sugar', quantity: 4, revenue: 160 }
  ],
  salesTimeline: [
    { date: '2026-06-08', revenue: 350 }, { date: '2026-06-09', revenue: 580 },
    { date: '2026-06-10', revenue: 420 }, { date: '2026-06-11', revenue: 680 },
    { date: '2026-06-12', revenue: 400 }
  ]
};

const MOCK_INVENTORY = [
  { id: 1, name: 'atta', price: 45, stock_quantity: 100, reorder_level: 20, unit: 'kg' },
  { id: 2, name: 'oil', price: 150, stock_quantity: 50, reorder_level: 10, unit: 'litre' },
  { id: 3, name: 'milk', price: 60, stock_quantity: 40, reorder_level: 10, unit: 'litre' },
  { id: 4, name: 'sugar', price: 40, stock_quantity: 80, reorder_level: 15, unit: 'kg' },
  { id: 5, name: 'potato', price: 25, stock_quantity: 150, reorder_level: 30, unit: 'kg' },
  { id: 6, name: 'daal', price: 120, stock_quantity: 10.5, reorder_level: 12, unit: 'kg' },
  { id: 7, name: 'bread', price: 40, stock_quantity: 5, reorder_level: 8, unit: 'piece' }
];

const MOCK_ORDERS = [
  { id: 501, customer_phone: '919876543210', total_amount: 240, status: 'pending', created_at: '2026-06-12T10:15:30Z', customers: { name: 'Yuvraj', phone: '919876543210' }, order_items: [{ quantity: 2, unit_price: 45, products: { name: 'atta', unit: 'kg' } }, { quantity: 1, unit_price: 150, products: { name: 'oil', unit: 'litre' } }] },
  { id: 502, customer_phone: '918888888888', total_amount: 200, status: 'delivered', created_at: '2026-06-11T14:30:22Z', customers: { name: 'Aarav Sharma', phone: '918888888888' }, order_items: [{ quantity: 5, unit_price: 40, products: { name: 'bread', unit: 'piece' } }] },
  { id: 503, customer_phone: '919876543210', total_amount: 540, status: 'shipped', created_at: '2026-06-11T09:12:05Z', customers: { name: 'Yuvraj', phone: '919876543210' }, order_items: [{ quantity: 3, unit_price: 120, products: { name: 'daal', unit: 'kg' } }, { quantity: 3, unit_price: 60, products: { name: 'milk', unit: 'litre' } }] }
];

const STATUS_CONFIG = {
  pending: { icon: Clock, color: '#f5a623', label: 'Pending' },
  packaged: { icon: PackageOpen, color: '#7928ca', label: 'Packaged' },
  shipped: { icon: Truck, color: '#0070f3', label: 'Shipped' },
  delivered: { icon: CircleCheck, color: '#50e3c2', label: 'Delivered' },
  cancelled: { icon: CircleX, color: '#ee0000', label: 'Cancelled' },
};

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionMode, setConnectionMode] = useState('Checking...');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock_quantity: '', reorder_level: '', unit: 'piece' });
  const [orderFilter, setOrderFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_URL}/notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // Notifications unavailable in offline mode
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await fetch(`${API_URL}/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Ignore errors
    }
  };

  const clearReadNotifications = async () => {
    try {
      await fetch(`${API_URL}/notifications/read`, { method: 'DELETE' });
      setNotifications(prev => prev.filter(n => !n.read));
    } catch {
      // Ignore errors
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const healthRes = await fetch(`${API_URL}/health`).catch(() => null);
      if (healthRes && healthRes.ok) {
        setConnectionMode('Live');
        const [ordersRes, inventoryRes, analyticsRes] = await Promise.all([
          fetch(`${API_URL}/orders`), fetch(`${API_URL}/inventory`), fetch(`${API_URL}/analytics`)
        ]);
        setOrders(await ordersRes.json());
        setInventory(await inventoryRes.json());
        setAnalytics(await analyticsRes.json());
        fetchNotifications();
      } else {
        setConnectionMode('Offline');
        setOrders(MOCK_ORDERS); setInventory(MOCK_INVENTORY); setAnalytics(MOCK_ANALYTICS);
      }
    } catch {
      setConnectionMode('Offline');
      setOrders(MOCK_ORDERS); setInventory(MOCK_INVENTORY); setAnalytics(MOCK_ANALYTICS);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e) => {
      if (!e.target.closest('.notification-wrapper')) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      if (connectionMode === 'Live') {
        const res = await fetch(`${API_URL}/orders/${orderId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
        if (!res.ok) throw new Error('Failed');
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder(prev => ({ ...prev, status: newStatus }));
      if (connectionMode === 'Live') fetch(`${API_URL}/analytics`).then(r => r.json()).then(setAnalytics);
    } catch (err) { alert(`Error: ${err.message}`); }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        if (connectionMode === 'Live') {
          const res = await fetch(`${API_URL}/inventory/${editingProduct.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProduct) });
          if (!res.ok) throw new Error('Failed');
          const updated = await res.json();
          setInventory(prev => prev.map(p => p.id === editingProduct.id ? updated : p));
        } else {
          setInventory(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...newProduct, price: Number(newProduct.price), stock_quantity: Number(newProduct.stock_quantity), reorder_level: Number(newProduct.reorder_level) } : p));
        }
      } else {
        if (connectionMode === 'Live') {
          const res = await fetch(`${API_URL}/inventory`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newProduct) });
          if (!res.ok) throw new Error('Failed');
          const created = await res.json();
          setInventory(prev => [...prev, created]);
        } else {
          setInventory(prev => [...prev, { id: Date.now(), ...newProduct, price: Number(newProduct.price), stock_quantity: Number(newProduct.stock_quantity), reorder_level: Number(newProduct.reorder_level) }]);
        }
      }
      setIsProductModalOpen(false); setEditingProduct(null);
      setNewProduct({ name: '', price: '', stock_quantity: '', reorder_level: '', unit: 'piece' });
    } catch (err) { alert(`Error: ${err.message}`); }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;
    if (connectionMode === 'Live') await fetch(`${API_URL}/inventory/${id}`, { method: 'DELETE' });
    setInventory(prev => prev.filter(p => p.id !== id));
  };

  const getCustomersList = () => {
    const list = {};
    orders.forEach(o => {
      const p = o.customer_phone, n = o.customers?.name || 'Customer';
      if (!list[p]) list[p] = { name: n, phone: p, totalOrders: 0, totalSpent: 0, firstOrder: o.created_at };
      list[p].totalOrders++; list[p].totalSpent += Number(o.total_amount);
      if (new Date(o.created_at) < new Date(list[p].firstOrder)) list[p].firstOrder = o.created_at;
    });
    return Object.values(list);
  };

  const filteredOrders = orders.filter(o => {
    const statusMatch = orderFilter === 'all' || o.status === orderFilter;
    const q = searchQuery.toLowerCase();
    return statusMatch && ((o.customers?.name || '').toLowerCase().includes(q) || (o.customer_phone || '').includes(q) || String(o.id).includes(q));
  });

  const filteredInventory = inventory.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredCustomers = getCustomersList().filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery));

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const lowStockCount = inventory.filter(p => Number(p.stock_quantity) <= Number(p.reorder_level)).length;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: Package, badge: pendingCount },
    { id: 'inventory', label: 'Inventory', icon: Boxes, badge: lowStockCount, badgeType: 'warning' },
    { id: 'customers', label: 'Customers', icon: Users },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon"><ShoppingCart size={16} /></div>
          <span className="brand-name">pikk</span>
        </div>
        <nav className="sidebar-nav">
          {tabs.map(item => (
            <button
              key={item.id}
              className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.id); setSearchQuery(''); }}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
              {item.badge > 0 && <span className={`nav-badge ${item.badgeType || ''}`}>{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className={`conn-dot ${connectionMode === 'Live' ? 'live' : ''}`} />
          <span>{connectionMode}</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1 className="page-title">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
          <div className="topbar-actions">
            <div className="notification-wrapper">
              <button className="btn-icon" onClick={() => setShowNotifications(prev => !prev)} title="Notifications">
                <Bell size={14} />
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="notif-panel">
                  <div className="notif-header">
                    <span className="notif-title">Notifications</span>
                    {notifications.some(n => n.read) && (
                      <button className="notif-clear" onClick={clearReadNotifications}>Clear read</button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <div className="notif-empty">No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`notif-item ${n.read ? '' : 'unread'} ${n.type}`}
                          onClick={() => !n.read && markNotificationRead(n.id)}
                        >
                          <div className="notif-icon">
                            {n.type === 'out_of_stock' && <CircleX size={14} />}
                            {n.type === 'low_stock' && <AlertTriangle size={14} />}
                            {n.type === 'order_alert' && <CircleAlert size={14} />}
                          </div>
                          <div className="notif-content">
                            <span className="notif-msg">{n.message}</span>
                            <span className="notif-time">{new Date(n.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button className="btn-icon" onClick={fetchData} title="Refresh"><RefreshCw size={14} /></button>
          </div>
        </header>

        {loading ? (
          <div className="loader"><Loader2 size={24} className="spin" /><span>Loading…</span></div>
        ) : (
          <div className="content">
            {activeTab === 'overview' && analytics && (
              <OverviewTab
                analytics={analytics}
                inventory={inventory}
                openEditProduct={(p) => {
                  setEditingProduct(p);
                  setNewProduct({ name: p.name, price: p.price, stock_quantity: p.stock_quantity, reorder_level: p.reorder_level, unit: p.unit });
                  setIsProductModalOpen(true);
                }}
              />
            )}
            {activeTab === 'orders' && (
              <>
                <div className="toolbar">
                  <div className="search"><Search size={14} /><input placeholder="Search orders…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
                  <div className="pills">
                    {['all', 'pending', 'packaged', 'shipped', 'delivered', 'cancelled'].map(s => (
                      <button key={s} className={`pill ${orderFilter === s ? 'active' : ''}`} onClick={() => setOrderFilter(s)}>{s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}</button>
                    ))}
                  </div>
                </div>
                <div className="table-card">
                  <table>
                    <thead><tr><th>ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Date</th><th>Status</th><th /></tr></thead>
                    <tbody>
                      {filteredOrders.length === 0 ? <tr><td colSpan={7} className="empty">No orders found</td></tr> : filteredOrders.map(o => {
                        const items = o.order_items?.reduce((s, i) => s + Number(i.quantity), 0) || 0;
                        const St = STATUS_CONFIG[o.status]?.icon || Clock;
                        return (
                          <tr key={o.id} onClick={() => setSelectedOrder(o)} className="clickable">
                            <td className="mono">#{o.id}</td>
                            <td>{o.customers?.name || 'Customer'}</td>
                            <td>{items}</td>
                            <td className="mono">{'\u20B9'}{Number(o.total_amount).toFixed(0)}</td>
                            <td className="muted">{new Date(o.created_at).toLocaleDateString()}</td>
                            <td><span className="status" style={{ color: STATUS_CONFIG[o.status]?.color, background: STATUS_CONFIG[o.status]?.color + '14' }}><St size={12} />{STATUS_CONFIG[o.status]?.label}</span></td>
                            <td><ChevronRight size={14} className="muted" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {activeTab === 'inventory' && (
              <>
                <div className="toolbar">
                  <div className="search"><Search size={14} /><input placeholder="Search products…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
                  <button className="btn-primary" onClick={() => { setEditingProduct(null); setNewProduct({ name: '', price: '', stock_quantity: '', reorder_level: '', unit: 'piece' }); setIsProductModalOpen(true); }}><Plus size={14} />Add Product</button>
                </div>
                <div className="table-card">
                  <table>
                    <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Reorder</th><th>Unit</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredInventory.length === 0 ? <tr><td colSpan={7} className="empty">No products found</td></tr> : filteredInventory.map(p => {
                        const low = Number(p.stock_quantity) <= Number(p.reorder_level);
                        return (
                          <tr key={p.id} className={low ? 'low-stock' : ''}>
                            <td className="fw-500">{p.name}</td>
                            <td className="mono">{'\u20B9'}{Number(p.price).toFixed(0)}</td>
                            <td className={low ? 'text-danger' : 'text-success'}>{p.stock_quantity}</td>
                            <td className="muted">{p.reorder_level}</td>
                            <td className="mono">{p.unit}</td>
                            <td>{low ? <span className="status" style={{ color: '#ee0000', background: '#ee000014' }}><AlertTriangle size={12} />Low</span> : <span className="status" style={{ color: '#0070f3', background: '#0070f314' }}><CircleCheck size={12} />OK</span>}</td>
                            <td>
                              <div className="row-actions">
                                <button className="btn-icon-sm" onClick={() => { setEditingProduct(p); setNewProduct({ name: p.name, price: p.price, stock_quantity: p.stock_quantity, reorder_level: p.reorder_level, unit: p.unit }); setIsProductModalOpen(true); }}><Pencil size={14} /></button>
                                <button className="btn-icon-sm danger" onClick={() => handleDeleteProduct(p.id)}><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {activeTab === 'customers' && (
              <>
                <div className="toolbar"><div className="search"><Search size={14} /><input placeholder="Search customers…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div></div>
                <div className="table-card">
                  <table>
                    <thead><tr><th>Name</th><th>Phone</th><th>First Order</th><th>Orders</th><th>Spent</th></tr></thead>
                    <tbody>
                      {filteredCustomers.length === 0 ? <tr><td colSpan={5} className="empty">No customers found</td></tr> : filteredCustomers.map((c, i) => (
                        <tr key={i}><td className="fw-500">{c.name}</td><td className="mono">{c.phone}</td><td className="muted">{new Date(c.firstOrder).toLocaleDateString()}</td><td>{c.totalOrders}</td><td className="mono">{'\u20B9'}{c.totalSpent.toFixed(0)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {selectedOrder && <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onUpdateStatus={handleUpdateStatus} />}
      {isProductModalOpen && <ProductModal product={editingProduct} newProduct={newProduct} setNewProduct={setNewProduct} onSubmit={handleProductSubmit} onClose={() => { setIsProductModalOpen(false); setEditingProduct(null); }} />}
    </div>
  );
}

const DONUT_COLORS = {
  pending: '#f5a623',
  packaged: '#7928ca',
  shipped: '#0070f3',
  delivered: '#50e3c2',
  cancelled: '#ee0000',
};

function ChartTooltip({ active, payload, label, prefix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span className="chart-tooltip-label">{label}</span>
      <span className="chart-tooltip-value">{prefix}{payload[0].value.toLocaleString()}</span>
    </div>
  );
}

function OverviewTab({ analytics, inventory, openEditProduct }) {
  const salesData = analytics.salesTimeline.map(d => ({
    date: d.date.slice(5),
    revenue: d.revenue,
  }));

  const statusData = Object.entries(analytics.statusDistribution)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: STATUS_CONFIG[key]?.label || key,
      value,
      color: DONUT_COLORS[key] || '#888',
    }));

  const totalOrders = statusData.reduce((s, d) => s + d.value, 0);

  const productData = analytics.popularProducts.map(p => ({
    name: p.name,
    revenue: p.revenue,
    quantity: p.quantity,
  }));

  const inventoryHealth = inventory.map(p => ({
    name: p.name,
    stock: Number(p.stock_quantity),
    reorder: Number(p.reorder_level),
    isLow: Number(p.stock_quantity) <= Number(p.reorder_level),
  }));

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="stat-icon green"><IndianRupee size={18} /></div>
          <div><span className="stat-label">Revenue</span><span className="stat-value">{'₹'}{analytics.summary.totalRevenue.toFixed(0)}</span></div>
        </div>
        <div className="stat">
          <div className="stat-icon blue"><ShoppingCart size={18} /></div>
          <div><span className="stat-label">Orders</span><span className="stat-value">{analytics.summary.totalOrders}</span></div>
        </div>
        <div className="stat">
          <div className="stat-icon purple"><UserCheck size={18} /></div>
          <div><span className="stat-label">Customers</span><span className="stat-value">{analytics.summary.totalCustomers}</span></div>
        </div>
        <div className="stat">
          <div className="stat-icon red"><Bell size={18} /></div>
          <div><span className="stat-label">Low Stock</span><span className="stat-value">{analytics.summary.lowStockAlerts}</span></div>
        </div>
      </div>

      {/* ─── Row 1: Sales Area Chart + Order Status Donut ─── */}
      <div className="grid-2">
        <div className="card">
          <h3 className="card-title"><TrendingUp size={14} />Sales Timeline</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={salesData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#171717" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#171717" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eaeaea" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#999', fontFamily: "'JetBrains Mono', monospace" }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#999', fontFamily: "'JetBrains Mono', monospace" }}
                  tickFormatter={v => `₹${v}`}
                  dx={-4}
                />
                <Tooltip content={<ChartTooltip prefix="₹" />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#171717"
                  strokeWidth={2}
                  fill="url(#salesGradient)"
                  dot={{ r: 3, fill: '#171717', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#171717', strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title"><Package size={14} />Order Status</h3>
          <div className="donut-wrapper">
            <div className="donut-chart">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={76}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="chart-tooltip">
                          <span className="chart-tooltip-label">{payload[0].name}</span>
                          <span className="chart-tooltip-value">{payload[0].value} orders</span>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <span className="donut-total">{totalOrders}</span>
                <span className="donut-label">total</span>
              </div>
            </div>
            <div className="donut-legend">
              {statusData.map((d, i) => (
                <div key={i} className="legend-item">
                  <span className="legend-dot" style={{ background: d.color }} />
                  <span className="legend-name">{d.name}</span>
                  <span className="legend-value">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Row 2: Top Products Bar Chart + Inventory Health ─── */}
      <div className="grid-2">
        <div className="card">
          <h3 className="card-title"><TrendingUp size={14} />Top Products</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={productData} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#007cf0" />
                    <stop offset="50%" stopColor="#7928ca" />
                    <stop offset="100%" stopColor="#ff0080" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eaeaea" horizontal={false} />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#999', fontFamily: "'JetBrains Mono', monospace" }}
                  tickFormatter={v => `₹${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#171717', fontWeight: 500 }}
                  width={48}
                />
                <Tooltip content={<ChartTooltip prefix="₹" />} />
                <Bar
                  dataKey="revenue"
                  fill="url(#barGradient)"
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title"><Boxes size={14} />Inventory Health</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={inventoryHealth} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eaeaea" horizontal={false} />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#999', fontFamily: "'JetBrains Mono', monospace" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#171717', fontWeight: 500 }}
                  width={48}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="chart-tooltip">
                        <span className="chart-tooltip-label">{label}</span>
                        {payload.map((p, i) => (
                          <span key={i} className="chart-tooltip-value" style={{ color: p.color }}>
                            {p.name === 'stock' ? 'Stock' : 'Reorder'}: {p.value}
                          </span>
                        ))}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="stock" fill="#171717" radius={[0, 4, 4, 0]} barSize={10} name="stock" />
                <Bar dataKey="reorder" fill="#eaeaea" radius={[0, 4, 4, 0]} barSize={10} name="reorder" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── Low Stock Alerts ─── */}
      {analytics.lowStockProducts.length > 0 && (
        <div className="card">
          <h3 className="card-title"><AlertTriangle size={14} />Low Stock Alerts</h3>
          <div className="list">
            {analytics.lowStockProducts.map(p => (
              <div key={p.id} className="list-row alert-row">
                <span className="fw-500" style={{ flex: 1 }}>{p.name}</span>
                <span className="text-danger mono">{p.stock_quantity} {p.unit}</span>
                <span className="muted">reorder at {p.reorder_level}</span>
                <button className="btn-sm" onClick={() => openEditProduct(p)}>Restock</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function OrderModal({ order, onClose, onUpdateStatus }) {
  const steps = ['pending', 'packaged', 'shipped', 'delivered'];
  const currentIdx = steps.indexOf(order.status === 'cancelled' ? '' : order.status);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h2>Order #{order.id}</h2><button className="btn-icon" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="info-row"><span className="muted">Customer</span><span>{order.customers?.name || 'Customer'}</span></div>
          <div className="info-row"><span className="muted">Phone</span><span className="mono">{order.customer_phone}</span></div>
          <div className="info-row"><span className="muted">Date</span><span>{new Date(order.created_at).toLocaleString()}</span></div>
          <div className="info-row"><span className="muted">Total</span><span className="mono fw-500">{'\u20B9'}{Number(order.total_amount).toFixed(2)}</span></div>

          {order.status !== 'cancelled' && currentIdx >= 0 && (
            <div className="progress">
              {steps.map((s, i) => (
                <div key={s} className={`prog-step ${i <= currentIdx ? 'done' : ''}`}>
                  <div className="prog-dot" />
                  <span>{STATUS_CONFIG[s]?.label}</span>
                </div>
              ))}
            </div>
          )}

          <h4 className="section-title">Items</h4>
          <div className="items-list">
            {order.order_items?.map((item, i) => (
              <div key={i} className="item-row">
                <span style={{ flex: 1 }}>{item.products?.name}</span>
                <span className="muted">{item.quantity} {item.products?.unit}</span>
                <span className="mono">{'\u20B9'}{(Number(item.unit_price) * Number(item.quantity)).toFixed(0)}</span>
              </div>
            ))}
          </div>

          <h4 className="section-title">Update Status</h4>
          <div className="status-btns">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button key={key} className={`status-btn ${order.status === key ? 'current' : ''}`} disabled={order.status === key} onClick={() => onUpdateStatus(order.id, key)}>
                <cfg.icon size={12} />{cfg.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductModal({ product, newProduct, setNewProduct, onSubmit, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal sm" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h2>{product ? 'Edit Product' : 'Add Product'}</h2><button className="btn-icon" onClick={onClose}><X size={16} /></button></div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            <label className="field"><span>Name</span><input required value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="e.g. atta" /></label>
            <div className="field-row">
              <label className="field"><span>Price</span><input type="number" step="0.01" required value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="45" /></label>
              <label className="field"><span>Unit</span><select value={newProduct.unit} onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}><option value="piece">piece</option><option value="packet">packet</option><option value="kg">kg</option><option value="gm">gm</option><option value="litre">litre</option></select></label>
            </div>
            <div className="field-row">
              <label className="field"><span>Stock</span><input type="number" step="0.1" required value={newProduct.stock_quantity} onChange={e => setNewProduct({ ...newProduct, stock_quantity: e.target.value })} placeholder="100" /></label>
              <label className="field"><span>Reorder Level</span><input type="number" step="0.1" required value={newProduct.reorder_level} onChange={e => setNewProduct({ ...newProduct, reorder_level: e.target.value })} placeholder="20" /></label>
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">{product ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
