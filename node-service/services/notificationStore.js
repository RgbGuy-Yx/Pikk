const notifications = [];
let nextId = 1;

function addNotification(type, message, product) {
  const notification = {
    id: nextId++,
    type,
    message,
    product: product || null,
    read: false,
    createdAt: Date.now(),
  };

  notifications.push(notification);

  if (notifications.length > 100) {
    notifications.splice(0, notifications.length - 100);
  }

  return notification;
}

function getNotifications() {
  return [...notifications].sort((a, b) => b.createdAt - a.createdAt);
}

function getUnreadCount() {
  return notifications.filter(n => !n.read).length;
}

function markRead(id) {
  const notification = notifications.find(n => n.id === id);
  if (notification) notification.read = true;
  return notification;
}

function removeNotification(id) {
  const idx = notifications.findIndex(n => n.id === id);
  if (idx === -1) return false;
  notifications.splice(idx, 1);
  return true;
}

function removeRead() {
  let count = 0;
  for (let i = notifications.length - 1; i >= 0; i--) {
    if (notifications[i].read) {
      notifications.splice(i, 1);
      count++;
    }
  }
  return count;
}

module.exports = {
  addNotification,
  getNotifications,
  getUnreadCount,
  markRead,
  removeNotification,
  removeRead,
};
