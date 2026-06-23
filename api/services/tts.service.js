const axios = require('axios')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const VIENEU_TTS_URL = process.env.VIENEU_TTS_URL || 'http://localhost:8100'
const VIENEU_TTS_VOICE = process.env.VIENEU_TTS_VOICE || 'Trúc Ly'
const VIENEU_TTS_CACHE_VERSION = process.env.VIENEU_TTS_CACHE_VERSION || 'vieneu-preset-fast-v1'
const VIENEU_TTS_ENABLED = process.env.VIENEU_TTS_ENABLED || 'true'
const VIENEU_TTS_TIMEOUT = parseInt(process.env.VIENEU_TTS_TIMEOUT, 10) || 90000
const VIENEU_TTS_HEALTH_TIMEOUT = parseInt(process.env.VIENEU_TTS_HEALTH_TIMEOUT, 10) || 5000
const VIENEU_TTS_CACHE_MAX_FILES = parseInt(process.env.VIENEU_TTS_CACHE_MAX_FILES, 10) || 200
const VIENEU_TTS_CACHE_MAX_AGE_DAYS = parseInt(process.env.VIENEU_TTS_CACHE_MAX_AGE_DAYS, 10) || 7
const VIENEU_TTS_INCLUDE_SENDER = process.env.VIENEU_TTS_INCLUDE_SENDER === 'true'
const VIENEU_TTS_WARMUP_TEXT = process.env.VIENEU_TTS_WARMUP_TEXT || 'Xin chào'
const VIENEU_TTS_QUEUE_MAX_SIZE = parseInt(process.env.VIENEU_TTS_QUEUE_MAX_SIZE, 10) || 50
const VIENEU_TTS_CLEANUP_INTERVAL_MS = parseInt(process.env.VIENEU_TTS_CLEANUP_INTERVAL_MS, 10) || 60 * 1000
const VIENEU_TTS_CACHE_MAX_AGE_MS = VIENEU_TTS_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
const GENERATION_PRIORITY = {
  PLAYBACK: 0,
  WARM: 1,
}

// Cache directory for generated TTS audio files
const CACHE_DIR = path.join(__dirname, '..', 'tts-cache')
const inFlightGenerations = new Map()
const generationQueue = []
let activeGeneration = false
let lastCacheCleanupAt = 0

// Create cache directory if it does not exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  console.log('[TTS] Created cache directory:', CACHE_DIR)
}

