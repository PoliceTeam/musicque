import React, { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'
import { useTheme } from '../../contexts/ThemeContext'
import { syncTableGameTimer } from '../../utils/tableGame'
import { turnColor, turnTiming } from './turn'
import { roomPalettes } from './roomPalette'
import { relocateWallBoardFrame, tableBoardText, WALL_BOARD_POSITION, WALL_BOARD_SIZE } from './tableBoard'
export default function WallInfoBoard({ table, turnMs = 20000 }) {
  const { isDark } = useTheme()
  const { scene, invalidate } = useThree()
  useEffect(() => {
    scene.traverse(object => { if (object.geometry?.getAttribute('paletteKey')) relocateWallBoardFrame(object.geometry) })
    invalidate()
  }, [scene, invalidate])
  const board = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.generateMipmaps = false; texture.minFilter = LinearFilter
    return { canvas, texture, signature: null }
  }, [])
  useEffect(() => {
    let interval, cancelled = false
    const sync = syncTableGameTimer(table, table.receivedAt ?? Date.now())
    const draw = () => {
      if (cancelled) return
      const lines = tableBoardText(table), palette = roomPalettes[isDark ? 'dark' : 'light']
      const timing = turnTiming(table, turnMs, Date.now(), sync)
      const color = table.status === 'playing' ? turnColor(timing.fraction) : '#4caf50'
      if (table.status === 'playing' && table.turnDeadlineAt) lines[1] = `Còn ${timing.seconds}s`
      const font = getComputedStyle(document.body).fontFamily
      const signature = JSON.stringify([lines, color, isDark, font])
      if (signature !== board.signature) {
        const context = board.canvas.getContext('2d')
        context.fillStyle = palette.wall; context.fillRect(0, 0, 1024, 512)
        context.textAlign = 'center'; context.textBaseline = 'middle'
        context.fillStyle = palette.logoTint; context.font = `700 112px ${font}`; context.fillText(lines[0], 512, 103, 950)
        context.fillStyle = color; context.beginPath(); context.roundRect(70, 186, 884, 96, 48); context.fill()
        context.fillStyle = '#121212'; context.font = `700 70px ${font}`; context.fillText(lines[1], 512, 235, 850)
        context.fillStyle = palette.logoTint; context.font = `600 70px ${font}`; context.fillText(lines[2], 512, 346)
        context.font = `500 60px ${font}`; context.fillText(lines[3], 512, 447)
        board.signature = signature; board.texture.needsUpdate = true; invalidate()
      }
      if (table.status !== 'playing' && !lines[3] && !lines[1].startsWith('Bắt đầu sau')) clearInterval(interval)
    }
    draw()
    if (table.startsAt || table.readyDeadlineAt || table.status === 'playing') interval = setInterval(draw, 250)
    document.fonts?.ready.then(draw)
    return () => { cancelled = true; clearInterval(interval) }
  }, [table, turnMs, isDark, board, invalidate])
  useEffect(() => () => board.texture.dispose(), [board])
  return <mesh position={WALL_BOARD_POSITION} onUpdate={object => { object.updateMatrix(); object.matrixAutoUpdate = false }}>
    <planeGeometry args={WALL_BOARD_SIZE} /><meshBasicMaterial map={board.texture} />
  </mesh>
}
