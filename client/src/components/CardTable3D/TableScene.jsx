import React, { Suspense, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import ErrorBoundary from '../ErrorBoundary'
import SeatMarker from './SeatMarker'
import './card-table.css'
function TableSurface({ seats, currentSeat, userId, children }) {
  const { scene } = useGLTF('/models/dinner-table.glb')
  const tableModel = useMemo(() => scene.clone(true), [scene])
  const surfaceY = useMemo(() => {
    const bounds = new THREE.Box3().setFromObject(tableModel)
    const center = bounds.getCenter(new THREE.Vector3())
    const ray = new THREE.Raycaster(new THREE.Vector3(center.x, bounds.max.y + 1, center.z), new THREE.Vector3(0, -1, 0))
    return ray.intersectObject(tableModel, true)[0]?.point.y ?? bounds.max.y
  }, [tableModel])
  const mySeat = userId ? seats.findIndex((s) => s?.userId === userId) : -1
  const anchor = mySeat >= 0 ? mySeat : 0
  const seatPositions = seats.map((_, i) => {
    const angle = ((i - anchor + seats.length) % seats.length) * Math.PI * 2 / seats.length
    return [-Math.sin(angle) * 0.48, surfaceY, Math.cos(angle) * 0.48]
  })
  return <>
    <color attach='background' args={['#94a3a6']} />
    <hemisphereLight intensity={1.8} color='#fff8ef' groundColor='#637275' />
    <directionalLight position={[2, 4, 3]} intensity={2} />
    <primitive object={tableModel} dispose={null} />
    {seats.map((seat, i) => seat && <SeatMarker key={i} seat={seat} position={seatPositions[i]} active={currentSeat === i} />)}
    {children({ surfaceY, seatPositions, anchor })}
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
export default function TableScene({ fallback, ...props }) {
  const supported = useMemo(canRender3D, [])
  useEffect(() => {
    if (supported) {
      useGLTF.preload('/models/deck-of-cards.glb')
      useGLTF.preload('/models/dinner-table.glb')
    }
  }, [supported])
  if (!supported) return fallback
  return <ErrorBoundary label='CardTable3D' fallback={fallback}>
    <Suspense fallback={fallback}>
      <div className='card-table-surface'>
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.65, 1.32], fov: 48, near: 0.01, far: 10 }} onCreated={({ camera }) => camera.lookAt(0, 0.72, 0)}>
          <TableSurface {...props} />
        </Canvas>
      </div>
    </Suspense>
  </ErrorBoundary>
}
