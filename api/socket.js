const User = require('./models/user.model')
const Message = require('./models/message.model')
const Session = require('./models/session.model')

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
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

module.exports = {
  initSocket,
  getIO
}; 