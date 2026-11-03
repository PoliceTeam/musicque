import { sharedListening } from './layout.js'

// Âm thanh sảnh, ba lớp — mặc định tắt hết:
//  - ambient: gió + chim xa, tổng hợp bằng Web Audio (không cần file).
//  - chant: tụng kinh nghe riêng (file), ở sân trăng đổi sang nhạc nền; 05:00/18:00 giờ VN nghe chung.
//  - fx: chuông tổng hợp; tiếng hạt và tiếng mõ dùng bản thu.
// Chỉ một tab được phát: tab mới mở báo qua BroadcastChannel, tab cũ tự ngừng.

const AUDIO = '/audio/hall'
const CHANT = { src: `${AUDIO}/temple-chant-review-v1.mp3`, title: 'Tụng kinh' }
export const MOON_TRACKS = [
  { src: `${AUDIO}/moonlight/beyond-the-self.mp3`, cover: `${AUDIO}/moonlight/beyond-the-self-cover.jpg`, title: 'Beyond the Self' },
  { src: `${AUDIO}/moonlight/diamond-sutra.mp3`, cover: `${AUDIO}/moonlight/diamond-sutra-cover.jpg`, title: 'Diamond Sutra' },
  { src: `${AUDIO}/moonlight/lotus-sutra.mp3`, cover: `${AUDIO}/moonlight/lotus-sutra-cover.jpg`, title: 'Lotus Sutra' },
  { src: `${AUDIO}/moonlight/thousand-hands.mp3`, cover: `${AUDIO}/moonlight/thousand-hands-cover.jpg`, title: 'Thousand Hands' },
]
const PREFS_KEY = 'musicque_hall_audio'

const loadPrefs = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    // Bật/tắt không được nhớ: mỗi lần vào đều bắt đầu im lặng; chỉ nhớ âm lượng.
    return { ambient: false, chant: false, fx: false, volume: { ambient: 0.5, chant: 0.6, fx: 0.7, ...(saved.volume || {}) } }
  } catch {
    return { ambient: false, chant: false, fx: false, volume: { ambient: 0.5, chant: 0.6, fx: 0.7 } }
  }
}

