import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { setCardFaceVisibility } from './assets'
import { useAnimationActivity } from './activity'
import { sameCardTarget, tween, motionTiming, easeInOutCubic } from './anim'
import { applyWorldPose, createPose, readWorldPose, worldPose, liftWorldPose, poseInSpace } from './cardSpaces'
import { playMetrics } from './cardMotion'
export default function Card3D({ deck, cardId, target: explicitTarget, position, rotation = 0, faceDown = false, scale = 1, tilt = 0, from, delay = 0, duration = 480, height = 0, reducedMotion = false, selected = false, onClick, dim = false, spaces, poseStore, poseId }) {
  const { glowGeometry, glowMaterial, dimGeometry, dimMaterial } = deck.overlays
  const target = useMemo(() => explicitTarget || { position, rotation, faceUp: !faceDown, scale, tilt }, [explicitTarget, position, rotation, faceDown, scale, tilt])
  const activity = useAnimationActivity()
  const ref = useRef(), inner = useRef(), motion = useRef(null)
  const scratch = useMemo(() => ({ destination: createPose(), sample: createPose(), world: createPose(), source: createPose() }), [])
  const [hovered, setHovered] = useState(false)
  useLayoutEffect(() => { activity.start() }, [activity, selected, hovered])
  const opaque = target.id?.startsWith('opaque:') || false
  const clone = useMemo(() => { const card = deck[cardId].clone(true); setCardFaceVisibility(card, opaque); return card }, [deck, cardId, opaque])
  useEffect(() => () => { if (hovered) document.body.style.cursor = '' }, [hovered])
  useLayoutEffect(() => () => {
    if (poseStore && poseId && inner.current) poseStore.current.set(poseId, readWorldPose(inner.current))
  }, [poseStore, poseId])
  useLayoutEffect(() => {
    if (sameCardTarget(motion.current?.target, target) && !(reducedMotion && !motion.current.done)) return
    if (poseStore && poseId && motion.current) poseStore.current.set(poseId, readWorldPose(inner.current))
    const cached = poseStore?.current.get(from?.id || poseId)
    const deferredInitial = !motion.current && !cached
    const initial = motion.current ? readWorldPose(ref.current) : cached || worldPose(from || target, spaces)
    const interrupted = motion.current && !motion.current.done
    const { wait, travel } = motionTiming(delay, duration, interrupted, reducedMotion)
    const stages = reducedMotion || interrupted ? [{ target, start: 0, duration: travel, kind: 'move', height: reducedMotion ? 0 : height }]
      : target.motion?.map(stage => ({ ...stage })) || [{ target, start: wait, duration: travel, height, kind: target.motionKind || 'move', flip: Boolean(from && from.faceUp !== target.faceUp), group: target.flightGroup }]
    const sourceSpace = from?.space || target.space || 'world'
    motion.current = { target, stages, elapsed: 0, index: -1, sourceSpace, sourceLocal: poseInSpace(initial, spaces, sourceSpace), from, initial, deferredInitial, interrupted, done: false }
    clone.traverse(mesh => { if (mesh.isMesh) mesh.renderOrder = target.order ?? 0 })
    activity.start(); applyWorldPose(ref.current, initial)
  }, [target, from, delay, duration, height, reducedMotion, spaces, poseStore, poseId, clone, scratch, activity])
  useFrame((_, delta) => {
    const animation = motion.current
    const lift = selected ? 0.03 : hovered ? 0.01 : 0
    const lifting = inner.current && Math.abs(inner.current.position.y - lift) > 1e-5
    if ((!animation || animation.done) && !lifting) { activity.stop(); return }
    if (animation?.deferredInitial) {
      const initial = worldPose(animation.from || animation.target, spaces, scratch.world)
      applyWorldPose(ref.current, initial)
      poseInSpace(initial, spaces, animation.sourceSpace, animation.sourceLocal)
      animation.deferredInitial = false; activity.start()
    }
    delta = activity.step(delta)
    if (lifting) {
      inner.current.position.y += (lift - inner.current.position.y) * (reducedMotion ? 1 : 1 - Math.exp(-20 * delta))
      if (Math.abs(inner.current.position.y - lift) <= 1e-5) inner.current.position.y = lift
    }
    if (!animation || animation.done || !ref.current) return
    animation.elapsed += delta * 1000
    let index = -1
    for (let i = 0; i < animation.stages.length; i++) if (animation.elapsed >= animation.stages[i].start) index = i
    if (index < 0) {
      if (animation.from?.zone === 'hand') {
        const pose = worldPose(animation.sourceLocal, spaces, scratch.world)
        liftWorldPose(pose, 0.02 * easeInOutCubic(Math.min(1, animation.elapsed / animation.stages[0].start)), animation.from.faceUp)
        applyWorldPose(ref.current, pose)
      }
      return
    }
    const stage = animation.stages[index]
    if (index !== animation.index) {
      if (animation.index < 0 && animation.from?.zone === 'hand' && stage.start > 0) {
        const released = worldPose(animation.sourceLocal, spaces, scratch.world)
        liftWorldPose(released, 0.02, animation.from.faceUp); applyWorldPose(ref.current, released)
      }
      const initial = readWorldPose(ref.current), previousSpace = index ? animation.stages[index - 1].target.space : animation.sourceSpace
      const local = stage.kind === 'fan' && previousSpace === stage.target.space
      const destination = local ? worldPose(stage.target, null) : worldPose(stage.target, spaces)
      const source = local ? poseInSpace(initial, spaces, stage.target.space) : initial
      let group
      if (stage.group) {
        const start = worldPose(stage.group.from, spaces), end = worldPose(stage.group.to, spaces)
        liftWorldPose(start, 0.02, stage.group.from.faceUp)
        group = { from: start.position, to: end.position }
      }
      if (stage.kind === 'play' && !animation.interrupted) {
        const metrics = playMetrics(group?.from || source.position, group?.to || destination.position)
        stage.duration = metrics.duration; stage.height = metrics.height
        for (let i = index + 1; i < animation.stages.length; i++) animation.stages[i].start = animation.stages[i - 1].start + animation.stages[i - 1].duration
      }
      animation.index = index; animation.local = local; animation.to = destination
      animation.sample = tween(source, destination, { duration: stage.duration, height: stage.height || 0, flip: stage.flip, slide: stage.kind === 'slide', group })
    }
    const elapsed = animation.elapsed - stage.start
    let pose = animation.sample(elapsed, scratch.sample)
    if (animation.local) { pose.space = stage.target.space; pose = worldPose(pose, spaces, scratch.world) }
    else {
      const destination = worldPose(stage.target, spaces, scratch.destination)
      if (pose.done) pose = destination
      else {
        const progress = Math.max(0, Math.min(1, elapsed / stage.duration))
        for (let i = 0; i < 3; i++) pose.position[i] += (destination.position[i] - animation.to.position[i]) * progress
      }
    }
    applyWorldPose(ref.current, pose)
    if (index === animation.stages.length - 1 && elapsed >= stage.duration) {
      animation.done = true
      if (poseStore && poseId) poseStore.current.set(poseId, readWorldPose(inner.current))
    }
  })
  return <group ref={ref} userData={{ card: true }} onClick={onClick ? (event) => { event.stopPropagation(); onClick() } : undefined}
    onPointerOver={onClick ? (event) => { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' } : undefined}
    onPointerOut={onClick ? () => { setHovered(false); document.body.style.cursor = '' } : undefined}>
    <group ref={inner}>
      <primitive object={clone} dispose={null} />
      <mesh visible={selected || hovered} position={[0, 0, -0.0001]} geometry={glowGeometry} material={glowMaterial} dispose={null} />
      <mesh visible={dim} position={[0, 0, 0.0002]} geometry={dimGeometry} material={dimMaterial} dispose={null} />
    </group>
  </group>
}
