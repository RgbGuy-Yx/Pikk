require('dotenv').config();

const express = require('express');
const cors = require('cors');

const webhookRoutes = require('./routes/webhook');
const ordersRoutes = require('./routes/orders');
const inventoryRoutes = require('./routes/inventory');
const analyticsRoutes = require('./routes/analytics');
const { createSupabaseClient } = require('./services/supabase');

const app = express();
const port = Number(process.env.PORT) || 3001;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.locals.supabase = createSupabaseClient();

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'node-service',
  });
});

app.use('/webhook', webhookRoutes);
app.use('/orders', ordersRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/analytics', analyticsRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal Server Error',
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Node service listening on port ${port}`);
  });
}

module.exports = app;
