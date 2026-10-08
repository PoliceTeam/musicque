import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'

const BURSTS = {
  capture: { count: 26, speed: 2.6, up: 2.8, size: 0.07, life: 0.9, gravity: 7, colors: ['#ffffff', '#ffd166', '#ff8fab'] },
  splash: { count: 22, speed: 1.4, up: 3.2, size: 0.06, life: 0.8, gravity: 9, colors: ['#bfe8ff', '#7cc8ff', '#ffffff'] },
  dust: { count: 16, speed: 1.5, up: 0.9, size: 0.07, life: 0.6, gravity: 2, colors: ['#e8d5b0', '#d9c39a', '#f5ead6'] },
  confetti: { count: 70, speed: 2.4, up: 5.5, size: 0.08, life: 2.4, gravity: 4, colors: ['#e5484d', '#3e7bfa', '#ffd166', '#06d6a0', '#ff8fab'] },
  sparkle: { count: 14, speed: 0.8, up: 1.6, size: 0.05, life: 0.9, gravity: 1, colors: ['#fff3b0', '#ffd166'] },
}

const tmp = new THREE.Object3D()
const tmpColor = new THREE.Color()

// Một chùm hạt bắn ra rồi rơi xuống, tự gọi onDone khi hết đời.
export const Burst = ({ kind = 'capture', position, tint, onDone }) => {
  const preset = BURSTS[kind] || BURSTS.capture
  const ref = useRef()
  const started = useRef(null)
  const particles = useMemo(() => Array.from({ length: preset.count }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = preset.speed * (0.4 + Math.random() * 0.8)
    return {
      v: [Math.cos(angle) * speed, preset.up * (0.5 + Math.random() * 0.7), Math.sin(angle) * speed],
      spin: [Math.random() * 8, Math.random() * 8],
      scale: preset.size * (0.6 + Math.random() * 0.8),
    }
  }), [preset])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const palette = tint ? [tint, ...preset.colors] : preset.colors
    particles.forEach((_, i) => mesh.setColorAt(i, tmpColor.set(palette[i % palette.length])))
    mesh.instanceColor.needsUpdate = true
  }, [particles, preset, tint])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    if (started.current === null) started.current = state.clock.elapsedTime
    const t = state.clock.elapsedTime - started.current
    if (t > preset.life) {
      onDone?.()
      return
    }
    const fade = 1 - t / preset.life
    particles.forEach((p, i) => {
      tmp.position.set(p.v[0] * t, p.v[1] * t - 0.5 * preset.gravity * t * t, p.v[2] * t)
      if (tmp.position.y < -0.05 && kind !== 'confetti') tmp.position.y = -0.05
      tmp.rotation.set(p.spin[0] * t, p.spin[1] * t, 0)
      tmp.scale.setScalar(p.scale * (kind === 'confetti' ? 1 : fade))
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={position}>
      <instancedMesh ref={ref} args={[null, null, particles.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, kind === 'confetti' ? 0.25 : 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

// Vòng sóng loang ra trên mặt nước.
export const Ripple = ({ position, delay = 0, period = 1.6, maxScale = 0.55, color = '#ffffff' }) => {
  const ref = useRef()
  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = ((state.clock.elapsedTime + delay) % period) / period
    const s = 0.12 + t * maxScale
    mesh.scale.set(s, s, s)
    mesh.material.opacity = 0.55 * (1 - t)
  })
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <ringGeometry args={[0.8, 1, 32]} />
      <meshBasicMaterial color={color} transparent depthWrite={false} />
    </mesh>
  )
}

// Chữ nổi lên rồi mờ dần (vd. "Chuột hạ Voi!").
export const FloatingText = ({ position, text, tone = 'gold', onDone, life = 1.6 }) => {
  const group = useRef()
  const started = useRef(null)
  const el = useRef()
  useFrame((state) => {
    if (started.current === null) started.current = state.clock.elapsedTime
    const t = (state.clock.elapsedTime - started.current) / life
    if (t >= 1) {
      onDone?.()
      return
    }
    if (group.current) group.current.position.y = position[1] + t * 0.9
    if (el.current) {
      el.current.style.opacity = String(t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.6) / 0.4))
      el.current.style.transform = `scale(${0.8 + Math.min(1, t * 5) * 0.25})`
    }
  })
  return (
    <group ref={group} position={position}>
      <Html center zIndexRange={[40, 30]} style={{ pointerEvents: 'none' }}>
        <div ref={el} className={`jg-float is-${tone}`}>{text}</div>
      </Html>
    </group>
  )
}

// Sao quay quanh đầu quân đang bị yếu trong hang địch.
export const DizzyStars = ({ height }) => {
  const ref = useRef()
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 2.4
  })
  return (
    <group ref={ref} position={[0, height + 0.08, 0]}>
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.22, Math.sin(angle * 2) * 0.03, Math.sin(angle) * 0.22]} scale={0.055}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color='#ffd43b' toneMapped={false} />
          </mesh>
        )
      })}
    </group>
  )
}
