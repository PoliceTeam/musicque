import { useEffect, useSyncExternalStore } from 'react'

// Âm thanh Cờ thú tổng hợp hoàn toàn bằng Web Audio: không file, không giấy phép, khớp từng
// hoạt cảnh. Một AudioContext dùng chung; trình duyệt chỉ cho phát sau thao tác đầu tiên
// của người dùng nên mọi thứ chờ `unlock()`.

const STORAGE_KEY = 'musicque_jungle_audio'
const SFX_LEVEL = 0.75
const MUSIC_LEVEL = 0.3

const loadSettings = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    return { sfx: saved.sfx !== false, music: saved.music !== false }
  } catch {
    return { sfx: true, music: true }
  }
}

let settings = typeof window === 'undefined' ? { sfx: true, music: true } : loadSettings()
const listeners = new Set()
const emit = () => listeners.forEach((listener) => listener())

let ctx = null
let sfxBus = null
let musicBus = null
let whiteNoise = null

const createNoise = (seconds, brown = false) => {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else {
      data[i] = white
    }
  }
  return buffer
}

const ensureContext = () => {
  if (ctx || typeof window === 'undefined') return ctx
  const AudioCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioCtor) return null
  ctx = new AudioCtor()
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.ratio.value = 6
  limiter.connect(ctx.destination)
  sfxBus = ctx.createGain()
  sfxBus.gain.value = settings.sfx ? SFX_LEVEL : 0
  sfxBus.connect(limiter)
  musicBus = ctx.createGain()
  musicBus.gain.value = settings.music ? MUSIC_LEVEL : 0
  musicBus.connect(limiter)
  whiteNoise = createNoise(1.5)
  if (import.meta.env.DEV) {
    // Chỉ để kiểm thử tự động: đo mức tín hiệu thực sự ra loa.
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    limiter.connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    window.__jungleAudio = {
      state: () => ctx.state,
      musicRunning: () => Boolean(music.timer),
      level: () => {
        analyser.getFloatTimeDomainData(samples)
        return Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length)
      },
      play: (name) => playSfx(name),
    }
  }
  return ctx
}

const ready = () => ctx && ctx.state === 'running'

// ---- Khối dựng âm ----

