const Song = require('../models/song.model')
const ttsService = require('../services/tts.service')

const VIENEU_TTS_SYNC_WAIT_MS = parseInt(process.env.VIENEU_TTS_SYNC_WAIT_MS, 10) || 2500
const VIENEU_TTS_RETRY_AFTER_MS = parseInt(process.env.VIENEU_TTS_RETRY_AFTER_MS, 10) || 500

// Warm up VieNeu-TTS model/voice in the background.
exports.warmup = async (req, res) => {
  if (!ttsService.isEnabled()) {
    return res.status(200).json({
      warmed: false,
      fallback: true,
      fallbackReason: 'disabled',
      message: 'VieNeu-TTS unavailable',
    })
  }

  setImmediate(() => {
    ttsService.warmupTTS().catch((error) => {
      console.error('[TTS] Warmup failed:', error.message)
    })
  })

  return res.status(202).json({
    warmed: false,
    pending: true,
    message: 'VieNeu-TTS warmup started',
  })
}

// Generate TTS audio for a song's message
exports.generateForSong = async (req, res) => {
  try {
    const { songId } = req.params

    // Check if TTS is enabled
    if (!ttsService.isEnabled()) {
      return res.status(200).json({
        audioUrl: null,
        fallback: true,
        fallbackReason: 'disabled',
        message: 'VieNeu-TTS unavailable',
      })
    }

    // Find song by ID and populate addedBy
    const song = await Song.findById(songId).populate('addedBy', 'username')
    if (!song) {
      return res.status(404).json({ message: 'Không tìm thấy bài hát' })
    }

    // Check song has a message to synthesize
    if (!song.message || song.message.trim() === '') {
      return res.status(400).json({ message: 'Bài hát không có lời nhắn để đọc' })
    }

    const speechText = ttsService.buildSpeechText(song.message, song.addedBy?.username)
    const cacheKey = ttsService.getCacheKey(speechText)

    // Check cache first
    const cachedPath = ttsService.getCachedAudio(cacheKey)
    if (cachedPath) {
      const filename = `${cacheKey}.wav`
      console.log('[TTS] Cache hit for song:', songId)
      return res.status(200).json({
        audioUrl: `/api/tts/audio/${filename}`,
      })
    }

    // Cache miss — start/reuse generation, but do not keep browser requests open for a long synthesize.
    const { filename, pending } = await ttsService.waitForTTSGeneration(
      speechText,
      undefined,
      VIENEU_TTS_SYNC_WAIT_MS,
    )

    if (pending) {
      return res.status(202).json({
        audioUrl: null,
        pending: true,
        retryAfterMs: VIENEU_TTS_RETRY_AFTER_MS,
        message: 'VieNeu-TTS is still generating',
      })
    }

    if (!filename) {
      return res.status(200).json({
        audioUrl: null,
        fallback: true,
        fallbackReason: 'generation_failed',
        message: 'VieNeu-TTS unavailable',
      })
    }

    console.log('[TTS] Generated audio for song:', songId)
    res.status(200).json({
      audioUrl: `/api/tts/audio/${filename}`,
    })
  } catch (error) {
    console.error('[TTS] Error in generateForSong:', error.message)
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Get available TTS voices
exports.getVoices = async (req, res) => {
  try {
    const voices = await ttsService.getVoices()
    if (!voices) {
      return res.status(200).json({
        voices: [],
        fallback: true,
        message: 'VieNeu-TTS unavailable',
      })
    }

    res.status(200).json({ voices })
  } catch (error) {
    console.error('[TTS] Error in getVoices:', error.message)
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}

// Check TTS service health
exports.checkHealth = async (req, res) => {
  try {
    const isHealthy = await ttsService.checkHealth()
    res.status(200).json({
      available: isHealthy,
    })
  } catch (error) {
    console.error('[TTS] Error in checkHealth:', error.message)
    res.status(500).json({ message: 'Lỗi server', error: error.message })
  }
}
