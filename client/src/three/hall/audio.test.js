import { afterEach, expect, it, vi } from 'vitest'
import { HallAudio } from './audio'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('gõ mõ và lần hạt cache bản thu đã tải, thử lại sau lỗi mạng', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-03T00:00:00Z'))
  vi.stubGlobal('BroadcastChannel', undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const parameter = () => ({ setValueAtTime() {}, setTargetAtTime: vi.fn(), linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} })
  const sources = []
  const gains = []
  const node = () => ({
    connect() { return this }, gain: parameter(), frequency: parameter(), Q: {}, start: vi.fn(), stop() {},
  })
  const buffer = { duration: 1.1 }
  class AudioContext {
    state = 'running'
    currentTime = 0
    sampleRate = 44100
    resume() { return Promise.resolve() }
    close() {}
    createGain() { const gain = node(); gains.push(gain); return gain }
    createMediaElementSource = node
    createOscillator = node
    createBiquadFilter = node
    createBuffer() { return { getChannelData: () => new Float32Array(882) } }
    createBufferSource() { const source = node(); sources.push(source); return source }
    decodeAudioData() { return Promise.resolve(buffer) }
  }
  vi.stubGlobal('AudioContext', AudioContext)
  const fetchAudio = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
  vi.stubGlobal('fetch', fetchAudio)
  const audio = new HallAudio()
  try {
    audio.setLayer('fx', true)
    expect(gains[3].gain.setTargetAtTime).toHaveBeenCalledWith(0.7, 0, 0.01)
    await audio.moktak()
    expect(fetchAudio).toHaveBeenCalledWith('/audio/hall/moktak-hit-natural.wav')
    expect(sources[0].buffer).toBe(buffer)
    audio.setMoktakAuto(true, 60)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchAudio).toHaveBeenCalledOnce()
    expect(sources).toHaveLength(3)
    expect(sources.every((source) => source.buffer === buffer && source.start.mock.calls.length === 1)).toBe(true)
    audio.setMoktakAuto(false)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchAudio.mockRejectedValueOnce(new Error('Mất mạng tạm thời'))
    await audio.bead()
    expect(sources).toHaveLength(3)
    await audio.bead()
    await audio.bead()
    expect(fetchAudio).toHaveBeenCalledWith('/audio/hall/bead-slide-natural.wav')
    expect(fetchAudio).toHaveBeenCalledTimes(3)
    expect(sources).toHaveLength(5)
    expect(sources.slice(3).every((source) => source.buffer === buffer && source.start.mock.calls.length === 1)).toBe(true)
  } finally { audio.dispose() }
})