const tone = ({ type = 'sine', freq, to, at = 0, dur = 0.2, gain = 0.3, attack = 0.005, bus = sfxBus, pan = 0 }) => {
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(gain, t + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  let out = amp
  if (pan && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner()
    panner.pan.value = pan
    amp.connect(panner)
    out = panner
  }
  osc.connect(amp)
  out.connect(bus)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

const noise = ({ at = 0, dur = 0.2, gain = 0.3, filter = 'bandpass', freq = 1200, to, q = 1, attack = 0.004 }) => {
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = whiteNoise
  const bq = ctx.createBiquadFilter()
  bq.type = filter
  bq.Q.value = q
  bq.frequency.setValueAtTime(freq, t)
  if (to) bq.frequency.exponentialRampToValueAtTime(to, t + dur)
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(gain, t + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(bq)
  bq.connect(amp)
  amp.connect(sfxBus)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.05)
}

const NOTE = (semitone) => 261.63 * 2 ** (semitone / 12) // 0 = C4

// ---- Hiệu ứng ----

const SFX = {
  select: () => {
    tone({ freq: 620, to: 900, dur: 0.09, gain: 0.18 })
    tone({ type: 'triangle', freq: 1240, dur: 0.06, gain: 0.05, at: 0.02 })
  },
  step: (durationMs = 460) => {
    const taps = 3
    for (let i = 0; i < taps; i += 1) {
      const at = (durationMs / 1000) * (i / taps) + 0.03
      noise({ at, dur: 0.07, gain: 0.12, filter: 'lowpass', freq: 900, attack: 0.002 })
      tone({ freq: 150 + i * 12, to: 90, at, dur: 0.07, gain: 0.08 })
    }
  },
  jump: () => {
    tone({ type: 'triangle', freq: 260, to: 720, dur: 0.28, gain: 0.16 })
    noise({ dur: 0.45, gain: 0.12, freq: 500, to: 2600, q: 0.8, attack: 0.05 })
  },
  land: () => {
    tone({ freq: 140, to: 55, dur: 0.22, gain: 0.32 })
    noise({ dur: 0.16, gain: 0.14, filter: 'lowpass', freq: 700, attack: 0.002 })
  },
  splash: () => {
    noise({ dur: 0.45, gain: 0.22, filter: 'lowpass', freq: 2600, to: 500, attack: 0.01 })
    for (let i = 0; i < 4; i += 1) {
      tone({ freq: 500 + Math.random() * 500, to: 1300 + Math.random() * 700, at: 0.05 + i * 0.06, dur: 0.06, gain: 0.05 })
    }
  },
  capture: () => {
    // hai nhát "ngoạm" + tiếng bụp khi quân bị ăn biến mất
    tone({ type: 'square', freq: 210, to: 120, dur: 0.07, gain: 0.08 })
    tone({ type: 'square', freq: 230, to: 130, dur: 0.07, gain: 0.08, at: 0.11 })
    noise({ at: 0.04, dur: 0.06, gain: 0.1, freq: 1800, q: 2 })
    tone({ freq: 950, to: 180, dur: 0.22, gain: 0.22, at: 0.3 })
    noise({ at: 0.3, dur: 0.25, gain: 0.08, freq: 3000, to: 800, q: 0.7 })
  },
  // "wah wah wah waaah" khi Chuột hạ Voi
  trombone: () => {
    const notes = [-2, -3, -4, -5]
    notes.forEach((semi, i) => {
      const t = ctx.currentTime + i * 0.28
      const osc = ctx.createOscillator()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      const lp = ctx.createBiquadFilter()
      const amp = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.value = NOTE(semi - 12)
      lfo.frequency.value = 6
      lfoGain.gain.value = i === 3 ? 6 : 2
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(400, t)
      lp.frequency.linearRampToValueAtTime(1100, t + 0.08)
      lp.frequency.linearRampToValueAtTime(500, t + (i === 3 ? 0.7 : 0.25))
      const len = i === 3 ? 0.75 : 0.25
      amp.gain.setValueAtTime(0.0001, t)
      amp.gain.exponentialRampToValueAtTime(0.14, t + 0.03)
      amp.gain.exponentialRampToValueAtTime(0.0001, t + len)
      osc.connect(lp)
      lp.connect(amp)
      amp.connect(sfxBus)
      osc.start(t)
      lfo.start(t)
      osc.stop(t + len + 0.05)
      lfo.stop(t + len + 0.05)
    })
  },
  trap: () => {
    // tiếng kim loại sập + vòng chóng mặt
    const partials = [523, 790, 1187, 1663]
    partials.forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.5 - i * 0.08, gain: 0.07 }))
    noise({ dur: 0.08, gain: 0.18, freq: 4000, q: 3, attack: 0.001 })
    tone({ freq: 880, to: 440, at: 0.25, dur: 0.5, gain: 0.05 })
    tone({ freq: 660, to: 990, at: 0.45, dur: 0.4, gain: 0.04 })
  },
  invalid: () => {
    tone({ type: 'square', freq: 196, dur: 0.09, gain: 0.07 })
    tone({ type: 'square', freq: 165, dur: 0.14, gain: 0.07, at: 0.12 })
  },
  turn: () => {
    tone({ type: 'triangle', freq: NOTE(7), dur: 0.35, gain: 0.12 })
    tone({ type: 'triangle', freq: NOTE(12), dur: 0.5, gain: 0.12, at: 0.12 })
  },
  notify: () => {
    tone({ type: 'triangle', freq: NOTE(16), dur: 0.4, gain: 0.12 })
    tone({ type: 'triangle', freq: NOTE(12), dur: 0.5, gain: 0.1, at: 0.15 })
  },
  tick: () => tone({ type: 'triangle', freq: 1500, dur: 0.04, gain: 0.05 }),
  win: () => {
    const arpeggio = [0, 4, 7, 12, 16]
    arpeggio.forEach((semi, i) => tone({ type: 'triangle', freq: NOTE(semi), at: i * 0.11, dur: 0.5, gain: 0.14 }))
    const chord = [0, 4, 7]
    chord.forEach((semi) => tone({ type: 'triangle', freq: NOTE(semi + 12), at: 0.6, dur: 1.1, gain: 0.08 }))
    for (let i = 0; i < 8; i += 1) tone({ freq: 2000 + Math.random() * 2000, at: 0.6 + i * 0.07, dur: 0.12, gain: 0.03, pan: Math.random() * 2 - 1 })
  },
  lose: () => {
    const fall = [7, 3, 0, -5]
    fall.forEach((semi, i) => tone({ type: 'triangle', freq: NOTE(semi), at: i * 0.22, dur: 0.45, gain: 0.12 }))
  },
  draw: () => {
    tone({ type: 'triangle', freq: NOTE(7), dur: 0.5, gain: 0.11 })
    tone({ type: 'triangle', freq: NOTE(7), dur: 0.7, gain: 0.11, at: 0.3 })
  },
}

