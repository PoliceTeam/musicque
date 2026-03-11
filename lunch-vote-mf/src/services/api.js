import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const getLunchTeams = () => api.get('/api/lunch-vote/teams')

export const createLunchTeam = (name, username) => 
  api.post('/api/lunch-vote/teams', { name, username })

export const deleteLunchTeam = (name, username) => 
  api.delete(`/api/lunch-vote/teams/${encodeURIComponent(name)}`, { params: { username } })

export const getTodayLunchOptions = (team) =>
  api.get('/api/lunch-vote/today', { params: { team } })

export const addLunchOption = (mapsUrl, username, placeName, team) =>
  api.post('/api/lunch-vote/options', { mapsUrl, username, placeName, team })

export const voteLunchOption = (optionId, username, team) =>
  api.post('/api/lunch-vote/vote', { optionId, username, team })

export default api
