import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { tween } from './anim'
import { applyWorldPose, readWorldPose, worldPose } from './cardSpaces'
export default function Card3D({ deck, cardId, target: explicitTarget, position, rotation = 0, faceDown = false, scale = 1, tilt = 0, from, delay = 0, duration = 480, height = 0, reducedMotion = false, selected = false, onClick, dim = false, spaces, poseStore, poseId }) {
  const target = useMemo(() => explicitTarget || { position, rotation, faceUp: !faceDown, scale, tilt }, [explicitTarget, position, rotation, faceDown, scale, tilt])
  const ref = useRef(), motion = useRef(null)
  const [hovered, setHovered] = useState(false)
  const clone = useMemo(() => deck[cardId].clone(true), [deck, cardId])
  useEffect(() => () => { if (hovered) document.body.style.cursor = '' }, [hovered])
  useLayoutEffect(() => {
    const destination = { ...target, position: [...target.position], tilt: (target.tilt || 0) + (selected ? 0.08 : 0) }
    destination.position[1] += selected ? 0.03 : hovered ? 0.009 : 0
    const to = worldPose(destination, spaces)
    const initial = motion.current ? readWorldPose(ref.current) : poseStore?.current.get(from?.id || poseId) || worldPose(from || destination, spaces)
    motion.current = { sample: tween(initial, to, { duration: reducedMotion ? 0 : duration, height: reducedMotion ? 0 : height }), elapsed: reducedMotion || motion.current ? 0 : -delay, destination, to, duration: reducedMotion ? 0 : duration }
    applyWorldPose(ref.current, motion.current.sample(0))
  }, [target, from, delay, duration, height, selected, hovered, reducedMotion, spaces, poseStore, poseId])
  useFrame((_, delta) => {
    if (!motion.current || !ref.current) return
    const animation = motion.current
    animation.elapsed += delta * 1000
    const destination = worldPose(animation.destination, spaces)
    let pose = animation.sample(animation.elapsed)
    if (animation.elapsed < 0 && from?.space?.startsWith('seat:')) pose = poseStore?.current.get(from.id) || worldPose(from, spaces)
    else if (pose.done) pose = destination
    else {
      const progress = Math.max(0, Math.min(1, animation.elapsed / animation.duration))
      pose.position = pose.position.map((value, i) => value + (destination.position[i] - animation.to.position[i]) * progress)
    }
    applyWorldPose(ref.current, pose)
    if (poseStore && poseId) poseStore.current.set(poseId, readWorldPose(ref.current))
  })
  return <group ref={ref} onClick={onClick ? (event) => { event.stopPropagation(); onClick() } : undefined}
    onPointerOver={onClick ? (event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' } : undefined}
    onPointerOut={onClick ? () => { setHovered(false); document.body.style.cursor = '' } : undefined}>
    <primitive object={clone} dispose={null} />
    {(selected || hovered) && <mesh position={[0, 0, -0.0001]}><planeGeometry args={[0.064, 0.095]} /><meshBasicMaterial color='#72edb5' transparent opacity={0.55} side={2} depthWrite={false} /></mesh>}
    {dim && <mesh position={[0, 0, 0.0002]}><planeGeometry args={[0.058, 0.089]} /><meshBasicMaterial color='#26383d' transparent opacity={0.2} side={2} depthWrite={false} /></mesh>}
  </group>
}
