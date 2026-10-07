import React, { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import ErrorBoundary from '../ErrorBoundary'
import { cardNodeName } from '../../utils/thirteen'
import ThirteenFallback2D from './ThirteenFallback2D'
function Card({ source, position, rotation = 0, faceDown = false, onClick }) {
  const ref = useRef()
  const clone = useMemo(() => source.clone(true), [source])
  useFrame((_, delta) => {
    if (ref.current) {
      const alpha = 1 - Math.exp(-12 * delta)
      ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, position[0], alpha)
      ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, position[1], alpha)
      ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, position[2], alpha)
    }
  })
  return <group ref={ref} position={[position[0], position[1] + 0.025, position[2]]} rotation={[faceDown ? Math.PI / 2 : -Math.PI / 2, 0, rotation]} onClick={onClick ? (event) => { event.stopPropagation(); onClick() } : undefined}>
    <primitive object={clone} dispose={null} />
  </group>
}
function TableScene({ table, myHand, selectedCards, toggleCard, userId }) {
  const { scene } = useGLTF('/models/deck-of-cards.glb')
  const { scene: tableScene } = useGLTF('/models/dinner-table.glb')
  const tableModel = useMemo(() => tableScene.clone(true), [tableScene])
  const surfaceY = useMemo(() => {
    const bounds = new THREE.Box3().setFromObject(tableModel)
    const center = bounds.getCenter(new THREE.Vector3())
    const ray = new THREE.Raycaster(new THREE.Vector3(center.x, bounds.max.y + 1, center.z), new THREE.Vector3(0, -1, 0))
    return ray.intersectObject(tableModel, true)[0]?.point.y ?? bounds.max.y
  }, [tableModel])
  const templates = useMemo(() => {
    const result = {}
    for (const node of scene.children[0]?.children || scene.children) {
      if (!node.name.includes('_')) continue
      const clone = node.clone(true)
      clone.position.set(0, 0, 0)
      clone.scale.set(1, 1, 1)
      clone.updateMatrixWorld(true)
      const center = new THREE.Box3().setFromObject(clone).getCenter(new THREE.Vector3())
      clone.traverse((child) => {
        if (child.isMesh) {
          child.geometry = child.geometry.clone().translate(-center.x, -center.y, -center.z)
        }
      })
      clone.scale.setScalar(100)
      result[node.name] = clone
    }
    if (!result.Spade_Ace) throw new Error('Card meshes are missing')
    return result
  }, [scene])
  useEffect(() => () => Object.values(templates).forEach((node) => node.traverse((child) => { if (child.isMesh) child.geometry.dispose() })), [templates])
  const mySeat = userId ? table.seats.findIndex((s) => s?.userId === userId) : -1
  const anchor = mySeat >= 0 ? mySeat : 0
  const positions = [[0, 0.48], [-0.48, 0], [0, -0.48], [0.48, 0]]
  const back = templates.Spade_Ace
  return <>
    <color attach='background' args={['#94a3a6']} />
    <hemisphereLight intensity={1.8} color='#fff8ef' groundColor='#637275' />
    <directionalLight position={[2, 4, 3]} intensity={2} />
    <primitive object={tableModel} dispose={null} />
    {table.seats.map((seat, i) => {
      if (!seat) return null
      const relative = (i - anchor + 4) % 4
      const [x, z] = positions[relative]
      return <group key={i}>
        {relative !== 0 && Array.from({ length: Math.min(seat.handCount, 5) }, (_, j) => <Card key={j} source={back} position={[x + j * 0.004, surfaceY + 0.002 + j * 0.0006, z]} faceDown rotation={relative % 2 ? Math.PI / 2 : 0} />)}
        {table.currentSeat === i && <mesh position={[x, surfaceY + 0.001, z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.068, 0.073, 48]} /><meshBasicMaterial color='#77d9a0' transparent opacity={0.7} /></mesh>}
        <Html position={[x * 1.2, surfaceY + 0.045, z * 1.2]} center><div className={`thirteen-seat-label ${table.currentSeat === i ? 'is-turn' : ''}`}><strong>{seat.username}</strong><span>{seat.finishedPlace ? `Hạng ${seat.finishedPlace}` : `${seat.handCount} lá`}</span></div></Html>
      </group>
    })}
    {myHand.map((card, i) => {
      const offset = i - (myHand.length - 1) / 2
      return <Card key={card} source={templates[cardNodeName(card)]} position={[offset * 0.037, surfaceY + 0.002 + i * 0.0004 + (selectedCards.includes(card) ? 0.025 : 0), 0.44 - Math.abs(offset) * 0.004]} rotation={-offset * 0.028} onClick={() => toggleCard(card)} />
    })}
    {(table.trick?.cards || []).map((card, i, cards) => <Card key={`${table.version}-${card}`} source={templates[cardNodeName(card)]} position={[(i - (cards.length - 1) / 2) * 0.035, surfaceY + 0.003 + i * 0.0005, 0]} />)}
  </>
}
const canRender3D = () => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch { return false }
}
export default function ThirteenTable3D(props) {
  const supported = useMemo(canRender3D, [])
  useEffect(() => {
    if (supported) {
      useGLTF.preload('/models/deck-of-cards.glb')
      useGLTF.preload('/models/dinner-table.glb')
    }
  }, [supported])
  const fallback = <ThirteenFallback2D table={props.table} />
  if (!supported) return fallback
  return <ErrorBoundary label='ThirteenTable3D' fallback={fallback}>
    <Suspense fallback={fallback}>
      <div className='thirteen-surface'>
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.65, 1.32], fov: 48, near: 0.01, far: 10 }} onCreated={({ camera }) => camera.lookAt(0, 0.72, 0)}>
          <TableScene {...props} />
        </Canvas>
      </div>
    </Suspense>
  </ErrorBoundary>
}
