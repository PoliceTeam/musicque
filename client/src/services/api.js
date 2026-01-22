import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

// Tạo instance axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Thêm interceptor để gắn token vào header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth API
export const login = (username, password) =>
  api.post("/api/auth/admin/login", { username, password });

export const verifyToken = () => api.get("/api/auth/admin/verify");

// Session API
export const startSession = () => api.post("/api/sessions/start");

export const endSession = () => api.post("/api/sessions/end");

export const getCurrentSession = () => api.get("/api/sessions/current");

export const getSessionPlaylist = (sessionId) =>
  api.get(`/api/sessions/${sessionId}/playlist`);

// Song API
export const addSong = (youtubeUrl, message, username) =>
  api.post("/api/songs", { youtubeUrl, message, username });

export const voteSong = (songId, voteType, username, playingId = undefined) =>
  api.post(`/api/songs/${songId}/vote`, { voteType, username, playingId });

export const markSongAsPlayed = (songId) =>
  api.post(`/api/songs/${songId}/played`);

export const removeSongFromPlaylist = (songId) =>
  api.delete(`/api/songs/${songId}`);

export const getCurrentSong = () => api.get("/api/songs/current");

export const getPlaylist = () => api.get("/api/songs/playlist");

export const markSongAsPlaying = (songId) =>
  api.post(`/api/songs/${songId}/playing`);

// Gold Price API
export const getTodayGoldPrice = () => api.get("/api/gold/today");

export const getGoldPriceHistory = (limit = 30, page = 1) =>
  api.get(`/api/gold/history?limit=${limit}&page=${page}`);

// Oil Price API
export const getTodayOilPrice = () => api.get("/api/oil/today");

export const getOilPriceHistory = (limit = 30, page = 1) =>
  api.get(`/api/oil/history?limit=${limit}&page=${page}`);

// BTC Price API
export const getTodayBTCPrice = () => api.get("/api/btc/today");

export const getBTCPriceHistory = (limit = 30, page = 1) =>
  api.get(`/api/btc/history?limit=${limit}&page=${page}`);

// Weather API
export const getCurrentWeather = () => api.get("/api/weather");

export default api;