export const playSfx = (name, ...args) => {
  if (!settings.sfx || !ready() || !SFX[name]) return
  try {
    SFX[name](...args)
  } catch (error) {
    console.warn('[Cờ thú] Không phát được âm thanh:', error.message)
  }
}

// ---- Nhạc nền tự sinh: suối + chim + kalimba ngũ cung ----

const STEP = 60 / 88 / 2 // nốt móc đơn ở 88 bpm
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21] // C D E G A (2 quãng tám)
const CHORDS = [
  { root: -12, tones: [0, 4, 7] }, // C
  { root: -15, tones: [9, 12, 16] }, // Am
  { root: -19, tones: [5, 9, 12] }, // F
  { root: -17, tones: [7, 11, 14] }, // G
]

const music = {
  timer: null,
  nextTime: 0,
  step: 0,
  melodyIndex: 4,
  ambience: [],

  pluck(freq, at, gain = 0.12) {
    // kalimba: âm cơ bản tắt chậm + bồi âm cao tắt nhanh
    const t = at
    const partials = [[1, gain, 1.4], [3.01, gain * 0.25, 0.18], [5.4, gain * 0.08, 0.08]]
    partials.forEach(([mult, g, dur]) => {
      const osc = ctx.createOscillator()
      const amp = ctx.createGain()
      osc.frequency.value = freq * mult
      amp.gain.setValueAtTime(0.0001, t)
      amp.gain.exponentialRampToValueAtTime(g, t + 0.004)
      amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      osc.connect(amp)
      amp.connect(musicBus)
      osc.start(t)
      osc.stop(t + dur + 0.05)
    })
  },

  bass(freq, at) {
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    amp.gain.setValueAtTime(0.0001, at)
    amp.gain.exponentialRampToValueAtTime(0.16, at + 0.03)
    amp.gain.exponentialRampToValueAtTime(0.0001, at + STEP * 3.5)
    osc.connect(amp)
    amp.connect(musicBus)
    osc.start(at)
    osc.stop(at + STEP * 4)
  },

  bird(at) {
    const pan = Math.random() * 1.6 - 0.8
    const base = 2600 + Math.random() * 1200
    const chirps = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < chirps; i += 1) {
      const t = at + i * (0.08 + Math.random() * 0.04)
      const osc = ctx.createOscillator()
      const amp = ctx.createGain()
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
      osc.frequency.setValueAtTime(base, t)
      osc.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.3), t + 0.05)
      amp.gain.setValueAtTime(0.0001, t)
      amp.gain.exponentialRampToValueAtTime(0.025, t + 0.01)
      amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
      osc.connect(amp)
      if (panner) {
        panner.pan.value = pan
        amp.connect(panner)
        panner.connect(musicBus)
      } else {
        amp.connect(musicBus)
      }
      osc.start(t)
      osc.stop(t + 0.08)
    }
  },

  startAmbience() {
    // tiếng suối: nhiễu nâu lọc thấp, âm lượng dập dềnh chậm
    const src = ctx.createBufferSource()
    src.buffer = createNoise(4, true)
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 650
    const amp = ctx.createGain()
    amp.gain.value = 0.18
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.13
    lfoGain.gain.value = 0.06
    lfo.connect(lfoGain)
    lfoGain.connect(amp.gain)
    src.connect(lp)
    lp.connect(amp)
    amp.connect(musicBus)
    src.start()
    lfo.start()
    this.ambience = [src, lfo]
  },

  playStep(step, at) {
    const bar = Math.floor(step / 8) % CHORDS.length
    const beat = step % 8
    const chord = CHORDS[bar]
    const phrase = Math.floor(step / 32) % 4
    if (beat === 0) this.bass(NOTE(chord.root), at)
    if (beat === 4) this.bass(NOTE(chord.root + 7), at)

    // giai điệu: đi bộ ngẫu nhiên trên thang ngũ cung, phách mạnh ưu tiên nốt trong hợp âm
    const density = phrase === 3 ? 0.25 : 0.5
    const strong = beat === 0 || beat === 4
    if (strong || Math.random() < density) {
      if (strong) {
        const target = chord.tones[Math.floor(Math.random() * chord.tones.length)]
        const candidates = PENTATONIC.map((semi, i) => ({ i, d: Math.abs(semi % 12 - target % 12) }))
        candidates.sort((a, b) => a.d - b.d || Math.abs(a.i - this.melodyIndex) - Math.abs(b.i - this.melodyIndex))
        this.melodyIndex = candidates[0].i
      } else {
        const move = [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]
        this.melodyIndex = Math.max(1, Math.min(PENTATONIC.length - 1, this.melodyIndex + move))
      }
      this.pluck(NOTE(PENTATONIC[this.melodyIndex]), at, strong ? 0.11 : 0.08)
    }
    if (Math.random() < 0.035) this.bird(at + Math.random() * STEP)
  },

  schedule() {
    while (this.nextTime < ctx.currentTime + 0.5) {
      this.playStep(this.step, this.nextTime)
      this.nextTime += STEP
      this.step += 1
    }
  },

  start() {
    if (this.timer || !ready()) return
    this.nextTime = ctx.currentTime + 0.15
    this.step = 0
    this.startAmbience()
    this.timer = window.setInterval(() => this.schedule(), 120)
  },

  stop() {
    if (this.timer) window.clearInterval(this.timer)
    this.timer = null
    this.ambience.forEach((node) => {
      try { node.stop() } catch { /* đã dừng */ }
    })
    this.ambience = []
  },
}

