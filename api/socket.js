const Session = require('./models/session.model')
const { resolveUserFromToken } = require('./services/auth.service')
const chatService = require('./services/chat.service')
const redLight = require('./services/redLight.service')
const workspace = require('./services/workspace.service')
const workspaceVoice = require('./services/workspaceVoice.service')
const werewolf = require('./services/werewolf.service')
const jungle = require('./services/jungle.service')
const { saveStrokeToRedis, getBoardData, clearBoardInRedis, appendPointToStroke, undoStrokeInRedis } = require('./redis')
const { getAllowedOrigins } = require('./utils/cors')

let io;

const initSocket = (server) => {
  io = require('socket.io')(server, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ["GET", "POST"],
      credentials: true,
      transports: ['websocket', 'polling']
    }
  });

  io.on('connection', (socket) => {
    require('./sockets/secretShift.socket')(socket)
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
        const { content, token, clientMessageId, imageUrl } = data

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
          imageUrl,
          clientMessageId,
        })

        if (message.deduplicated) return

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

    // Workspace 2.5D: presence tạm thời, danh tính luôn lấy từ token.
    socket.on('workspace:join', async (data = {}) => {
      try {
        const user = await resolveUserFromToken(data.token)
        if (!user) {
          socket.emit('workspace:error', { message: 'Vui lòng đăng nhập để vào workspace' })
          return
        }
        if (workspace.getMember(socket.id)) await workspaceVoice.leave(socket.id)
        workspace.join({ socket, user, position: data.position })
      } catch (error) {
        console.error('[Workspace] Không thể tham gia:', error.message)
        socket.emit('workspace:error', { message: 'Không thể kết nối workspace' })
      }
    })

    socket.on('workspace:move', (data = {}, ack) => {
      const before = workspace.getMember(socket.id)?.roomId
      const moved = workspace.move({ socket, position: data })
      if (typeof ack === 'function' && moved) ack(moved)
      if (moved && before !== moved.roomId) workspaceVoice.onRoomChange(socket).catch((error) => console.error('[Workspace voice] Lỗi đổi phòng:', error.message))
    })

    socket.on('workspace:voice:join', async (ack) => {
      try {
        const result = await workspaceVoice.join(socket)
        if (typeof ack === 'function') ack(result)
      } catch (error) {
        console.error('[Workspace voice] Không thể cấp phiên:', error.message)
        if (typeof ack === 'function') ack({ error: 'Không thể kết nối voice', code: 'LIVEKIT_UNAVAILABLE' })
      }
    })

    socket.on('workspace:voice:leave', async (ack) => {
      await workspaceVoice.leave(socket.id)
      if (typeof ack === 'function') ack({ ok: true })
    })

    socket.on('workspace:voice:sync', () => {
      workspaceVoice.syncWerewolfPermissions().catch((error) => console.error('[Workspace voice] Không thể đồng bộ quyền Ma Sói:', error.message))
    })

    socket.on('workspace:chat', (data = {}) => {
      const result = workspace.chat({ socket, content: data.content })
      if (result.error) {
        socket.emit('workspace:error', { message: result.error })
        return
      }
      io.to(workspace.ROOM).emit('workspace:chat', result.message)
    })

    socket.on('workspace:leave', () => {
      workspaceVoice.leave(socket.id).catch((error) => console.error('[Workspace voice] Lỗi rời phòng:', error.message))
      workspace.leave(socket)
    })

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

    for (const action of ['watch', 'unwatch']) socket.on(`table_game:${action}`, (data = {}) => {
      if (typeof data.game !== 'string' || !Object.hasOwn(require('./services/tableGame').services, data.game)) return
      if (action === 'watch') socket.join(`table_game:watch:${data.game}`)
      else socket.leave(`table_game:watch:${data.game}`)
    })
    let tableGameBindSequence = 0
    socket.on('table_game:bind', async (data = {}) => {
      const sequence = ++tableGameBindSequence
      try {
        const user = await resolveUserFromToken(data.token)
        if (sequence !== tableGameBindSequence || !socket.connected) return
        for (const room of socket.rooms) if (room.startsWith('table_game:user:')) socket.leave(room)
        if (user) socket.join(`table_game:user:${user._id}`)
        for (const service of Object.values(require('./services/tableGame').services)) service.bindSocket({ user, socketId: socket.id })
      } catch (error) {
        if (sequence === tableGameBindSequence) {
          for (const room of socket.rooms) if (room.startsWith('table_game:user:')) socket.leave(room)
          for (const service of Object.values(require('./services/tableGame').services)) service.onSocketDisconnect(socket.id)
        }
        console.error('[TableGame] Bind failed:', error.message)
      }
    })

    socket.on('redlight:bind', async (data = {}) => {
      try {
        const user = await resolveUserFromToken(data.token)
        if (!user) return
        redLight.bindSocket({ user, socketId: socket.id })
      } catch (error) {
        console.error('[Đèn xanh] Bind socket lỗi:', error.message)
      }
    })

    socket.on('redlight:input', async (data = {}) => {
      try {
        const user = await resolveUserFromToken(data.token)
        if (!user) return
        redLight.bindSocket({ user, socketId: socket.id })
        redLight.setHold({
          userId: user._id,
          holding: Boolean(data.holding),
          socketId: socket.id,
        })
      } catch (error) {
        console.error('[Đèn xanh] Input lỗi:', error.message)
      }
    })

    // Ma Sói: token tuỳ chọn — khách vẫn xem được, nhưng chỉ nhận bản state công khai
    socket.on('werewolf:watch', async (data = {}) => {
      try {
        const user = data.token ? await resolveUserFromToken(data.token) : null
        werewolf.watch(socket, user)
      } catch (error) {
        console.error('[Ma Sói] Watch lỗi:', error.message)
      }
    })

    socket.on('werewolf:unwatch', () => werewolf.unwatch(socket))

    // Cờ thú: ai cũng xem được; token chỉ để server biết người chơi còn kết nối.
    socket.on('jungle:watch', async (data = {}) => {
      try {
        if (!data.gameId) return
        const user = data.token ? await resolveUserFromToken(data.token) : null
        await jungle.watchGame(socket, String(data.gameId), user)
      } catch (error) {
        socket.emit('jungle_error', { message: error.message })
      }
    })
    socket.on('jungle:unwatch', () => jungle.unwatchGame(socket))
    socket.on('jungle:lobby:watch', () => {
      jungle.watchLobby(socket).catch((error) => console.error('[Cờ thú] Sảnh lỗi:', error.message))
    })
    socket.on('jungle:lobby:unwatch', () => jungle.unwatchLobby(socket))

    socket.on('disconnect', () => {
      tableGameBindSequence++
      for (const service of Object.values(require('./services/tableGame').services)) service.onSocketDisconnect(socket.id)
      console.log('Client disconnected', socket.id);
      workspace.leave(socket)
      workspaceVoice.leave(socket.id).catch((error) => console.error('[Workspace voice] Lỗi ngắt kết nối:', error.message))
      redLight.onSocketDisconnect(socket.id)
      werewolf.onSocketGone(socket)
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
