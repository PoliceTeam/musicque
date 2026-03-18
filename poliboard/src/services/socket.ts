import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  return import.meta.env.VITE_SOCKET_URL || 
         (typeof window !== 'undefined' && (window as any).__SOCKET_URL__) || 
         'http://localhost:5001';
};

class SocketService {
  private socket: Socket | null = null;
  private currentRoom: string | null = null;

  connect() {
    if (!this.socket) {
      const url = getSocketUrl();
      this.socket = io(url as string, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }
  }

  joinRoom(roomId: string) {
    if (this.socket) {
      if (this.currentRoom && this.currentRoom !== roomId) {
        this.socket.emit('leave-room', this.currentRoom);
      }
      this.currentRoom = roomId;
      this.socket.emit('join-room', roomId);
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  emit(event: string, ...args: any[]) {
    if (this.socket && this.currentRoom) {
      // automatically append room id to payload if needed, or backend handles it via socket.to(room)
      this.socket.emit(event, { room: this.currentRoom, data: args[0] });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentRoom = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
