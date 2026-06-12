const express = require('express');
const { createSupabaseClient } = require('../services/supabase');

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

// Update order status
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

    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
