import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

// Tạo instance axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Một token duy nhất cho cả user thường và admin
export const TOKEN_STORAGE_KEY = "musicque_token";
const DEVICE_STORAGE_KEY = "musicque_device_id";

const createDeviceId = () => {
  if (crypto.randomUUID) return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getDeviceId = () => {
  let deviceId = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (!deviceId) {
    deviceId = createDeviceId();
    localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
  }
  return deviceId;
};

export const getStoredToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);

export const setStoredToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

// Thêm interceptor để gắn token vào header
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Token hết hạn / bị thu hồi → xoá và báo cho AuthContext biết
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && getStoredToken()) {
      setStoredToken(null);
      window.dispatchEvent(new CustomEvent("musicque:unauthenticated"));
    }
    return Promise.reject(error);
  }
);

// Auth API
export const register = (username, password, displayName) =>
  api.post(
    "/api/auth/register",
    { username, password, displayName },
    { headers: { "X-Musicque-Device": getDeviceId() } },
  );

export const login = (username, password) =>
  api.post("/api/auth/login", { username, password });

export const fetchMe = () => api.get("/api/auth/me");

export const updateMyAvatar = (avatarId) =>
  api.patch("/api/auth/me/avatar", { avatarId });

// Polite Coins API
export const getCoinBalance = () => api.get("/api/coins/me");
export const getCoinLeaderboard = (config = {}) =>
  api.get("/api/coins/leaderboard", config);
export const getCoinEconomyStats = (period = "30d", config = {}) =>
  api.get("/api/coins/admin/stats", { ...config, params: { period } });
export const claimDailyBonus = () => api.post("/api/coins/daily-bonus");

// Cho-Han (Bakuchi) API
export const getChohanState = () => api.get("/api/chohan/state");
export const getChohanHistory = (limit = 20) =>
  api.get(`/api/chohan/history?limit=${limit}`);
export const placeChohanBet = (side, amount) =>
  api.post("/api/chohan/bet", { side, amount });

// Bid PC để đẩy điểm bài hát
export const bidSong = (songId, amount) =>
  api.post(`/api/songs/${songId}/bid`, { amount });

// PC vote-next cho bài đang phát
export const getSongSkipState = (songId) => api.get(`/api/songs/${songId}/skip`);
export const contributeSongSkip = (songId, amount, requestKey) =>
  api.post(`/api/songs/${songId}/skip`, { amount, requestKey });

// Session API
export const startSession = () => api.post("/api/sessions/start");

export const endSession = () => api.post("/api/sessions/end");

export const getCurrentSession = () => api.get("/api/sessions/current");

export const getSessionPlaylist = (sessionId) =>
  api.get(`/api/sessions/${sessionId}/playlist`);

// Chat room theo phiên phát nhạc
export const getChatMessages = (sessionId, params = {}, config = {}) =>
  api.get(`/api/chat/sessions/${sessionId}/messages`, {
    ...config,
    params: { limit: 50, ...params },
  });

// Song API — danh tính người gửi lấy từ token, không truyền username nữa
export const addSong = (youtubeUrl, message) =>
  api.post("/api/songs", { youtubeUrl, message });

export const voteSong = (songId, voteType, playingId = undefined) =>
  api.post(`/api/songs/${songId}/vote`, { voteType, playingId });

export const markSongAsPlayed = (songId) =>
  api.post(`/api/songs/${songId}/played`);

export const removeSongFromPlaylist = (songId) =>
  api.delete(`/api/songs/${songId}`);

export const getCurrentSong = () => api.get("/api/songs/current");

export const getPlaylist = () => api.get("/api/songs/playlist");

export const markSongAsPlaying = (songId) =>
  api.post(`/api/songs/${songId}/playing`);

export const advanceSong = (songId) =>
  api.post(`/api/songs/${songId}/advance`);

// Weather API
export const getCurrentWeather = () => api.get("/api/weather");

// News API
export const getVnExpressNews = () => api.get("/api/news/vnexpress");

export const getTechNews = (page = 1, limit = 7, seed = 1) => api.get(`/api/news/tech?page=${page}&limit=${limit}&seed=${seed}`);

// Idioms API — trả 8 câu của ngày làm việc, client tự random 1 câu để hiển thị
export const getDailyIdioms = () =>
  api.get("/api/idioms/today", {
    // _t chống cache trung gian: số like/dislike phải luôn tươi
    params: { _t: Date.now() },
  });
export const getRandomIdiom = () => api.get("/api/idioms/random");
export const voteIdiom = (id, value) => api.post("/api/idioms/vote", { id, value });
export const rerollIdioms = () => api.post("/api/idioms/reroll");

// Bi-a 9 bóng — NPC dọn bàn (quỹ đạo do server mô phỏng sẵn)
// since = chỉ số cơ nhỏ nhất muốn nhận. Server chỉ tiết lộ các cơ đã tới lượt,
// và giấu kết quả của cơ đang mở kèo — nên client phải xin lại theo tiến độ.
export const getBilliardsCurrent = (since) =>
  api.get("/api/billiards/current", { params: since === undefined ? {} : { since } });
export const getBilliardsSummary = () => api.get("/api/billiards/summary");
export const getBilliardsGame = (id) => api.get(`/api/billiards/games/${id}`);
export const placeBilliardsBet = (payload) => api.post("/api/billiards/bet", payload);
export const getBilliardsMyBets = (gameId) =>
  api.get("/api/billiards/my-bets", { params: { gameId } });

// TTS API (VieNeu-TTS)
export const generateTTS = (songId, config = {}) =>
  api.post(`/api/tts/generate/${songId}`, {}, config);
export const warmupTTS = (config = {}) => api.post("/api/tts/warmup", {}, config);
export const getTTSVoices = () => api.get("/api/tts/voices");
export const getTTSHealth = () => api.get("/api/tts/health");

export default api;
