import { useEffect, useRef } from 'react'

import { SUIT_COLORS } from './palette'
// Avatar lấy frame đứng từ cùng spritesheet gameplay và cùng palette tám người chơi.
const SuitPortrait = ({ skin = 0 }) => {
  const canvas = useRef(null)
  useEffect(() => {
    let active = true
    const image = new Image()
    image.onload = () => {
      if (!active || !canvas.current) return
      const ctx = canvas.current.getContext('2d', { willReadFrequently: true })
      ctx.clearRect(0, 0, 80, 80); ctx.drawImage(image, 0, 0, 450, 700, 14, 0, 52, 80)
      const pixels = ctx.getImageData(0, 0, 80, 80)
      const color = SUIT_COLORS[skin] || SUIT_COLORS[0]
      const suit = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16))
      for (let i = 0; i < pixels.data.length; i += 4) {
        const [r, g, b] = pixels.data.slice(i, i + 3)
        if (!pixels.data[i + 3] || Math.max(r, g, b) < 45) continue
        let next; let strength
        if (r > g * 1.3 && r > b * 1.3) { next = suit; strength = r / 255 }
        else if (b > r * 1.3 && b > g * 1.3) { next = suit.map(v => v * 0.5); strength = b / 255 }
        else if (g > r * 1.3 && g > b * 1.3) { next = [155, 218, 236]; strength = g / 255 }
        if (next) for (let c = 0; c < 3; c++) pixels.data[i + c] = next[c] * strength
      }
      ctx.putImageData(pixels, 0, 0)
    }
    image.src = '/secret-shift/crew-walk.png'
    return () => { active = false }
  }, [skin])
  return <canvas className='shift-suit-portrait' ref={canvas} width={80} height={80} aria-hidden='true' />
}
export default SuitPortrait
