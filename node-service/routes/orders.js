const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    route: 'orders',
    status: 'ready',
  });
});

router.post('/', (req, res) => {
  res.json({
    accepted: true,
    payload: req.body || {},
  });
});

module.exports = router;
