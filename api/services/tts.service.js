const axios = require('axios')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const VIENEU_TTS_URL = process.env.VIENEU_TTS_URL || 'http://localhost:8100'
const VIENEU_TTS_VOICE = process.env.VIENEU_TTS_VOICE || 'Trúc Ly'
const VIENEU_TTS_CACHE_VERSION = process.env.VIENEU_TTS_CACHE_VERSION || 'vieneu-preset-fast-v1'
const VIENEU_TTS_ENABLED = process.env.VIENEU_TTS_ENABLED || 'true'
const VIENEU_TTS_TIMEOUT = parseInt(process.env.VIENEU_TTS_TIMEOUT, 10) || 90000
const VIENEU_TTS_PRIMARY_TIMEOUT = parseInt(process.env.VIENEU_TTS_PRIMARY_TIMEOUT, 10) || VIENEU_TTS_TIMEOUT
const VIENEU_TTS_HEALTH_TIMEOUT = parseInt(process.env.VIENEU_TTS_HEALTH_TIMEOUT, 10) || 5000
const VIENEU_TTS_CACHE_MAX_FILES = parseInt(process.env.VIENEU_TTS_CACHE_MAX_FILES, 10) || 200
const VIENEU_TTS_CACHE_MAX_AGE_DAYS = parseInt(process.env.VIENEU_TTS_CACHE_MAX_AGE_DAYS, 10) || 7
const VIENEU_TTS_INCLUDE_SENDER = process.env.VIENEU_TTS_INCLUDE_SENDER === 'true'
const VIENEU_TTS_WARMUP_TEXT = process.env.VIENEU_TTS_WARMUP_TEXT || 'Xin chào'
const VIENEU_TTS_QUEUE_MAX_SIZE = parseInt(process.env.VIENEU_TTS_QUEUE_MAX_SIZE, 10) || 50
const VIENEU_TTS_CLEANUP_INTERVAL_MS = parseInt(process.env.VIENEU_TTS_CLEANUP_INTERVAL_MS, 10) || 60 * 1000
const VIENEU_TTS_SPEECH_MAX_CHARS = parseInt(process.env.VIENEU_TTS_SPEECH_MAX_CHARS, 10) || 200
const VIENEU_TTS_CACHE_MAX_AGE_MS = VIENEU_TTS_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
const EDGE_TTS_ENABLED = process.env.EDGE_TTS_ENABLED !== 'false'
const EDGE_TTS_VOICE = process.env.EDGE_TTS_VOICE || 'vi-VN-NamMinhNeural'
const EDGE_TTS_RATE = process.env.EDGE_TTS_RATE || '+0%'
const EDGE_TTS_VOLUME = process.env.EDGE_TTS_VOLUME || '+0%'
const EDGE_TTS_PITCH = process.env.EDGE_TTS_PITCH || '+0Hz'
const EDGE_TTS_TIMEOUT = parseInt(process.env.EDGE_TTS_TIMEOUT, 10) || 15000
const CACHE_EXTENSIONS = ['.wav', '.mp3']
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
      .filter((filename) => CACHE_EXTENSIONS.some((extension) => filename.endsWith(extension)))
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

function isEdgeTTSEnabled() {
  return EDGE_TTS_ENABLED
}

function trimToMaxChars(text, maxChars) {
  const chars = Array.from(text)
  if (chars.length <= maxChars) {
    return text
  }

  const hardTrimmed = chars.slice(0, maxChars).join('').trim()
  const sentenceBoundary = Math.max(
    hardTrimmed.lastIndexOf('.'),
    hardTrimmed.lastIndexOf('!'),
    hardTrimmed.lastIndexOf('?'),
    hardTrimmed.lastIndexOf(','),
    hardTrimmed.lastIndexOf(';'),
  )

  if (sentenceBoundary >= Math.floor(maxChars * 0.65)) {
    return hardTrimmed.slice(0, sentenceBoundary + 1).trim()
  }

  const wordBoundary = hardTrimmed.lastIndexOf(' ')
  if (wordBoundary >= Math.floor(maxChars * 0.65)) {
    return hardTrimmed.slice(0, wordBoundary).trim()
  }

  return hardTrimmed
}

