const axios = require('axios')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const VIENEU_TTS_URL = process.env.VIENEU_TTS_URL || 'http://localhost:8100'
const VIENEU_TTS_VOICE = process.env.VIENEU_TTS_VOICE || 'Trúc Ly'
const VIENEU_TTS_CACHE_VERSION = process.env.VIENEU_TTS_CACHE_VERSION || 'vieneu-preset-v1'
const VIENEU_TTS_ENABLED = process.env.VIENEU_TTS_ENABLED || 'true'
const VIENEU_TTS_TIMEOUT = parseInt(process.env.VIENEU_TTS_TIMEOUT, 10) || 30000
const VIENEU_TTS_HEALTH_TIMEOUT = parseInt(process.env.VIENEU_TTS_HEALTH_TIMEOUT, 10) || 5000
const VIENEU_TTS_CACHE_MAX_FILES = parseInt(process.env.VIENEU_TTS_CACHE_MAX_FILES, 10) || 200
const VIENEU_TTS_CACHE_MAX_AGE_DAYS = parseInt(process.env.VIENEU_TTS_CACHE_MAX_AGE_DAYS, 10) || 7
const VIENEU_TTS_WARM_QUEUE_CONCURRENCY = parseInt(process.env.VIENEU_TTS_WARM_QUEUE_CONCURRENCY, 10) || 1
const VIENEU_TTS_CACHE_MAX_AGE_MS = VIENEU_TTS_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000

// Cache directory for generated TTS audio files
const CACHE_DIR = path.join(__dirname, '..', 'tts-cache')
const inFlightGenerations = new Map()
const warmQueue = []
let activeWarmJobs = 0

// Create cache directory if it does not exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  console.log('[TTS] Created cache directory:', CACHE_DIR)
}

function cleanupCache() {
  try {
    const now = Date.now()
    const files = fs.readdirSync(CACHE_DIR)
      .filter((filename) => filename.endsWith('.wav'))
      .map((filename) => {
        const filepath = path.join(CACHE_DIR, filename)
        return { filename, filepath, stat: fs.statSync(filepath) }
      })

    files
      .filter(({ stat }) => now - stat.mtimeMs > VIENEU_TTS_CACHE_MAX_AGE_MS)
      .forEach(({ filepath }) => fs.unlinkSync(filepath))

    const remainingFiles = files
      .filter(({ stat }) => now - stat.mtimeMs <= VIENEU_TTS_CACHE_MAX_AGE_MS)
      .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)

    remainingFiles
      .slice(VIENEU_TTS_CACHE_MAX_FILES)
      .forEach(({ filepath }) => fs.unlinkSync(filepath))
  } catch (error) {
    console.error('[TTS] Error cleaning cache:', error.message)
  }
}

cleanupCache()

/**
 * Check if VieNeu-TTS is enabled via environment config
 */
function isEnabled() {
  return VIENEU_TTS_ENABLED !== 'false'
}

function buildSpeechText(message, username = 'bạn') {
  return `Tới từ ${username} với lời nhắn: ${message.trim()}`
}

/**
 * Generate MD5 cache key from text + voice combination
 */
function getCacheKey(text, voice) {
  const input = `${VIENEU_TTS_CACHE_VERSION}:${text}:${voice || VIENEU_TTS_VOICE}`
  return crypto.createHash('md5').update(input).digest('hex')
}

/**
 * Check if audio file exists in cache directory
 * Returns filepath if cached, null otherwise
 */
function getCachedAudio(cacheKey) {
  try {
    const filepath = path.join(CACHE_DIR, `${cacheKey}.wav`)
    if (fs.existsSync(filepath)) {
      return filepath
    }
    return null
  } catch (error) {
    console.error('[TTS] Error checking cache:', error.message)
    return null
  }
}

function getCachedFilename(text, voice) {
  const cacheKey = getCacheKey(text, voice)
  return getCachedAudio(cacheKey) ? `${cacheKey}.wav` : null
}

/**
 * Call VieNeu-TTS microservice to generate audio from text
 * Saves result to cache and returns the filename
 */
async function generateTTS(text, voice) {
  try {
    const selectedVoice = voice || VIENEU_TTS_VOICE
    const cacheKey = getCacheKey(text, selectedVoice)
    const cachedFilename = getCachedFilename(text, selectedVoice)

    if (cachedFilename) {
      return cachedFilename
    }

    if (inFlightGenerations.has(cacheKey)) {
      return await inFlightGenerations.get(cacheKey)
    }

    const generation = (async () => {
      const { data } = await axios.get(`${VIENEU_TTS_URL}/synthesize`, {
        params: {
          text,
          voice: selectedVoice,
        },
        responseType: 'arraybuffer',
        timeout: VIENEU_TTS_TIMEOUT,
      })

      const filename = `${cacheKey}.wav`
      const filepath = path.join(CACHE_DIR, filename)
      fs.writeFileSync(filepath, Buffer.from(data))
      console.log('[TTS] Generated and cached audio:', filename)
      cleanupCache()

      return filename
    })()

    inFlightGenerations.set(cacheKey, generation)

    try {
      return await generation
    } finally {
      inFlightGenerations.delete(cacheKey)
    }
  } catch (error) {
    console.error('[TTS] Error generating TTS:', error.message)
    return null
  }
}

async function warmTTSCache(text, voice) {
  if (!isEnabled() || !text || text.trim() === '') {
    return null
  }

  const cachedFilename = getCachedFilename(text, voice)
  if (cachedFilename) {
    return cachedFilename
  }

  return generateTTS(text, voice)
}

function processWarmQueue() {
  if (activeWarmJobs >= VIENEU_TTS_WARM_QUEUE_CONCURRENCY || warmQueue.length === 0) {
    return
  }

  const { text, voice, resolve } = warmQueue.shift()
  activeWarmJobs += 1

  warmTTSCache(text, voice)
    .then(resolve)
    .catch((error) => {
      console.error('[TTS] Warm queue failed:', error.message)
      resolve(null)
    })
    .finally(() => {
      activeWarmJobs -= 1
      processWarmQueue()
    })
}

function enqueueWarmTTSCache(text, voice) {
  return new Promise((resolve) => {
    warmQueue.push({ text, voice, resolve })
    processWarmQueue()
  })
}

/**
 * Fetch available voices from VieNeu-TTS microservice
 */
async function getVoices() {
  try {
    const { data } = await axios.get(`${VIENEU_TTS_URL}/voices`, {
      timeout: VIENEU_TTS_HEALTH_TIMEOUT,
    })
    return data
  } catch (error) {
    console.error('[TTS] Error fetching voices:', error.message)
    return null
  }
}

/**
 * Health check for VieNeu-TTS microservice
 * Returns true if service is healthy, false otherwise
 */
async function checkHealth() {
  try {
    const { data } = await axios.get(`${VIENEU_TTS_URL}/health`, {
      timeout: VIENEU_TTS_HEALTH_TIMEOUT,
    })
    return data && data.status === 'ok'
  } catch (error) {
    console.error('[TTS] Health check failed:', error.message)
    return false
  }
}

module.exports = {
  isEnabled,
  getCacheKey,
  getCachedAudio,
  generateTTS,
  getVoices,
  checkHealth,
  buildSpeechText,
  warmTTSCache,
  enqueueWarmTTSCache,
}
