import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useAnimationActivity } from './activity'
import { syncTableGameTimer } from '../../utils/tableGame'
import { turnColor, turnTiming } from './turn'

export default function TurnRing({ position, table, turnMs, reducedMotion }) {
  const group = useRef(), arc = useRef()
  const initial = useRef(position ? [position[0], position[1] + .003, position[2]] : [0, .788, 0])
  const target = useMemo(() => position ? new Vector3(position[0], position[1] + .003, position[2]) : null, [position])
  const activity = useAnimationActivity()
  const invalidate = useThree(state => state.invalidate)
  const sync = useMemo(() => syncTableGameTimer(table, table?.receivedAt ?? Date.now()), [table])
  useEffect(() => { activity.start() }, [activity, target])
  useEffect(() => {
    if (!target) return undefined
    const update = () => {
      const { fraction } = turnTiming(table, turnMs, Date.now(), sync)
      arc.current?.geometry.setDrawRange(0, Math.round(fraction * 128) * 6)
      arc.current?.material.color.set(turnColor(fraction))
      invalidate()
    }
    update()
    const interval = setInterval(update, 100)
    return () => clearInterval(interval)
  }, [target, table, turnMs, sync, invalidate])
  useFrame((_, delta) => {
    if (!group.current || !target) { activity.stop(); return }
    group.current.position.lerp(target, reducedMotion ? 1 : 1 - Math.exp(-12 * activity.step(delta)))
    if (group.current.position.distanceToSquared(target) < 1e-8) { group.current.position.copy(target); activity.stop() }
  })
  return position && <group ref={group} name='table-turn-ring' position={initial.current} rotation={[-Math.PI / 2, 0, 0]}>
    <mesh renderOrder={1}><circleGeometry args={[.17, 64]} /><meshBasicMaterial color='#122b26' transparent opacity={.8} depthWrite={false} /></mesh>
    <mesh renderOrder={2} position={[0, 0, .0005]}><ringGeometry args={[.12, .153, 128]} /><meshBasicMaterial color='#ffffff' transparent opacity={.22} depthWrite={false} /></mesh>
    <mesh renderOrder={3} ref={arc} position={[0, 0, .001]} rotation={[0, 0, Math.PI / 2]}><ringGeometry args={[.12, .153, 128]} /><meshBasicMaterial color='#4caf50' transparent depthWrite={false} /></mesh>
  </group>
}
