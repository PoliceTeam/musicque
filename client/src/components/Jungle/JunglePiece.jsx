import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, useAnimations } from '@react-three/drei'
import { usePieceModel } from './jungleAssets'
import { DizzyStars } from './JungleEffects'
import { moveDuration, pieceWorld } from './jungleMotion'
import { SIDE_COLOR, easeInOut, isWater, jumpArc } from '../../utils/jungle'

const GREY = new THREE.Color(0.52, 0.52, 0.58)
const tmpColor = new THREE.Color()
const facingOf = (side) => (side === 'red' ? Math.PI : 0)

const lerpAngle = (from, to, t) => {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return from + delta * t
}

// Điều khiển clip của Cube Pets: crossfade, clip một lần thì tự về idle.
const useClips = (animations, root) => {
  const { actions, mixer } = useAnimations(animations, root)
  const current = useRef(null)
  const timer = useRef(null)
  const play = useCallback((name, { once = false, fade = 0.18, then = 'idle', speed = 1 } = {}) => {
    const next = actions[name]
    if (!next) return
    window.clearTimeout(timer.current)
    const previous = current.current
    next.reset()
    next.setEffectiveTimeScale(speed)
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity)
    next.clampWhenFinished = once
    next.fadeIn(fade).play()
    if (previous && previous !== next) previous.fadeOut(fade)
    current.current = next
    if (once && then) {
      const ms = (next.getClip().duration / speed) * 1000
      timer.current = window.setTimeout(() => play(then), Math.max(200, ms - fade * 1000))
    }
  }, [actions])
  useEffect(() => () => {
    window.clearTimeout(timer.current)
    mixer.stopAllAction()
  }, [mixer])
  return play
}

const RankBadge = ({ piece, height }) => (
  <Html center position={[0, height + 0.32, 0]} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
    <div className={`jg-badge is-${piece.side}${piece.weakened ? ' is-weak' : ''}`}>
      {piece.weakened ? <><s>{piece.rank}</s>0</> : piece.rank}
    </div>
  </Html>
)