function normalizeSpeechText(text, maxChars = VIENEU_TTS_SPEECH_MAX_CHARS) {
  if (!text) {
    return ''
  }

  const cleaned = text
    .normalize('NFC')
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\s.,!?;:'"()/-]/gu, ' ')
    .replace(/([!?.,;:]){2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim()

  if (!cleaned || maxChars <= 0) {
    return cleaned
  }

  return trimToMaxChars(cleaned, maxChars)
}

function buildSpeechText(message, username = 'bạn') {
  const normalizedMessage = normalizeSpeechText(message)
  if (!normalizedMessage) {
    return ''
  }

  if (!VIENEU_TTS_INCLUDE_SENDER) {
    return normalizedMessage
  }

  const normalizedUsername = normalizeSpeechText(username, 40) || 'bạn'
  return normalizeSpeechText(`Tới từ ${normalizedUsername} với lời nhắn: ${normalizedMessage}`)
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
    for (const extension of CACHE_EXTENSIONS) {
      const filepath = path.join(CACHE_DIR, `${cacheKey}${extension}`)
      if (fs.existsSync(filepath)) {
        return filepath
      }
    }
    return null
  } catch (error) {
    console.error('[TTS] Error checking cache:', error.message)
    return null
  }
}

function getCachedFilename(text, voice) {
  const cacheKey = getCacheKey(text, voice)
  const cachedPath = getCachedAudio(cacheKey)
  return cachedPath ? path.basename(cachedPath) : null
}

async function synthesizeVieneuAudio(text, voice) {
  console.log(
    '[TTS] VieNeu synthesize request:',
    `textLen=${Array.from(text || '').length}`,
    `voice=${voice}`,
    `timeoutMs=${VIENEU_TTS_PRIMARY_TIMEOUT}`,
  )
  const { data } = await axios.get(`${VIENEU_TTS_URL}/synthesize`, {
    params: {
      text,
      voice,
    },
    responseType: 'arraybuffer',
    timeout: VIENEU_TTS_PRIMARY_TIMEOUT,
  })

  return data
}

async function synthesizeEdgeAudio(text) {
  console.log(
    '[TTS] Edge synthesize request:',
    `textLen=${Array.from(text || '').length}`,
    `voice=${EDGE_TTS_VOICE}`,
    `timeoutMs=${EDGE_TTS_TIMEOUT}`,
  )

  const { data } = await axios.get(`${VIENEU_TTS_URL}/edge-synthesize`, {
    params: {
      text,
      voice: EDGE_TTS_VOICE,
      rate: EDGE_TTS_RATE,
      volume: EDGE_TTS_VOLUME,
      pitch: EDGE_TTS_PITCH,
    },
    responseType: 'arraybuffer',
    timeout: EDGE_TTS_TIMEOUT,
  })

  return data
}

/**
 * Call the primary VieNeu-TTS service, then Edge online TTS as a best-effort fallback.
 */
async function synthesizeAudio(text, voice) {
  const startedAt = Date.now()

  try {
    return {
      data: await synthesizeVieneuAudio(text, voice),
      provider: 'vieneu',
    }
  } catch (primaryError) {
    const status = primaryError.response?.status
    const detail = primaryError.response?.data?.detail || primaryError.code || primaryError.message
    console.error(
      '[TTS] VieNeu synthesize failed:',
      `textLen=${Array.from(text || '').length}`,
      `voice=${voice}`,
      `durationMs=${Date.now() - startedAt}`,
      status ? `status=${status}` : '',
      `reason=${detail}`,
    )

    if (!isEdgeTTSEnabled()) {
      throw primaryError
    }

    const fallbackStartedAt = Date.now()
    try {
      return {
        data: await synthesizeEdgeAudio(text),
        provider: 'edge',
      }
    } catch (fallbackError) {
      const fallbackStatus = fallbackError.response?.status
      const fallbackDetail = fallbackError.response?.data?.detail
        || fallbackError.code
        || fallbackError.message
      console.error(
        '[TTS] Edge fallback failed:',
        `durationMs=${Date.now() - fallbackStartedAt}`,
        fallbackStatus ? `status=${fallbackStatus}` : '',
        `reason=${fallbackDetail}`,
      )
      throw fallbackError
    }
  }
}

async function synthesizeAndCache(text, voice, cacheKey) {
  const startedAt = Date.now()
  let data
  let provider
  try {
    const synthesized = await synthesizeAudio(text, voice)
    data = synthesized.data
    provider = synthesized.provider
  } catch (error) {
    const status = error.response?.status
    const detail = error.response?.data?.detail || error.code || error.message
    console.error(
      '[TTS] Synthesize failed:',
      `cacheKey=${cacheKey}`,
      `textLen=${Array.from(text || '').length}`,
      `voice=${voice}`,
      `durationMs=${Date.now() - startedAt}`,
      status ? `status=${status}` : '',
      `reason=${detail}`,
    )
    throw error
  }

  const extension = provider === 'edge' ? '.mp3' : '.wav'
  const filename = `${cacheKey}${extension}`
  const filepath = path.join(CACHE_DIR, filename)
  fs.writeFileSync(filepath, Buffer.from(data))
  console.log(
    '[TTS] Generated and cached audio:',
    filename,
    `provider=${provider}`,
    `durationMs=${Date.now() - startedAt}`,
  )
  cleanupCache()

  return filename
}

async function touchTTS(text, voice) {
  const startedAt = Date.now()
  await synthesizeVieneuAudio(text, voice)
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
    console.log(
      '[TTS] Queued generation job:',
      `cacheKey=${job.cacheKey}`,
      `priority=${job.priority}`,
      `queueSize=${generationQueue.length}`,
    )
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
  const startedAt = Date.now()

  console.log(
    '[TTS] Processing generation job:',
    `cacheKey=${job.cacheKey}`,
    `priority=${job.priority}`,
    `queueSize=${generationQueue.length}`,
  )

  job.run()
    .then(job.resolve)
    .catch((error) => {
      console.error(
        '[TTS] Error generating TTS:',
        error.message,
        `cacheKey=${job.cacheKey}`,
        `durationMs=${Date.now() - startedAt}`,
      )
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
  const cacheKey = getCacheKey(text, voice || VIENEU_TTS_VOICE)
  const pending = !filename && inFlightGenerations.has(cacheKey)

  if (pending) {
    console.log('[TTS] Generation pending:', `cacheKey=${cacheKey}`, `waitMs=${timeoutMs}`)
  }

  return {
    filename,
    pending,
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
  const providerHealth = await checkProviderHealth()
  return providerHealth.available
}

async function checkProviderHealth() {
  let vieneuAvailable = false

  try {
    const { data } = await axios.get(`${VIENEU_TTS_URL}/health`, {
      timeout: VIENEU_TTS_HEALTH_TIMEOUT,
    })
    vieneuAvailable = data && data.status === 'ok'
  } catch (error) {
    console.error('[TTS] Health check failed:', error.message)
  }

  const edgeAvailable = isEdgeTTSEnabled() && vieneuAvailable

  return {
    available: vieneuAvailable || edgeAvailable,
    primary: {
      provider: 'vieneu',
      available: vieneuAvailable,
    },
    fallback: {
      provider: 'edge',
      available: edgeAvailable,
      voice: edgeAvailable ? EDGE_TTS_VOICE : null,
    },
  }
}

module.exports = {
  isEnabled,
  isEdgeTTSEnabled,
  getCacheKey,
  getCachedAudio,
  generateTTS,
  waitForTTSGeneration,
  getVoices,
  checkHealth,
  checkProviderHealth,
  buildSpeechText,
  normalizeSpeechText,
  warmTTSCache,
  enqueueWarmTTSCache,
  warmupTTS,
}
