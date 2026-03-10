import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const getTodayLunchOptions = () => api.get('/api/lunch-vote/today')

export const addLunchOption = (mapsUrl, username, placeName) =>
  api.post('/api/lunch-vote/options', { mapsUrl, username, placeName })

export const voteLunchOption = (optionId, username) =>
  api.post('/api/lunch-vote/vote', { optionId, username })

export default api