// ---- Điều khiển ----

let sessionActive = false

const persist = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch { /* chế độ riêng tư: bỏ qua */ }
}

const rampBus = (bus, value) => {
  if (!ctx || !bus) return
  bus.gain.cancelScheduledValues(ctx.currentTime)
  bus.gain.setTargetAtTime(value, ctx.currentTime, 0.15)
}

export const setSfxEnabled = (enabled) => {
  settings = { ...settings, sfx: enabled }
  rampBus(sfxBus, enabled ? SFX_LEVEL : 0)
  persist()
  emit()
}

export const setMusicEnabled = (enabled) => {
  settings = { ...settings, music: enabled }
  rampBus(musicBus, enabled ? MUSIC_LEVEL : 0)
  if (enabled && sessionActive) music.start()
  if (!enabled) window.setTimeout(() => { if (!settings.music) music.stop() }, 600)
  persist()
  emit()
}


const unlock = () => {
  if (!ensureContext()) return
  const go = () => {
    if (sessionActive && settings.music) music.start()
  }
  if (ctx.state === 'suspended') ctx.resume().then(go).catch(() => {})
  else go()
}

const onVisibility = () => {
  if (!ctx) return
  if (document.hidden) ctx.suspend().catch(() => {})
  else if (sessionActive) ctx.resume().catch(() => {})
}

// Gắn cho trang Cờ thú: mở khoá âm thanh ở thao tác đầu tiên, dừng nhạc khi rời trang.
export const useJungleAudioSession = () => {
  useEffect(() => {
    sessionActive = true
    const events = ['pointerdown', 'keydown']
    events.forEach((name) => window.addEventListener(name, unlock))
    document.addEventListener('visibilitychange', onVisibility)
    if (ctx?.state === 'running' && settings.music) music.start()
    return () => {
      sessionActive = false
      events.forEach((name) => window.removeEventListener(name, unlock))
      document.removeEventListener('visibilitychange', onVisibility)
      music.stop()
    }
  }, [])
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const getSnapshot = () => settings

export const useJungleAudioSettings = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
