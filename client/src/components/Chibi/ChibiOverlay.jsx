import React, { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const MODEL_URL = '/models/chibi.glb?v=fbx-reexport'
const CLIP_SWITCH_MS = 15_000
const CLIP_FADE_SEC = 0.45

/**
 * Re-exported from original FBX via Blender — character is ~1 unit tall.
 * (Sketchfab GLB had broken scale~100 transforms.)
 */
const MODEL_SCALE = 1.85

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

export default function ChibiOverlay() {
  return (
    <div
      className="chibi-overlay"
      aria-hidden="true"
      style={{
        position: 'fixed',
        right: 0,
        bottom: 0,
        height: '42vh',
        width: 'min(36vh, 320px)',
        zIndex: 1100,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 1.15, 3.4], fov: 30, near: 0.1, far: 100 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        onCreated={({ camera, gl }) => {
          camera.lookAt(0, 1.1, 0)
          gl.setClearColor(0x000000, 0)
        }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <ambientLight intensity={1} />
        <hemisphereLight intensity={0.7} color="#ffffff" groundColor="#888888" />
        <directionalLight position={[2.5, 4, 3]} intensity={1.45} />
        <directionalLight position={[-2.5, 2, 1]} intensity={0.55} />
        <Environment preset="city" environmentIntensity={0.25} />
        <Suspense fallback={null}>
          <ChibiModel />
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload(MODEL_URL)
