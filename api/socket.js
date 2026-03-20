const User = require('./models/user.model')
const Message = require('./models/message.model')
const Session = require('./models/session.model')
const { saveStrokeToRedis, getBoardData, clearBoardInRedis, appendPointToStroke, undoStrokeInRedis } = require('./redis')

let io;

const initSocket = (server) => {
  io = require('socket.io')(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
      transports: ['websocket', 'polling']
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('chat_message', async (data) => {
      try {
        const { content, username } = data;
        
        // Tìm active session
        const activeSession = await Session.findOne({ isActive: true });
        if (!activeSession) {
          return;
        }

        // Tìm hoặc tạo user với color
        let user = await User.findOne({ username });
        if (!user) {
          user = await User.create({
            username,
            sessionId: activeSession._id
          });
        }

        // Lưu tin nhắn
        const message = await Message.create({
          content,
          userId: user._id,
          sessionId: activeSession._id
        });

        // Populate user info và emit message
        await message.populate('userId', 'username color');
        io.emit('new_message', {
          content: message.content,
          username: message.userId.username,
          color: message.userId.color,
          createdAt: message.createdAt
        });
      } catch (error) {
        console.error('Chat error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });

    // Whiteboard (PoliBoard) real-time handlers
    socket.on('join-room', async (roomId) => {
      socket.join(roomId);
      socket.poliboardRoom = roomId; // Track room for disconnects
      
      // Fetch existing board data and send to the joining user
      const existingStrokes = await getBoardData(roomId);
      socket.emit('init-board', existingStrokes);
    });

    socket.on('leave-room', (roomId) => {
      socket.leave(roomId);
    });

    socket.on('draw:start', (payload) => {
      if (payload && payload.room && payload.data) {
        saveStrokeToRedis(payload.room, payload.data);
        socket.to(payload.room).emit('draw:start', payload);
      }
    });

    // Optimized: only relay the new point, not the whole stroke
    socket.on('draw:move', (payload) => {
      if (payload && payload.room && payload.data && payload.data.strokeId && payload.data.point) {
        // Append point to Redis stroke (fire-and-forget for speed)
        appendPointToStroke(payload.room, payload.data.strokeId, payload.data.point);
        socket.to(payload.room).emit('draw:move', payload);
      }
    });

    socket.on('draw:end', (payload) => {
      if (payload && payload.room && payload.data && payload.data.id) {
        // Save the simplified stroke (overwriting the raw collected points)
        saveStrokeToRedis(payload.room, payload.data);
        // Relay to other clients so they can replace their track memory too
        socket.to(payload.room).emit('draw:end', payload);
      }
    });

    socket.on('clear-board', async (payload) => {
      if (payload && payload.room) {
        await clearBoardInRedis(payload.room);
        socket.to(payload.room).emit('clear-board', payload);
      }
    });

    socket.on('undo-stroke', async (payload) => {
      if (payload && payload.room && payload.data && payload.data.strokeId) {
        await undoStrokeInRedis(payload.room, payload.data.strokeId);
        socket.to(payload.room).emit('undo-stroke', payload);
      }
    });

    socket.on('cursor:move', (payload) => {
      if (payload && payload.room && payload.data) {
        socket.to(payload.room).emit('cursor:move', { ...payload.data, id: socket.id });
      }
    });

    socket.on('cursor:leave', (payload) => {
      if (payload && payload.room) {
        socket.to(payload.room).emit('cursor:leave', { id: socket.id });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected', socket.id);
      if (socket.poliboardRoom) {
        // Notify others to remove this cursor
        socket.to(socket.poliboardRoom).emit('cursor:remove', { id: socket.id });
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = {
  initSocket,
  getIO
}; 