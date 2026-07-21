import React, { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import ErrorBoundary from '../ErrorBoundary'

const MODEL_URL = '/models/chibi.glb?v=fbx-reexport'
const CLIP_SWITCH_MS = 15_000
const CLIP_FADE_SEC = 0.45

/**
 * Re-exported from original FBX via Blender — character is ~1 unit tall.
 * (Sketchfab GLB had broken scale~100 transforms.)
 */
const MODEL_SCALE = 1.2

function getOrderedClipNames(actions) {
  const names = Object.keys(actions || {})
  if (!names.length) return []

  return [...names].sort((a, b) => {
    const aKpop = a.toLowerCase().includes('kpop') ? 0 : 1
    const bKpop = b.toLowerCase().includes('kpop') ? 0 : 1
    return aKpop - bKpop
  })
}

function ChibiModel() {
  const { scene, animations } = useGLTF(MODEL_URL)
  const { actions, mixer } = useAnimations(animations, scene)

  useEffect(() => {
    scene.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow = false
      child.receiveShadow = false
      child.frustumCulled = false

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material]
      materials.forEach((mat) => {
        if (!mat) return
        mat.side = THREE.DoubleSide
        mat.transparent = false
        mat.depthWrite = true
        if ('metalness' in mat) mat.metalness = Math.min(mat.metalness ?? 0, 0.15)
        if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 0.6, 0.55)
        mat.needsUpdate = true
      })
    })
  }, [scene])

  useEffect(() => {
    const clipNames = getOrderedClipNames(actions)
    if (!clipNames.length) return undefined

    clipNames.forEach((name) => {
      const action = actions[name]
      if (!action) return
      action.enabled = true
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
    })

    let index = 0
    const first = actions[clipNames[index]]
    first.reset().fadeIn(CLIP_FADE_SEC).play()

    const timerId = window.setInterval(() => {
      const nextIndex = (index + 1) % clipNames.length
      const from = actions[clipNames[index]]
      const to = actions[clipNames[nextIndex]]
      if (!from || !to) return

      to.reset().play()
      from.crossFadeTo(to, CLIP_FADE_SEC, true)
      index = nextIndex
    }, CLIP_SWITCH_MS)

    return () => {
      window.clearInterval(timerId)
      mixer?.stopAllAction()
    }
  }, [actions, mixer])

  return (
    <group rotation={[0, 0, 0]} scale={MODEL_SCALE} position={[0, 0.28, 0]}>
      <primitive object={scene} />
    </group>
  )
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true
}

function ChibiCanvas() {
  return (
    <div
      className="chibi-overlay"
      aria-hidden="true"
      style={{
        position: 'fixed',
        right: 0,
        bottom: 0,
        height: '55vh',
        width: 'min(46vh, 420px)',
        // Dưới zIndexPopupBase của antd (1000) để không vẽ đè lên Modal/Drawer.
        zIndex: 900,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        dpr={[1, 1.75]}
        // fov là góc nhìn DỌC và cố định, nên chiều cao khung div KHÔNG đổi được
        // vùng nhìn — nó chỉ phóng to. Muốn model nhỏ đi thì phải lùi camera (z).
        // Lùi ra cũng nới vùng nhìn ngang, đủ chỗ cho tay chân khi nhảy.
        // Model cao 1.089 đơn vị; ở z=4.9 nó chiếm ~50% chiều cao khung.
        camera={{ position: [0, 1.44, 4.9], fov: 30, near: 0.1, far: 100 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        onCreated={({ camera, gl }) => {
          // Ngắm cao hơn tâm model để chân đứng sát đáy khung.
          camera.lookAt(0, 1.39, 0)
          gl.setClearColor(0x000000, 0)
        }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <ambientLight intensity={1} />
        <hemisphereLight intensity={0.7} color="#ffffff" groundColor="#888888" />
        <directionalLight position={[2.5, 4, 3]} intensity={1.45} />
        <directionalLight position={[-2.5, 2, 1]} intensity={0.55} />
        {/*
          Environment tải HDR từ CDN ngoài (raw.githack.com) và có thể bị chặn
          trong mạng nội bộ. Suspense RIÊNG để nó không giữ chân model: model
          hiện ngay, ánh sáng môi trường ghép vào sau nếu tải được.
        */}
        <Suspense fallback={null}>
          <Environment preset="city" environmentIntensity={0.25} />
        </Suspense>
        <Suspense fallback={null}>
          <ChibiModel />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default function ChibiOverlay() {
  // Người dùng bật "giảm chuyển động" thì bỏ hẳn, khỏi dựng WebGL context.
  if (prefersReducedMotion()) return null

  // <Canvas> đẩy cả lỗi lẫn suspend ra ngoài chính nó
  // ("if (error) throw error" / "if (block) throw block"), nên cần cả hai lớp:
  // ErrorBoundary để model/HDR hỏng không làm trắng trang, và Suspense để
  // promise thoát ra có chỗ đỡ thay vì dội lên tận gốc cây React.
  return (
    <ErrorBoundary label="ChibiOverlay">
      <Suspense fallback={null}>
        <ChibiCanvas />
      </Suspense>
    </ErrorBoundary>
  )
}
