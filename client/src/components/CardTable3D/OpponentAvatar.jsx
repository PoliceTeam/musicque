import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTableGLTF } from './assets'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { blendPose, poses, poseTargets, prepareRig } from './poses'
import { useAnimationActivity } from './activity'
import SeatMarker from './SeatMarker'
import { CHAIR_HEIGHT } from './chair'
const AVATAR_SCALE = 0.85
export default function OpponentAvatar({ seat, seatIndex, position, active, playedKey, turnDeadlineAt, serverNow, turnMs, spaces, reducedMotion, children }) {
  const { scene } = useTableGLTF('/models/chibi.glb?v=1')
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
    const rig = prepareRig(model)
    model.updateMatrixWorld(true)
    const hipY = rig.get('mixamorigHips').bone.getWorldPosition(new THREE.Vector3()).y
    const hold = poseTargets(rig, poses.seated, poses.holdCards, poses.idle)
    blendPose(rig, hold, 1)
    model.updateMatrixWorld(true)
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
    // Extend the short chibi torso while keeping its pelvis on the physical chair.
    const spine = rig.get('mixamorigSpine').bone
    const spinePosition = spine.getWorldPosition(new THREE.Vector3())
    spinePosition.y += Math.max(0, 0.63 - (CHAIR_HEIGHT + (hipY - pelvisBottom) * AVATAR_SCALE)) / AVATAR_SCALE
    spine.position.copy(spine.parent.worldToLocal(spinePosition))
    model.updateMatrixWorld(true)
    model.traverse(node => {
      if (node.isSkinnedMesh) {
        node.computeBoundingSphere()
        // Conservative once-only bounds cover the seated-to-reach motion.
        node.boundingSphere.radius *= 2
      }
    })
    return { model, rig, hipOffset: CHAIR_HEIGHT - pelvisBottom * AVATAR_SCALE, hold, reach: poseTargets(rig, poses.seated, poses.holdCards, poses.idle, poses.reachPlay), materials: [...materials.values()] }
  }, [scene, seat.isBot])
  const activity = useAnimationActivity()
  useEffect(() => { activity.start() }, [activity, playedKey, seat.passed])
  const initialized = useRef(false)
  const handAnchor = useMemo(() => new THREE.Group(), [])
  const headAnchor = useRef()
  const elapsed = useRef(Infinity)
  const lastPlay = useRef(playedKey)
  const lastPassed = useRef(seat.passed), passElapsed = useRef(Infinity)
  const blending = useRef(false), lastReach = useRef(false)
  const head = avatar.rig.get('mixamorigHead').bone
  const hand = avatar.rig.get('mixamorigRightHand').bone
  const orientation = useMemo(() => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), [yaw])
  spaces.current[`seat:${seatIndex}`] = handAnchor
  useEffect(() => () => { avatar.materials.forEach(material => material.dispose()); delete spaces.current[`seat:${seatIndex}`] }, [avatar, spaces, seatIndex])
  useFrame((_, delta) => {
    delta = activity.step(delta)
    if (playedKey !== lastPlay.current) { if (playedKey) elapsed.current = 0; lastPlay.current = playedKey }
    if (seat.passed !== lastPassed.current) { passElapsed.current = seat.passed ? 0 : Infinity; lastPassed.current = seat.passed }
    passElapsed.current += delta * 1000
    elapsed.current += delta * 1000
    const reaching = elapsed.current < 650 && !reducedMotion
    const target = reaching ? avatar.reach : avatar.hold
    if (reaching !== lastReach.current) { blending.current = true; lastReach.current = reaching }
    const wasBlending = blending.current
    if (blending.current) blending.current = !blendPose(avatar.rig, target, reducedMotion ? 1 : 1 - Math.exp(-12 * delta))
    if (initialized.current && !reaching && !blending.current && !wasBlending && passElapsed.current >= 800) { activity.stop(); return }
    initialized.current = true
    hand.updateWorldMatrix(true, false)
    head.updateWorldMatrix(true, false)
    hand.getWorldPosition(handAnchor.position)
    handAnchor.position.y -= !reducedMotion && passElapsed.current < 800 ? 0.03 * Math.sin(Math.PI * passElapsed.current / 800) : 0
    handAnchor.quaternion.copy(orientation)
    handAnchor.updateWorldMatrix(true, false)
    if (headAnchor.current) { head.getWorldPosition(headAnchor.current.position); headAnchor.current.position.y += 0.49 }
  }, -1)
  return <>
    <group position={[position[0], avatar.hipOffset, position[2]]} rotation={[0, yaw, 0]} scale={AVATAR_SCALE}><primitive object={avatar.model} dispose={null} /></group>
    <primitive object={handAnchor}>{children}</primitive>
    <group ref={headAnchor}><SeatMarker seat={seat} position={[0, 0, 0]} active={active} turnDeadlineAt={turnDeadlineAt} serverNow={serverNow} turnMs={turnMs} /></group>
  </>
}
