const express = require('express');
const { createSupabaseClient } = require('../services/supabase');

const router = express.Router();
const supabase = createSupabaseClient();

// Get all products
router.get('/', async (req, res, next) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Database unavailable' });
    }
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Create a new product
router.post('/', async (req, res, next) => {
  try {
    const { name, price, stock_quantity, reorder_level, unit } = req.body;
    
    if (!name || price === undefined || stock_quantity === undefined) {
      return res.status(400).json({ error: 'Name, price and stock_quantity are required' });
    }

    if (!supabase) {
      return res.status(500).json({ error: 'Database unavailable' });
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        name,
        price: Number(price),
        stock_quantity: Number(stock_quantity),
        reorder_level: reorder_level !== undefined ? Number(reorder_level) : 10.0,
        unit: unit || 'piece'
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// Update a product
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, price, stock_quantity, reorder_level, unit } = req.body;

    if (!supabase) {
      return res.status(500).json({ error: 'Database unavailable' });
    }

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (price !== undefined) updateFields.price = Number(price);
    if (stock_quantity !== undefined) updateFields.stock_quantity = Number(stock_quantity);
    if (reorder_level !== undefined) updateFields.reorder_level = Number(reorder_level);
    if (unit !== undefined) updateFields.unit = unit;

    const { data, error } = await supabase
      .from('products')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Delete a product
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(500).json({ error: 'Database unavailable' });
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: `Product ${id} deleted` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
