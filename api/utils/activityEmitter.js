const emitActivity = (io, payload) => {
  if (!io) return;

  io.emit('activity_event', {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...payload,
  });
};

module.exports = { emitActivity };