export class HallAudio {
  constructor() {
    this.prefs = loadPrefs()
    this.zone = 'yard'
    this.trackIndex = 0
    this.pausedElsewhere = false
    this.listeners = new Set()
    this.id = Math.random().toString(36).slice(2)
    this.moktakTimer = null
    this.moktakBpm = 60
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('musicque-hall-audio')
      this.channel.onmessage = (e) => {
        if (e.data?.type === 'claim' && e.data.id !== this.id) this.pauseForOtherTab()
      }
      // Tab mới mở giành quyền phát ngay.
      this.channel.postMessage({ type: 'claim', id: this.id })
    }
    this.timer = setInterval(() => this.refresh(), 1000)
  }

  subscribe(fn) {
    this.listeners.add(fn)
    fn(this.snapshot())
    return () => this.listeners.delete(fn)
  }

  snapshot() {
    const shared = sharedListening()
    return {
      unlocked: Boolean(this.ctx && this.ctx.state === 'running'),
      ...this.prefs,
      shared: shared.active,
      pausedElsewhere: this.pausedElsewhere,
      moonTrack: this.zone === 'moon' && !shared.active ? MOON_TRACKS[this.trackIndex] : null,
      moktakAuto: Boolean(this.moktakTimer),
      moktakBpm: this.moktakBpm,
    }
  }

  notify() {
    const s = this.snapshot()
    this.listeners.forEach((fn) => fn(s))
  }

  // Phải gọi trong một thao tác người dùng (luật autoplay).
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
      this.gains = {}
      for (const layer of ['ambient', 'chant', 'fx']) {
        const g = this.ctx.createGain()
        g.gain.value = 0
        g.connect(this.master)
        this.gains[layer] = g
      }
      this.chantEl = new Audio()
      this.chantEl.crossOrigin = 'anonymous'
      this.chantEl.preload = 'none'
      this.chantEl.addEventListener('ended', () => this.nextTrack())
      this.ctx.createMediaElementSource(this.chantEl).connect(this.gains.chant)
    }
    if (this.pausedElsewhere) {
      this.pausedElsewhere = false
      this.channel?.postMessage({ type: 'claim', id: this.id })
    }
    this.ctx.resume().then(() => this.refresh())
    this.refresh()
  }

  pauseForOtherTab() {
    this.pausedElsewhere = true
    this.stopMoktak()
    this.chantEl?.pause()
    this.ctx?.suspend()
    this.notify()
  }

  setLayer(layer, on) {
    this.prefs[layer] = on
    this.unlock()
  }

  setVolume(layer, value) {
    this.prefs.volume[layer] = value
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ volume: this.prefs.volume })) } catch { /* bỏ qua */ }
    this.refresh()
  }

  setZone(zone) {
    if (zone === this.zone) return
    const wasMoon = this.zone === 'moon'
    this.zone = zone
    if (wasMoon !== (zone === 'moon')) this.refresh(true)
  }

  nextTrack() {
    if (this.zone === 'moon') this.trackIndex = (this.trackIndex + 1) % MOON_TRACKS.length
    this.refresh(true)
  }

  // Đồng bộ mọi thứ theo prefs/zone/giờ nghe chung.
  refresh(reload = false) {
    const ctx = this.ctx
    if (!ctx || this.pausedElsewhere) return this.notify()
    const t = ctx.currentTime
    const shared = sharedListening()
    const layerOn = (l) => this.prefs[l] && ctx.state === 'running'
    for (const layer of ['ambient', 'chant', 'fx']) {
      this.gains[layer].gain.setTargetAtTime(layerOn(layer) || (layer === 'chant' && shared.active) ? this.prefs.volume[layer] : 0, t, layer === 'fx' ? 0.01 : 0.4)
    }
    if (layerOn('ambient')) this.startAmbient()
    // Lớp tụng kinh: giờ nghe chung > sân trăng (nhạc) > tụng kinh riêng.
    const want = shared.active ? CHANT.src : this.zone === 'moon' ? MOON_TRACKS[this.trackIndex].src : CHANT.src
    const play = shared.active || layerOn('chant')
    const el = this.chantEl
    if (play) {
      const absolute = new URL(want, window.location.origin).href
      if (el.src !== absolute || reload) {
        if (el.src !== absolute) el.src = want
        el.loop = want === CHANT.src
      }
      if (shared.active) {
        // Ai cũng ở cùng một chỗ trong bản tụng, tính từ mốc giờ chung.
        const sync = () => {
          if (!el.duration) return
          const pos = ((Date.now() - shared.startedAt) / 1000) % el.duration
          if (Math.abs(el.currentTime - pos) > 1.5) el.currentTime = pos
        }
        if (el.readyState >= 1) sync()
        else el.addEventListener('loadedmetadata', sync, { once: true })
      }
      if (el.paused) el.play().catch(() => {})
    } else if (el && !el.paused) el.pause()
    this.notify()
  }

  startAmbient() {
    if (this.ambientStarted) return
    this.ambientStarted = true
    const ctx = this.ctx
    // Gió: nhiễu nâu qua lọc thông thấp có tần số trôi chậm.
    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      data[i] = last * 3.2
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    noise.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 260
    lfo.connect(lfoGain).connect(filter.frequency)
    const windGain = ctx.createGain()
    windGain.gain.value = 0.35
    noise.connect(filter).connect(windGain).connect(this.gains.ambient)
    noise.start()
    lfo.start()
    const bird = () => {
      if (!this.ctx) return
      if (this.prefs.ambient && ctx.state === 'running') this.chirp()
      this.birdTimer = setTimeout(bird, 3500 + Math.random() * 9000)
    }
    this.birdTimer = setTimeout(bird, 2000)
  }

  chirp() {
    const ctx = this.ctx
    const t = ctx.currentTime
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain()
    if (pan.pan) pan.pan.value = Math.random() * 1.6 - 0.8
    pan.connect(this.gains.ambient)
    const notes = 2 + Math.floor(Math.random() * 3)
    const base = 2600 + Math.random() * 1600
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      const s = t + i * (0.11 + Math.random() * 0.05)
      o.frequency.setValueAtTime(base, s)
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), s + 0.07)
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.035, s + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.1)
      o.connect(g).connect(pan)
      o.start(s)
      o.stop(s + 0.12)
    }
  }

  fxReady() {
    return this.ctx && this.ctx.state === 'running' && this.prefs.fx && !this.pausedElsewhere
  }

  bell() {
    if (!this.fxReady()) return
    const ctx = this.ctx
    const t = ctx.currentTime
    for (const [ratio, amp, decay] of [[1, 0.22, 6], [2.76, 0.09, 3.5], [5.4, 0.04, 2], [8.9, 0.015, 1.2]]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 196 * ratio
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(amp, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      o.connect(g).connect(this.gains.fx)
      o.start(t)
      o.stop(t + decay)
    }
  }

  bead() {
    return this.playSample('bead-slide-natural.wav')
  }

  async playSample(file) {
    if (!this.ctx || !this.prefs.fx || this.pausedElsewhere) return false
    const ctx = this.ctx
    try { await ctx.resume() } catch { return false }
    this.samples ||= new Map()
    if (!this.samples.has(file)) {
      this.samples.set(file, fetch(`${AUDIO}/${file}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.arrayBuffer()
        })
        .then((data) => ctx.decodeAudioData(data))
        .catch((error) => {
          this.samples.delete(file)
          console.warn('[Sảnh] Không tải được âm thanh', file, error)
          return null
        }))
    }
    const buffer = await this.samples.get(file)
    if (!buffer || this.ctx !== ctx || !this.fxReady()) return false
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.gains.fx)
    source.start()
    return true
  }

  // Ping: hai nốt chuông nhỏ; ping của người khác nhỏ hơn của mình.
  ping(freq, mine = true) {
    if (!this.fxReady()) return
    const ctx = this.ctx
    const t = ctx.currentTime
    ;[0, 0.09].forEach((delay, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = freq * (i ? 1.5 : 1)
      g.gain.setValueAtTime(0, t + delay)
      g.gain.linearRampToValueAtTime(mine ? 0.12 : 0.07, t + delay + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.6)
      o.connect(g).connect(this.gains.fx)
      o.start(t + delay)
      o.stop(t + delay + 0.62)
    })
  }

  // Dùng bản thu mõ thật; giữ âm tổng hợp dự phòng khi không tải được file.
  async moktak() {
    const ctx = this.ctx
    if (await this.playSample('moktak-hit-natural.wav')) return
    if (this.ctx !== ctx || !this.fxReady()) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(520, t)
    o.frequency.exponentialRampToValueAtTime(330, t + 0.08)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.5, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
    const body = ctx.createBiquadFilter()
    body.type = 'bandpass'
    body.frequency.value = 450
    body.Q.value = 3
    o.connect(body).connect(g).connect(this.gains.fx)
    o.start(t)
    o.stop(t + 0.34)
    const click = ctx.createBufferSource()
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3
    click.buffer = buf
    const cg = ctx.createGain()
    cg.gain.value = 0.25
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1500
    click.connect(hp).connect(cg).connect(this.gains.fx)
    click.start(t)
  }

  setMoktakAuto(on, bpm = this.moktakBpm) {
    this.moktakBpm = bpm
    this.stopMoktak()
    if (on) {
      this.moktak()
      this.moktakTimer = setInterval(() => this.moktak(), 60000 / bpm)
    }
    this.notify()
  }

  stopMoktak() {
    clearInterval(this.moktakTimer)
    this.moktakTimer = null
  }

  dispose() {
    clearInterval(this.timer)
    clearTimeout(this.birdTimer)
    this.stopMoktak()
    this.chantEl?.pause()
    this.channel?.close()
    this.ctx?.close()
    this.ctx = null
    this.listeners.clear()
  }
}
