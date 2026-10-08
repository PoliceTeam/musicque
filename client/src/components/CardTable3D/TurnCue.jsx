import React, { useEffect, useMemo, useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { syncTableGameTimer } from '../../utils/tableGame'
import { turnColor, turnTiming } from './turn'
import './turn.css'
export default function TurnCue({ table, position, own, surfaceY, turnMs = 20000, firstPerson }) {
  const { camera, size, invalidate } = useThree()
  const arrow = useRef(), light = useRef(), edge = useRef()
  const projected = useMemo(() => new Vector3(), [])
  const sync = useMemo(() => syncTableGameTimer(table, table?.receivedAt ?? Date.now()), [table])
  const active = table?.status === 'playing' && position
  useEffect(() => {
    const update = () => {
      const color = turnColor(turnTiming(table, turnMs, Date.now(), sync).fraction)
      arrow.current?.material.color.set(color)
      light.current?.color.set(color)
      edge.current?.style.setProperty('--turn-color', color)
      invalidate()
    }
    update()
    if (!active) return undefined
    const interval = setInterval(update, 250)
    return () => clearInterval(interval)
  }, [active, table, turnMs, sync, invalidate])
  useFrame(() => {
    if (!edge.current || !position) return
    projected.set(position[0], 1.15, position[2]).project(camera)
    const outside = Math.abs(projected.x) > 0.85 || Math.abs(projected.y) > 0.75 || projected.z > 1
    edge.current.hidden = !active || own || !outside
    const inset = edge.current.offsetWidth / 2 + 12
    edge.current.style.left = `${Math.max(inset, Math.min(size.width - inset, (0.5 + projected.x * 0.5) * size.width))}px`
    edge.current.style.top = `${50 - Math.max(-0.72, Math.min(0.72, projected.y)) * 50}%`
    edge.current.textContent = `${projected.x < 0 ? '←' : '→'} Lượt: ${table?.seats[table.currentSeat]?.username || '—'}`
  })
  return <>
    {active && <group rotation={[0, Math.atan2(position[0], position[2]), 0]}>
      <mesh ref={arrow} position={[0, surfaceY + 0.006, 0.34]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.045, 0.085, 3]} /><meshBasicMaterial color='#4caf50' transparent opacity={0.85} depthWrite={false} /></mesh>
    </group>}
    {active && !own && <pointLight ref={light} position={[position[0], 1.6, position[2]]} color='#4caf50' intensity={0.6} distance={1.3} />}
    {firstPerson && <Html fullscreen calculatePosition={() => [size.width / 2, size.height / 2]} zIndexRange={[24, 0]} style={{ pointerEvents: 'none' }}><div ref={edge} className='card-table-turn-edge' hidden /></Html>}
  </>
}