function cleanupCache(force = false) {
  try {
    const now = Date.now()
    if (!force && now - lastCacheCleanupAt < VIENEU_TTS_CLEANUP_INTERVAL_MS) {
      return
    }
    lastCacheCleanupAt = now

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

cleanupCache(true)

/**
 * Check if VieNeu-TTS is enabled via environment config
 */
function isEnabled() {
  return VIENEU_TTS_ENABLED !== 'false'
}

function buildSpeechText(message, username = 'bạn') {
  const normalizedMessage = message.trim()
  if (!VIENEU_TTS_INCLUDE_SENDER) {
    return normalizedMessage
  }

  return `Tới từ ${username} với lời nhắn: ${normalizedMessage}`
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
async function synthesizeAudio(text, voice) {
  const { data } = await axios.get(`${VIENEU_TTS_URL}/synthesize`, {
    params: {
      text,
      voice,
    },
    responseType: 'arraybuffer',
    timeout: VIENEU_TTS_TIMEOUT,
  })

  return data
}

async function synthesizeAndCache(text, voice, cacheKey) {
  const startedAt = Date.now()
  const data = await synthesizeAudio(text, voice)
  const filename = `${cacheKey}.wav`
  const filepath = path.join(CACHE_DIR, filename)
  fs.writeFileSync(filepath, Buffer.from(data))
  console.log('[TTS] Generated and cached audio:', filename, `durationMs=${Date.now() - startedAt}`)
  cleanupCache()

  return filename
}

async function touchTTS(text, voice) {
  const startedAt = Date.now()
  await synthesizeAudio(text, voice)
  console.log('[TTS] Warmed VieNeu voice:', `durationMs=${Date.now() - startedAt}`)
  return true
}

function dropQueuedWarmJob() {
  for (let index = generationQueue.length - 1; index >= 0; index -= 1) {
    const job = generationQueue[index]
    if (job.priority > GENERATION_PRIORITY.PLAYBACK) {
      generationQueue.splice(index, 1)
      if (job.cacheKey) {
        inFlightGenerations.delete(job.cacheKey)
      }
      job.resolve(null)
      console.warn('[TTS] Dropped queued warm job to keep playback responsive')
      return true
    }
  }

  return false
}

function enqueueGenerationJob(job) {
  if (generationQueue.length >= VIENEU_TTS_QUEUE_MAX_SIZE) {
    if (job.priority > GENERATION_PRIORITY.PLAYBACK) {
      console.warn('[TTS] Dropping warm job because generation queue is full')
      return Promise.resolve(null)
    }

    if (!dropQueuedWarmJob()) {
      console.warn('[TTS] Dropping playback job because generation queue is full')
      return Promise.resolve(null)
    }
  }

  const generation = new Promise((resolve) => {
    generationQueue.push({ ...job, resolve })
    processGenerationQueue()
  })

  if (job.cacheKey) {
    inFlightGenerations.set(job.cacheKey, generation)
  }

  return generation
}

function processGenerationQueue() {
  if (activeGeneration || generationQueue.length === 0) {
    return
  }

  generationQueue.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)
  const job = generationQueue.shift()
  activeGeneration = true

  job.run()
    .then(job.resolve)
    .catch((error) => {
      console.error('[TTS] Error generating TTS:', error.message)
      job.resolve(null)
    })
    .finally(() => {
      inFlightGenerations.delete(job.cacheKey)
      activeGeneration = false
      processGenerationQueue()
    })
}

function queueTTSGeneration(text, voice, priority) {
  const selectedVoice = voice || VIENEU_TTS_VOICE
  const cacheKey = getCacheKey(text, selectedVoice)
  const cachedFilename = getCachedFilename(text, selectedVoice)

  if (cachedFilename) {
    return Promise.resolve(cachedFilename)
  }

  if (inFlightGenerations.has(cacheKey)) {
    const queuedJob = generationQueue.find((job) => job.cacheKey === cacheKey)
    if (queuedJob && priority < queuedJob.priority) {
      queuedJob.priority = priority
    }

    return inFlightGenerations.get(cacheKey)
  }

  return enqueueGenerationJob({
    cacheKey,
    priority,
    createdAt: Date.now(),
    run: () => synthesizeAndCache(text, selectedVoice, cacheKey),
  })
}

function generateTTS(text, voice) {
  return queueTTSGeneration(text, voice, GENERATION_PRIORITY.PLAYBACK)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForTTSGeneration(text, voice, timeoutMs) {
  const generation = generateTTS(text, voice)
  const timeout = sleep(timeoutMs).then(() => null)
  const filename = await Promise.race([generation, timeout])

  return {
    filename,
    pending: !filename && inFlightGenerations.has(getCacheKey(text, voice || VIENEU_TTS_VOICE)),
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

  return queueTTSGeneration(text, voice, GENERATION_PRIORITY.WARM)
}

function enqueueWarmTTSCache(text, voice) {
  return warmTTSCache(text, voice)
}

function warmupTTS() {
  const selectedVoice = VIENEU_TTS_VOICE
  const cacheKey = `warmup:${getCacheKey(VIENEU_TTS_WARMUP_TEXT, selectedVoice)}`

  if (inFlightGenerations.has(cacheKey)) {
    return inFlightGenerations.get(cacheKey)
  }

  return enqueueGenerationJob({
    cacheKey,
    priority: GENERATION_PRIORITY.WARM,
    createdAt: Date.now(),
    run: () => touchTTS(VIENEU_TTS_WARMUP_TEXT, selectedVoice),
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
  waitForTTSGeneration,
  getVoices,
  checkHealth,
  buildSpeechText,
  warmTTSCache,
  enqueueWarmTTSCache,
  warmupTTS,
}
