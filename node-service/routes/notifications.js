const express = require('express');
const store = require('../services/notificationStore');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    notifications: store.getNotifications(),
    unreadCount: store.getUnreadCount(),
  });
});

router.post('/', (req, res) => {
  const { type, message, product } = req.body;

  if (!type || !message) {
    return res.status(400).json({ error: 'type and message are required' });
  }

  const notification = store.addNotification(type, message, product);
  res.status(201).json(notification);
});

router.put('/:id/read', (req, res) => {
  const notification = store.markRead(Number(req.params.id));
  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  res.json(notification);
});

router.delete('/read', (req, res) => {
  const deleted = store.removeRead();
  res.json({ deleted });
});

router.delete('/:id', (req, res) => {
  const success = store.removeNotification(Number(req.params.id));
  if (!success) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  res.json({ success: true });
});

module.exports = router;
