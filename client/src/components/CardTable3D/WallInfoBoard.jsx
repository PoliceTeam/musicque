import React, { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'
import { useTheme } from '../../contexts/ThemeContext'
import { roomPalettes } from './roomPalette'
import { tableBoardText } from './tableBoard'
export default function WallInfoBoard({ table }) {
  const { isDark } = useTheme()
  const invalidate = useThree(state => state.invalidate)
  const board = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.generateMipmaps = false; texture.minFilter = LinearFilter
    return { canvas, texture, signature: null }
  }, [])
  useEffect(() => {
    let interval, cancelled = false
    const draw = () => {
      if (cancelled) return
      const lines = tableBoardText(table), palette = roomPalettes[isDark ? 'dark' : 'light']
      const font = getComputedStyle(document.body).fontFamily
      const signature = JSON.stringify([lines, isDark, font])
      if (signature !== board.signature) {
        const context = board.canvas.getContext('2d')
        context.fillStyle = palette.wall; context.fillRect(0, 0, 1024, 512)
        context.textAlign = 'center'; context.textBaseline = 'middle'
        context.fillStyle = palette.logoTint; context.font = `700 112px ${font}`; context.fillText(lines[0], 512, 103, 950)
        context.fillStyle = '#1db954'; context.beginPath(); context.roundRect(70, 186, 884, 96, 48); context.fill()
        context.fillStyle = '#121212'; context.font = `700 70px ${font}`; context.fillText(lines[1], 512, 235, 850)
        context.fillStyle = palette.logoTint; context.font = `600 70px ${font}`; context.fillText(lines[2], 512, 346)
        context.font = `500 60px ${font}`; context.fillText(lines[3], 512, 447)
        board.signature = signature; board.texture.needsUpdate = true; invalidate()
      }
      if (!lines[3] && !lines[1].startsWith('Bắt đầu sau')) clearInterval(interval)
    }
    draw()
    if (table.startsAt || table.readyDeadlineAt) interval = setInterval(draw, 1000)
    document.fonts?.ready.then(draw)
    return () => { cancelled = true; clearInterval(interval) }
  }, [table, isDark, board, invalidate])
  useEffect(() => () => board.texture.dispose(), [board])
  return <mesh position={[1.5, 1.85, -2.84]} onUpdate={object => { object.updateMatrix(); object.matrixAutoUpdate = false }}>
    <planeGeometry args={[1.1, 0.55]} /><meshBasicMaterial map={board.texture} />
  </mesh>
}
