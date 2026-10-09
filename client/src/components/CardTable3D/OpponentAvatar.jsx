import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { disposeClonedSkeletons, useTableGLTF } from './assets'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { createCardPlayer, PLAYER_MODEL_URL, updatePlayerGrip } from './cardPlayer'
import { animationTimeScale, MOTION } from './anim'
import { useAnimationActivity } from './activity'
import SeatMarker from './SeatMarker'
import { CHAIR_HEIGHT } from './chair'
const AVATAR_SCALE = 0.85
export default function OpponentAvatar({ seat, seatIndex, position, active, playedKey, turnDeadlineAt, serverNow, turnMs, spaces, reducedMotion, message, serverOffset, phase: roomPhase = 'playing', dealTiming, dealDuration = 0, children }) {
  const { scene, animations } = useTableGLTF(PLAYER_MODEL_URL)
  const yaw = Math.atan2(-position[0], -position[2])
  const avatar = useMemo(() => {
    const model = clone(scene)
    const materials = new Map()
    let sharedSkeleton
    model.traverse((node) => {
      if (!node.isMesh) return
      if (node.isSkinnedMesh) {
        if (!sharedSkeleton) sharedSkeleton = node.skeleton
        else if (node.skeleton.bones.every((bone, i) => bone === sharedSkeleton.bones[i])) node.skeleton = sharedSkeleton
      }
      const tint = (material) => {
        // Match the existing Chibi overlay: exported BLEND skin needs opaque depth writes.
        material.side = THREE.FrontSide
        material.transparent = false
        material.depthWrite = true
        material.needsUpdate = true
        if (material.name !== 'body') return material
        if (!materials.has(material)) {
          const outfit = material.clone()
          const color = new THREE.Color(seat.isBot ? '#9bb9ec' : '#b3d9c3')
          outfit.customProgramCacheKey = () => 'thirteen-outfit-v1'
          outfit.onBeforeCompile = (shader) => {
            shader.uniforms.outfitTint = { value: color }
            shader.fragmentShader = 'uniform vec3 outfitTint;\n' + shader.fragmentShader
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nfloat clothMask = step(0.35, diffuseColor.g - diffuseColor.b) * step(0.3, diffuseColor.r - diffuseColor.b);\ndiffuseColor.rgb = mix(diffuseColor.rgb, outfitTint * max(diffuseColor.r, diffuseColor.g), clothMask * 0.6);')
          }
          materials.set(material, outfit)
        }
        return materials.get(material)
      }
      node.material = Array.isArray(node.material) ? node.material.map(tint) : tint(node.material)
    })
    const player = createCardPlayer(model, animations)
    const rig = player.rig
    model.updateMatrixWorld(true)
    const hipY = rig.get('mixamorigHips').bone.getWorldPosition(new THREE.Vector3()).y
    let pelvisBottom = hipY
    const vertex = new THREE.Vector3()
    model.traverse(node => {
      if (node.isSkinnedMesh) {
        const hipsIndex = node.skeleton.bones.indexOf(rig.get('mixamorigHips').bone)
        const positions = node.geometry.attributes.position, indices = node.geometry.attributes.skinIndex, weights = node.geometry.attributes.skinWeight
        for (let i = 0; i < positions.count; i++) {
          let hipWeight = 0
          for (let j = 0; j < 4; j++) if (indices.getComponent(i, j) === hipsIndex) hipWeight += weights.getComponent(i, j)
          if (hipWeight < 0.5) continue
          vertex.fromBufferAttribute(positions, i); node.applyBoneTransform(i, vertex); node.localToWorld(vertex)
          pelvisBottom = Math.min(pelvisBottom, vertex.y)
        }
      }
    })
    model.traverse(node => {
      if (node.isSkinnedMesh) {
        node.computeBoundingSphere()
        // Conservative once-only bounds cover the seated-to-reach motion.
        node.boundingSphere.radius *= 2
      }
    })
    return { model, rig, player, hipOffset: CHAIR_HEIGHT - pelvisBottom * AVATAR_SCALE, materials: [...materials.values()] }
  }, [scene, animations, seat.isBot])
  const activity = useAnimationActivity()
  useEffect(() => { activity.start() }, [activity, playedKey, seat.passed, roomPhase, dealTiming])
  const initialized = useRef(false), lastPhase = useRef(roomPhase)
  const handAnchor = useMemo(() => new THREE.Group(), [])
  const playAnchor = useMemo(() => new THREE.Group(), [])
  const headAnchor = useRef()
  const elapsed = useRef(Infinity)
  const lastPlay = useRef(playedKey)
  const lastPassed = useRef(seat.passed), passElapsed = useRef(Infinity)
  const interrupted = useRef(null), wasMoving = useRef(false)
  const head = avatar.rig.get('mixamorigHead').bone
  spaces.current[`seat:${seatIndex}`] = handAnchor
  spaces.current[`play:${seatIndex}`] = playAnchor
  useEffect(() => () => { avatar.player.dispose(); disposeClonedSkeletons(avatar.model); avatar.materials.forEach(material => material.dispose()); delete spaces.current[`seat:${seatIndex}`]; delete spaces.current[`play:${seatIndex}`] }, [avatar, spaces, seatIndex])
  useFrame((_, delta) => {
    delta = activity.step(delta)
    if (playedKey !== lastPlay.current) {
      if (elapsed.current < avatar.player.duration) interrupted.current = { elapsed: 0, from: new Map([...avatar.rig].map(([name, { bone }]) => [name, { rotation: bone.quaternion.clone(), position: bone.position.clone() }])) }
      elapsed.current = playedKey ? 0 : Infinity
      lastPlay.current = playedKey
    }
    if (seat.passed !== lastPassed.current) { passElapsed.current = seat.passed ? 0 : Infinity; lastPassed.current = seat.passed }
    passElapsed.current += delta * 1000
    elapsed.current += delta * 1000
    const waiting = roomPhase !== 'playing'
    const phaseChanged = lastPhase.current !== roomPhase
    lastPhase.current = roomPhase
    const pickupTime = dealTiming?.startedAt == null ? Infinity : (performance.now() - dealTiming.startedAt) / animationTimeScale() - (dealDuration - 750)
    const dealing = Boolean(dealDuration && pickupTime < 400)
    const moving = !waiting && !reducedMotion && (elapsed.current < avatar.player.duration || dealing || interrupted.current)
    if (!moving && initialized.current && !wasMoving.current && !phaseChanged && passElapsed.current >= MOTION.pass) { activity.stop(); return }
    if (waiting || (dealing && pickupTime < 0 && !reducedMotion)) avatar.player.sample('CardWait')
    else if (dealing && !reducedMotion) avatar.player.sample('CardPickup', pickupTime / 1000)
    else if (elapsed.current < avatar.player.duration && !reducedMotion) avatar.player.sample('CardPlay', elapsed.current / 1000)
    else avatar.player.sample('CardHold')
    if (interrupted.current) {
      interrupted.current.elapsed += delta * 1000
      const progress = Math.min(1, interrupted.current.elapsed / MOTION.compress)
      for (const [name, from] of interrupted.current.from) {
        const bone = avatar.rig.get(name).bone
        bone.quaternion.slerpQuaternions(from.rotation, bone.quaternion, progress)
        bone.position.lerpVectors(from.position, bone.position, progress)
      }
      if (progress === 1 || reducedMotion) interrupted.current = null
    }
    wasMoving.current = Boolean(moving)
    initialized.current = true
    head.updateWorldMatrix(true, false)
    updatePlayerGrip(avatar.player.grips.Left, handAnchor)
    updatePlayerGrip(avatar.player.grips.Right, playAnchor)
    handAnchor.position.y -= !reducedMotion && passElapsed.current < MOTION.pass ? 0.03 * Math.sin(Math.PI * passElapsed.current / MOTION.pass) : 0
    handAnchor.updateWorldMatrix(true, false)
    if (headAnchor.current) { head.getWorldPosition(headAnchor.current.position); headAnchor.current.position.y += 0.49 }
  }, -1)
  return <>
    <group position={[position[0], avatar.hipOffset, position[2]]} rotation={[0, yaw, 0]} scale={AVATAR_SCALE}><primitive object={avatar.model} dispose={null} /></group>
    <primitive object={handAnchor}>{children}</primitive>
    <group ref={headAnchor}><SeatMarker phase={roomPhase} seat={seat} position={[0, 0, 0]} active={active} turnDeadlineAt={turnDeadlineAt} serverNow={serverNow} turnMs={turnMs} message={message} serverOffset={serverOffset} /></group>
  </>
}
