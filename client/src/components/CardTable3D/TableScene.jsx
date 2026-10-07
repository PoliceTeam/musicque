import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { PerformanceMonitor, Stats, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import ErrorBoundary from '../ErrorBoundary'
import SeatMarker from './SeatMarker'
function FixedCamera() {
  const base = useMemo(() => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(0, 1.15, 1.16), new THREE.Vector3(0, 0.785, -0.03), new THREE.Vector3(0, 1, 0))), [])
  useFrame(({ camera }) => { camera.position.set(0, 1.15, 1.16); camera.quaternion.copy(base); camera.updateMatrixWorld() }, -2)
  return null
}
function TurnRing({ position, own, deadline, serverNow, reducedMotion }) {
  const ref = useRef()
  const initialPosition = useRef(position ? [position[0], position[1] + 0.001, position[2]] : [0, 0.786, 0])
  const deadlineMs = useMemo(() => new Date(deadline).getTime(), [deadline])
  const offset = useMemo(() => Date.now() - serverNow, [serverNow])
  const target = useMemo(() => position ? new THREE.Vector3(position[0], position[1] + 0.001, position[2]) : null, [position])
  useFrame((_, delta) => {
    if (!ref.current || !target) return
    ref.current.position.lerp(target, reducedMotion ? 1 : 1 - Math.exp(-12 * delta))
    const urgent = own && deadlineMs - Date.now() + offset < 5000
    ref.current.material.opacity = urgent && !reducedMotion ? 0.6 + Math.sin(Date.now() / 130) * 0.3 : 0.75
  })
  return position && <mesh ref={ref} position={initialPosition.current} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.09, 0.097, 64]} /><meshBasicMaterial color='#72edb5' transparent depthWrite={false} /></mesh>
}
function TableSurface({ seats, currentSeat, userId, turnDeadlineAt, serverNow, firstPerson, children }) {
  const { scene } = useGLTF('/models/dinner-table.glb?v=webp1')
  const tableModel = useMemo(() => scene.clone(true), [scene])
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false
  const surfaceY = useMemo(() => {
    const bounds = new THREE.Box3().setFromObject(tableModel)
    const center = bounds.getCenter(new THREE.Vector3())
    const ray = new THREE.Raycaster(new THREE.Vector3(center.x, bounds.max.y + 1, center.z), new THREE.Vector3(0, -1, 0))
    return ray.intersectObject(tableModel, true)[0]?.point.y ?? bounds.max.y
  }, [tableModel])
  const mySeat = userId ? seats.findIndex((s) => s?.userId === userId) : -1
  const anchor = mySeat >= 0 ? mySeat : 0
  const seatCount = seats.length
  const characterPositions = useMemo(() => Array.from({ length: seatCount }, (_, i) => {
    const relative = (i - anchor + seatCount) % seatCount
    const angle = seatCount === 4 ? [0, 100, 180, 260][relative] * Math.PI / 180 : relative * Math.PI * 2 / seatCount
    return [-Math.sin(angle) * 0.94, 0, Math.cos(angle) * 0.94]
  }), [anchor, seatCount])
  const seatPositions = useMemo(() => characterPositions.map(([x, , z]) => [x * 0.6, surfaceY, z * 0.6]), [characterPositions, surfaceY])
  return <>
    {firstPerson && <FixedCamera />}
    <color attach='background' args={['#94a3a6']} />
    <hemisphereLight intensity={1.8} color='#fff8ef' groundColor='#637275' />
    <directionalLight position={[2, 4, 3]} intensity={2} />
    <primitive object={tableModel} dispose={null} />
    {!firstPerson && seats.map((seat, i) => seat && <SeatMarker key={i} seat={seat} position={[seatPositions[i][0] * 1.2, surfaceY + 0.1, seatPositions[i][2] * 1.2]} active={currentSeat === i} turnDeadlineAt={turnDeadlineAt} serverNow={serverNow} />)}
    <TurnRing position={seatPositions[currentSeat]} own={mySeat === currentSeat} deadline={turnDeadlineAt} serverNow={serverNow} reducedMotion={reducedMotion} />
    {children({ surfaceY, seatPositions, characterPositions, anchor, reducedMotion, firstPerson })}
  </>
}
const canRender3D = () => {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch { return false }
}
export default function TableScene({ fallback, firstPerson = false, ...props }) {
  const [dpr, setDpr] = useState([1, 1.5])
  const showPerf = import.meta.env.DEV && new URLSearchParams(window.location.search).get('perf') === '1'
  const supported = useMemo(canRender3D, [])
  useEffect(() => {
    if (supported) { useGLTF.preload('/models/deck-of-cards.glb?v=webp1'); useGLTF.preload('/models/dinner-table.glb?v=webp1'); if (firstPerson) useGLTF.preload('/models/chibi.glb') }
  }, [supported, firstPerson])
  if (!supported) return fallback
  return <ErrorBoundary label='CardTable3D' fallback={fallback}>
    <Suspense fallback={<div className='card-table-surface' role='status'>Đang tải bàn bài...</div>}>
      <div className='card-table-surface'>
        <Canvas dpr={dpr} gl={{ antialias: true, powerPreference: 'high-performance' }} camera={{ position: firstPerson ? [0, 1.15, 1.16] : [0, 1.6, 1.07], fov: firstPerson ? 55 : 40, near: 0.01, far: 10 }} onCreated={({ camera }) => camera.lookAt(0, 0.785, firstPerson ? -0.03 : 0.1)}>
          <PerformanceMonitor onDecline={() => setDpr(1)} onFallback={() => setDpr(1)} />
          {showPerf && firstPerson && <Stats className='card-table-stats' />}
          <TableSurface {...props} firstPerson={firstPerson} />
        </Canvas>
      </div>
    </Suspense>
  </ErrorBoundary>
}
