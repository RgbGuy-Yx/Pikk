const express = require('express');
const { createSupabaseClient } = require('../services/supabase');

const router = express.Router();
const supabase = createSupabaseClient();

// Get analytics overview
router.get('/', async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database unavailable' });
    }

    // 1. Fetch all orders (to compute revenue, statuses, and history)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*');

    if (ordersError) throw ordersError;

    // 2. Fetch all customers (to compute total customers count)
    const { count: customersCount, error: customersError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    if (customersError) throw customersError;

    // 3. Fetch products where stock is below or equal to reorder level
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*');

    if (productsError) throw productsError;

    // 4. Fetch order items with product names to compute popular items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*, products(*)');

    if (itemsError) throw itemsError;

    // Compute Metrics
    let totalRevenue = 0;
    let totalOrders = orders.length;
    const statusCounts = {};
    const salesOverTime = {};

    orders.forEach(order => {
      // Add status count
      statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;

      // Exclude cancelled orders from revenue
      if (order.status !== 'cancelled') {
        totalRevenue += Number(order.total_amount);
      }

      // Group sales by day
      const dateKey = new Date(order.created_at).toISOString().split('T')[0];
      salesOverTime[dateKey] = (salesOverTime[dateKey] || 0) + Number(order.total_amount);
    });

    // Low stock items
    const lowStockProducts = products.filter(
      p => Number(p.stock_quantity) <= Number(p.reorder_level)
    );

    // Popular items aggregation
    const itemSales = {};
    orderItems.forEach(item => {
      const pName = item.products?.name || 'Unknown';
      if (!itemSales[pName]) {
        itemSales[pName] = {
          name: pName,
          quantity: 0,
          revenue: 0,
        };
      }
      itemSales[pName].quantity += Number(item.quantity);
      itemSales[pName].revenue += Number(item.quantity) * Number(item.unit_price);
    });

    const popularProducts = Object.values(itemSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Format salesOverTime to an array for easier rendering
    const salesTimeline = Object.keys(salesOverTime)
      .sort()
      .map(date => ({
        date,
        revenue: salesOverTime[date],
      }));

    res.json({
      summary: {
        totalRevenue,
        totalOrders,
        totalCustomers: customersCount || 0,
        lowStockAlerts: lowStockProducts.length,
      },
      statusDistribution: statusCounts,
      lowStockProducts,
      popularProducts,
      salesTimeline,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
