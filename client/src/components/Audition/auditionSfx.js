import { ASSET, SFX_NAMES } from './auditionConfig'

// Tiếng chấm điểm qua Web Audio (giải mã sẵn) để phát ngay khi bấm, không trễ như <audio>.
export const createSfx = () => {
  let ctx = null
  let muted = false
  let volume = 1
  let buffers = {}

  const ensureCtx = () => {
    // Context đã đóng (StrictMode mount → unmount → mount lại) thì tạo mới, không dùng lại.
    if (!ctx || ctx.state === 'closed') {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      buffers = {}
    }
    return ctx
  }

  const load = async () => {
    const c = ensureCtx()
    await Promise.all(
      SFX_NAMES.map(async (name) => {
        if (buffers[name]) return
        const res = await fetch(ASSET.sfx(name))
        const buf = await c.decodeAudioData(await res.arrayBuffer())
        if (c === ctx) buffers[name] = buf
      })
    )
  }

  // Gọi trong thao tác người dùng (bấm Bắt đầu) để trình duyệt cho phát âm thanh.
  const unlock = () => {
    const c = ensureCtx()
    return c.state === 'suspended' ? c.resume() : Promise.resolve()
  }

  const play = (name, gainScale = 1) => {
    if (muted || !ctx || ctx.state === 'closed' || !name || !buffers[name]) return
    if (ctx.state === 'suspended') ctx.resume()
    const src = ctx.createBufferSource()
    src.buffer = buffers[name]
    const gain = ctx.createGain()
    gain.gain.value = volume * gainScale
    src.connect(gain).connect(ctx.destination)
    src.start()
  }

  return {
    load,
    unlock,
    play,
    setMuted: (m) => { muted = m },
    setVolume: (v) => { volume = v },
    close: () => {
      const c = ctx
      ctx = null
      buffers = {}
      return c && c.state !== 'closed' ? c.close() : Promise.resolve()
    }
  }
}
