const express = require('express');
const { createSupabaseClient } = require('../services/supabase');
const { sendWhatsAppMessage } = require('../services/whatsapp');

const router = express.Router();
const supabase = createSupabaseClient();

// Get all orders with customer details and line items
router.get('/', async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database unavailable' });
    }
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers(name, phone),
        order_items(
          *,
          products(*)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Update order status and notify customer
router.put('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database unavailable' });
    }

    // Fetch order with customer info before updating
    const { data: order } = await supabase
      .from('orders')
      .select('*, customers(name, phone)')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Notify customer via WhatsApp
    if (order?.customers?.phone) {
      const phone = order.customers.phone;
      const name = order.customers.name || 'there';
      const orderId = order.id;

      const messages = {
        pending: `Hi ${name}! Your order #${orderId} has been received and is pending.`,
        confirmed: `Hi ${name}! Your order #${orderId} has been confirmed. We're preparing it now.`,
        packaged: `Hi ${name}! Your order #${orderId} has been packaged and is ready for delivery.`,
        shipped: `Hi ${name}! Your order #${orderId} has been shipped and is on its way to you.`,
        delivered: `Hi ${name}! Your order #${orderId} has been delivered. Thank you for shopping with us!`,
        cancelled: `Hi ${name}, your order #${orderId} has been cancelled. Please contact us if you have any questions.`,
      };

      const msg = messages[status];
      if (msg) {
        await sendWhatsAppMessage(phone, msg);
      }
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
