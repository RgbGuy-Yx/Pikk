function isOwnerCommand(input) {
  return typeof input === 'string' && input.trim().startsWith('/');
}

function listOwnerCommands() {
  return ['status', 'inventory', 'orders'];
}

module.exports = {
  isOwnerCommand,
  listOwnerCommands,
};
