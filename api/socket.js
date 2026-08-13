const Session = require('./models/session.model')
const { resolveUserFromToken } = require('./services/auth.service')
const chatService = require('./services/chat.service')
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

    socket.on('chat:join', async (data = {}) => {
      try {
        const sessionId = data.sessionId
        if (!sessionId) return

        const room = chatService.getRoomName(sessionId)
        socket.join(room)
        socket.chatRoom = room
        socket.emit('chat:joined', { sessionId, room })
      } catch (error) {
        socket.emit('chat:error', { message: error.message || 'Không vào được phòng chat' })
      }
    })

    socket.on('chat:leave', (data = {}) => {
      const sessionId = data.sessionId
      const room = sessionId ? chatService.getRoomName(sessionId) : socket.chatRoom
      if (!room) return

      socket.leave(room)
      if (socket.chatRoom === room) socket.chatRoom = null
    })

    const handleChatMessage = async (data = {}) => {
      try {
        const { content, token } = data

        // Danh tính lấy từ token, không nhận username tự khai từ client
        const user = await resolveUserFromToken(token)
        if (!user) {
          socket.emit('chat:error', { message: 'Vui lòng đăng nhập để chat' })
          socket.emit('chat_error', { message: 'Vui lòng đăng nhập để chat' })
          return
        }

        const sessionId = data.sessionId || (await Session.findOne({ isActive: true }))?._id
        if (!sessionId) {
          socket.emit('chat:error', { message: 'Chưa có phiên phát nhạc để chat' })
          return
        }

        const message = await chatService.createSessionMessage({
          sessionId,
          user,
          content,
        })

        const room = chatService.getRoomName(message.sessionId)
        socket.join(room)
        socket.chatRoom = room

        io.to(room).emit('chat:message', message)
        io.to(room).emit('new_message', message)
      } catch (error) {
        console.error('Chat error:', error)
        socket.emit('chat:error', { message: error.message || 'Không gửi được tin nhắn' })
      }
    }

    socket.on('chat:message', handleChatMessage)
    socket.on('chat_message', handleChatMessage)

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
