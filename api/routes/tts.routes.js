const express = require('express')
const path = require('path')
const ttsController = require('../controllers/tts.controller')

const router = express.Router()

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.VIENEU_TTS_RATE_WINDOW_MS, 10) || 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.VIENEU_TTS_RATE_MAX_REQUESTS, 10) || 20
const ttsRateBuckets = new Map()

function rateLimitTTS(req, res, next) {
  const now = Date.now()
  const key = req.ip || req.headers['x-forwarded-for'] || 'unknown'
  const bucket = ttsRateBuckets.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS }

  for (const [bucketKey, currentBucket] of ttsRateBuckets.entries()) {
    if (now > currentBucket.resetAt) {
      ttsRateBuckets.delete(bucketKey)
    }
  }

  if (now > bucket.resetAt) {
    bucket.count = 0
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS
  }

  bucket.count += 1
  ttsRateBuckets.set(key, bucket)

  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      audioUrl: null,
      fallback: true,
      message: 'VieNeu-TTS rate limit exceeded',
    })
  }

  next()
}

// POST /api/tts/generate/:songId - Generate TTS audio for a song's message
router.post('/generate/:songId', rateLimitTTS, ttsController.generateForSong)

// GET /api/tts/voices - Get available TTS voices
router.get('/voices', ttsController.getVoices)

// GET /api/tts/health - Check TTS service health
router.get('/health', ttsController.checkHealth)

// GET /api/tts/audio/:filename - Serve cached TTS audio files
router.use('/audio', express.static(path.join(__dirname, '..', 'tts-cache'), { maxAge: '7d' }))

module.exports = router
