import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, MeshBasicMaterial, PlaneGeometry } from 'three'
import { sameCardTarget, tween } from './anim'
import { applyWorldPose, createPose, readWorldPose, worldPose } from './cardSpaces'
const glowGeometry = new PlaneGeometry(0.064, 0.095)
const glowMaterial = new MeshBasicMaterial({ color: '#72edb5', transparent: true, opacity: 0.55, side: DoubleSide, depthWrite: false })
const dimGeometry = new PlaneGeometry(0.058, 0.089)
const dimMaterial = new MeshBasicMaterial({ color: '#26383d', transparent: true, opacity: 0.2, side: DoubleSide, depthWrite: false })
export default function Card3D({ deck, cardId, target: explicitTarget, position, rotation = 0, faceDown = false, scale = 1, tilt = 0, from, delay = 0, duration = 480, height = 0, reducedMotion = false, selected = false, onClick, dim = false, spaces, poseStore, poseId }) {
  const target = useMemo(() => explicitTarget || { position, rotation, faceUp: !faceDown, scale, tilt }, [explicitTarget, position, rotation, faceDown, scale, tilt])
  const ref = useRef(), inner = useRef(), motion = useRef(null)
  const scratch = useMemo(() => ({ destination: createPose(), sample: createPose() }), [])
  const [hovered, setHovered] = useState(false)
  const clone = useMemo(() => deck[cardId].clone(true), [deck, cardId])
  useEffect(() => () => { if (hovered) document.body.style.cursor = '' }, [hovered])
  useLayoutEffect(() => () => {
    if (poseStore && poseId && inner.current) poseStore.current.set(poseId, readWorldPose(inner.current))
  }, [poseStore, poseId])
  useLayoutEffect(() => {
    if (sameCardTarget(motion.current?.target, target) && !(reducedMotion && !motion.current.done)) return
    if (poseStore && poseId && motion.current) poseStore.current.set(poseId, readWorldPose(inner.current))
    clone.traverse(mesh => { if (mesh.isMesh) mesh.renderOrder = target.order ?? 0 })
    const to = worldPose(target, spaces)
    const initial = motion.current ? readWorldPose(ref.current) : poseStore?.current.get(from?.id || poseId) || worldPose(from || target, spaces)
    const flip = Boolean(from && from.faceUp !== target.faceUp)
    motion.current = { sample: tween(initial, to, { duration: reducedMotion ? 0 : duration, height: reducedMotion ? 0 : height, flip }), elapsed: reducedMotion || motion.current ? 0 : -delay, target, from, to, duration: reducedMotion ? 0 : duration, height: reducedMotion ? 0 : height, flip, pending: !reducedMotion && !motion.current && delay > 0, done: false }
    applyWorldPose(ref.current, motion.current.sample(0, scratch.sample))
  }, [target, from, delay, duration, height, reducedMotion, spaces, poseStore, poseId, clone, scratch])
  useFrame((_, delta) => {
    const animation = motion.current
    const lift = selected ? 0.03 : hovered ? 0.01 : 0
    const lifting = inner.current && Math.abs(inner.current.position.y - lift) > 1e-5
    if ((!animation || animation.done) && !lifting) return
    if (lifting) {
      inner.current.position.y += (lift - inner.current.position.y) * (reducedMotion ? 1 : 1 - Math.exp(-20 * delta))
      if (Math.abs(inner.current.position.y - lift) <= 1e-5) inner.current.position.y = lift
    }
    if (!animation || animation.done || !ref.current) return
    animation.elapsed += delta * 1000
    const destination = worldPose(animation.target, spaces, scratch.destination)
    let pose = animation.sample(animation.elapsed, scratch.sample)
    if (animation.elapsed < 0 && animation.from?.space?.startsWith('seat:')) pose = worldPose(animation.from, spaces, scratch.sample)
    else if (animation.elapsed >= 0 && animation.pending) {
      animation.pending = false
      // The sampler owns this destination; keep it separate from the next frame's scratch.
      animation.to = { position: [...destination.position], quaternion: [...destination.quaternion], scale: destination.scale }
      animation.sample = tween(readWorldPose(ref.current), animation.to, { duration: animation.duration, height: animation.height, flip: animation.flip })
      animation.elapsed = 0
      pose = animation.sample(0, scratch.sample)
    } else if (pose.done) pose = destination
    else {
      const progress = Math.max(0, Math.min(1, animation.elapsed / animation.duration))
      for (let i = 0; i < 3; i++) pose.position[i] += (destination.position[i] - animation.to.position[i]) * progress
    }
    applyWorldPose(ref.current, pose)
    if (animation.elapsed >= animation.duration) {
      animation.done = true
      if (poseStore && poseId) poseStore.current.set(poseId, readWorldPose(inner.current))
    }
  })
  return <group ref={ref} onClick={onClick ? (event) => { event.stopPropagation(); onClick() } : undefined}
    onPointerOver={onClick ? (event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' } : undefined}
    onPointerOut={onClick ? () => { setHovered(false); document.body.style.cursor = '' } : undefined}>
    <group ref={inner}>
      <primitive object={clone} dispose={null} />
      <mesh visible={selected || hovered} position={[0, 0, -0.0001]} geometry={glowGeometry} material={glowMaterial} dispose={null} />
      <mesh visible={dim} position={[0, 0, 0.0002]} geometry={dimGeometry} material={dimMaterial} dispose={null} />
    </group>
  </group>
}