export const JunglePiece = ({ piece, motion, selected, inspected, interactive, outcome, shakeKey, onSelect, onHover }) => {
  const model = usePieceModel(piece.type)
  const root = useRef()
  const body = useRef()
  const ring = useRef()
  const animRoot = useRef()
  const play = useClips(model.animations, animRoot)
  const position = useRef(null)
  const tween = useRef(null)
  const yaw = useRef(facingOf(piece.side))
  const shake = useRef(-1)
  const clock = useRef(0)

  useEffect(() => { play('idle', { fade: 0 }) }, [play])

  // Ô thay đổi: nếu đúng là nước vừa đi thì chạy tween, không thì đặt thẳng vào chỗ.
  useLayoutEffect(() => {
    const target = pieceWorld(piece.square)
    if (!position.current) {
      position.current = new THREE.Vector3(...target)
      root.current?.position.set(...target)
      return
    }
    if (motion && motion.to === piece.square) {
      tween.current = {
        from: pieceWorld(motion.from),
        to: target,
        start: clock.current,
        duration: moveDuration(motion) / 1000,
        jump: motion.jump,
        captures: Boolean(motion.captured),
      }
      play('run', { speed: motion.jump ? 0.9 : 1.25 })
    } else {
      tween.current = null
      position.current.set(...target)
    }
  }, [piece.square, motion, play])

  useEffect(() => {
    if (shakeKey) {
      shake.current = clock.current
      play('gesture-negative', { once: true, speed: 1.4 })
    }
  }, [shakeKey, play])

  useEffect(() => {
    if (outcome === 'win') play('dance')
    else if (outcome === 'lose') play('gesture-negative', { once: true })
  }, [outcome, play])

  useFrame((state, delta) => {
    clock.current = state.clock.elapsedTime
    const group = root.current
    const inner = body.current
    if (!group || !inner || !position.current) return
    const t = state.clock.elapsedTime
    let bob = 0
    let squash = 1
    let targetYaw = facingOf(piece.side)

    const active = tween.current
    if (active) {
      const raw = Math.min(1, (t - active.start) / active.duration)
      const k = active.jump ? raw : easeInOut(raw)
      const [x, y, z] = active.jump ? jumpArc(active.from, active.to, k, 1.7) : [
        active.from[0] + (active.to[0] - active.from[0]) * k,
        active.from[1] + (active.to[1] - active.from[1]) * k,
        active.from[2] + (active.to[2] - active.from[2]) * k,
      ]
      position.current.set(x, y, z)
      targetYaw = Math.atan2(active.to[0] - active.from[0], active.to[2] - active.from[2])
      if (active.jump) {
        // nhún lấy đà → vươn dài khi bay → nén khi chạm đất
        squash = raw < 0.12 ? 1 - 0.25 * Math.sin((raw / 0.12) * Math.PI) : raw > 0.9 ? 1 - 0.2 * Math.sin(((raw - 0.9) / 0.1) * Math.PI) : 1.12
      } else {
        bob = Math.abs(Math.sin(raw * Math.PI * 2)) * 0.06
      }
      if (raw >= 1) {
        tween.current = null
        position.current.set(...active.to)
        if (active.captures) play('eat', { once: true, speed: 1.3 })
        else play('idle')
      }
    } else if (isWater(piece.square)) {
      bob = Math.sin(t * 2.3 + piece.rank) * 0.025
    }
    if (selected && !active) bob += Math.abs(Math.sin(t * 5.5)) * 0.14

    group.position.set(position.current.x, position.current.y + bob, position.current.z)
    if (!active) yaw.current = lerpAngle(yaw.current, targetYaw, Math.min(1, delta * 6))
    else yaw.current = lerpAngle(yaw.current, targetYaw, Math.min(1, delta * 14))
    inner.rotation.y = yaw.current
    inner.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash))

    const shakeAge = t - shake.current
    inner.rotation.z = shake.current >= 0 && shakeAge < 0.55 ? Math.sin(shakeAge * 42) * 0.22 * (1 - shakeAge / 0.55) : 0

    // Quân trong hang địch nhạt và xám đi.
    const weakAmount = piece.weakened ? 0.75 : 0
    model.materials.forEach((material) => {
      tmpColor.copy(material.userData.baseColor).lerp(GREY, weakAmount)
      material.color.lerp(tmpColor, Math.min(1, delta * 5))
    })

    if (ring.current) {
      const pulse = selected || inspected ? 1.08 + Math.sin(t * 6) * 0.08 : 1
      ring.current.scale.setScalar(pulse)
      ring.current.material.opacity = selected || inspected ? 0.95 : 0.7
    }
  })

  const handleOver = (event) => {
    event.stopPropagation()
    onHover?.(piece.square)
    document.body.style.cursor = interactive ? 'pointer' : 'help'
  }
  const handleOut = () => {
    onHover?.(null)
    document.body.style.cursor = ''
  }

  return (
    <group ref={root}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} renderOrder={3}>
        <ringGeometry args={[0.34, 0.44, 40]} />
        <meshBasicMaterial color={selected ? '#ffd43b' : inspected ? '#ffffff' : SIDE_COLOR[piece.side]} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={body}>
        <group ref={animRoot} position={model.offset} scale={model.scale}>
          <primitive object={model.scene} />
        </group>
      </group>
      {piece.weakened && <DizzyStars height={model.height} />}
      <RankBadge piece={piece} height={model.height} />
      {/* Vùng bấm hình trụ: dễ trúng hơn bấm vào từng khối của model */}
      <mesh
        position={[0, model.height / 2, 0]}
        onClick={(event) => { event.stopPropagation(); onSelect?.(piece) }}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
      >
        <cylinderGeometry args={[0.42, 0.42, model.height + 0.1, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

// Quân vừa bị ăn: đứng lại một nhịp, lắc đầu, rồi xẹp và biến mất (Voi thì ngã nghiêng).
export const JungleGhost = ({ piece, delayMs, tip, onVanish, onDone }) => {
  const model = usePieceModel(piece.type)
  const root = useRef()
  const body = useRef()
  const animRoot = useRef()
  const play = useClips(model.animations, animRoot)
  const started = useRef(null)
  const vanished = useRef(false)
  const shook = useRef(false)
  const done = useRef(false)
  const world = pieceWorld(piece.square)
  const delay = delayMs / 1000

  useEffect(() => { play('idle', { fade: 0 }) }, [play])

  useFrame((state) => {
    if (started.current === null) started.current = state.clock.elapsedTime
    const age = state.clock.elapsedTime - started.current - delay
    const inner = body.current
    if (!inner || done.current) return
    if (age < 0) return
    if (!shook.current) {
      shook.current = true
      play('gesture-negative', { once: true, speed: 1.6, then: null })
    }
    const fall = tip ? Math.min(1, age / 0.45) : 0
    inner.rotation.z = easeInOut(fall) * (Math.PI / 2) * (piece.side === 'red' ? 1 : -1)
    const shrinkStart = tip ? 0.55 : 0.25
    const s = Math.max(0, 1 - Math.max(0, age - shrinkStart) / 0.3)
    inner.scale.set(s * (1 + (1 - s) * 0.4), s, s * (1 + (1 - s) * 0.4))
    inner.rotation.y = facingOf(piece.side) + (1 - s) * Math.PI * 1.5
    if (!vanished.current && age >= shrinkStart + 0.15) {
      vanished.current = true
      onVanish?.([world[0], world[1] + 0.3, world[2]], piece)
    }
    if (s <= 0) {
      done.current = true
      onDone?.()
    }
  })

  return (
    <group ref={root} position={world}>
      <group ref={body} rotation={[0, facingOf(piece.side), 0]}>
        <group ref={animRoot} position={model.offset} scale={model.scale}>
          <primitive object={model.scene} />
        </group>
      </group>
    </group>
  )
}

