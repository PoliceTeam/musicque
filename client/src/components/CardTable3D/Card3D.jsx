import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { tween } from './anim'
export default function Card3D({ deck, cardId, target: explicitTarget, position, rotation = 0, faceDown = false, from, delay = 0, duration, height = 0, reducedMotion = false, selected = false, onClick, dim = false }) {
  const target = useMemo(() => explicitTarget || { position, rotation, faceUp: !faceDown }, [explicitTarget, position, rotation, faceDown])
  const ref = useRef()
  const motion = useRef(null)
  const [hovered, setHovered] = useState(false)
  const source = deck[cardId]
  const clone = useMemo(() => source.clone(true), [source])
  const glow = selected || hovered
  useEffect(() => () => { if (hovered) document.body.style.cursor = '' }, [hovered])
  useLayoutEffect(() => {
    const destination = { ...target, position: [...target.position], rotation: (target.rotation || 0) + (selected ? 0.12 : 0) }
    destination.position[1] += selected ? 0.045 : hovered ? 0.018 : 0
    const group = ref.current
    const initial = motion.current ? { position: group.position.toArray(), quaternion: group.quaternion.toArray(), scale: group.scale.x } : from || destination
    motion.current = { sample: tween(initial, destination, { duration: reducedMotion ? 0 : duration, height: reducedMotion ? 0 : height }), elapsed: reducedMotion ? 0 : -delay }
    const pose = motion.current.sample(0)
    group.position.fromArray(pose.position); group.quaternion.fromArray(pose.quaternion); group.scale.setScalar(pose.scale)
  }, [target, from, delay, duration, height, selected, hovered, reducedMotion])
  useFrame((_, delta) => {
    if (!motion.current || !ref.current) return
    motion.current.elapsed += delta * 1000
    const pose = motion.current.sample(motion.current.elapsed)
    ref.current.position.fromArray(pose.position)
    ref.current.quaternion.fromArray(pose.quaternion)
    ref.current.scale.setScalar(pose.scale)
  })
  return <group ref={ref} onClick={onClick ? (event) => { event.stopPropagation(); onClick() } : undefined}
    onPointerOver={onClick ? (event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' } : undefined}
    onPointerOut={onClick ? () => { setHovered(false); document.body.style.cursor = '' } : undefined}>
    <primitive object={clone} dispose={null} />
    {glow && <mesh position={[0, 0, -0.0001]}><planeGeometry args={[0.064, 0.095]} /><meshBasicMaterial color='#72edb5' transparent opacity={0.55} side={2} depthWrite={false} /></mesh>}
    {dim && <mesh position={[0, 0, 0.0002]}><planeGeometry args={[0.058, 0.089]} /><meshBasicMaterial color='#26383d' transparent opacity={0.2} side={2} depthWrite={false} /></mesh>}
  </group>
}
