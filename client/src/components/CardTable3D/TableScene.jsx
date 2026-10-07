import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor, Stats } from '@react-three/drei'
import * as THREE from 'three'
import ErrorBoundary from '../ErrorBoundary'
import { AnimationActivity } from './AnimationActivity'
import { useAnimationActivity } from './activity'
import { clearTableAssets, releaseTextureImage, useTableGLTF } from './assets'
import SeatMarker from './SeatMarker'
import OfficeRoom from './OfficeRoom'
import { chairPlacement } from './chair'
function FixedCamera() {
  const base = useMemo(() => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(0, 1.15, 1.16), new THREE.Vector3(0, 0.785, -0.03), new THREE.Vector3(0, 1, 0))), [])
  const camera = useThree(state => state.camera)
  useLayoutEffect(() => { camera.position.set(0, 1.15, 1.16); camera.quaternion.copy(base); camera.updateMatrixWorld() }, [camera, base])
  return null
}
function TurnRing({ position, reducedMotion }) {
  const ref = useRef()
  const initialPosition = useRef(position ? [position[0], position[1] + 0.001, position[2]] : [0, 0.786, 0])
  const target = useMemo(() => position ? new THREE.Vector3(position[0], position[1] + 0.001, position[2]) : null, [position])
  const activity = useAnimationActivity()
  useEffect(() => { activity.start() }, [activity, target])
  useFrame((_, delta) => {
    if (!ref.current || !target) { activity.stop(); return }
    delta = activity.step(delta)
    ref.current.position.lerp(target, reducedMotion ? 1 : 1 - Math.exp(-12 * delta))
    ref.current.material.opacity = 0.75
    if (ref.current.position.distanceToSquared(target) < 1e-8) { ref.current.position.copy(target); activity.stop() }
  })
  return position && <mesh ref={ref} position={initialPosition.current} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.09, 0.097, 64]} /><meshBasicMaterial color='#72edb5' transparent depthWrite={false} /></mesh>
}
function TableSurface({ seats, currentSeat, userId, turnDeadlineAt, serverNow, firstPerson, children }) {
  const { scene } = useTableGLTF('/models/dinner-table.glb?v=webp1')
  const tableModel = useMemo(() => scene.clone(true), [scene])
  const dpr = useThree(state => state.viewport.dpr)
  useEffect(() => {
    if (dpr > 1) return
    tableModel.traverse(node => {
      for (const material of node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []) {
        if (material.normalMap) { releaseTextureImage(material.normalMap); material.normalMap.dispose(); material.normalMap = null; material.needsUpdate = true }
      }
    })
  }, [tableModel, dpr])
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
    return chairPlacement(relative).position
  }), [anchor, seatCount])
  const seatPositions = useMemo(() => characterPositions.map(([x, , z]) => [x * 0.6, surfaceY, z * 0.6]), [characterPositions, surfaceY])
  return <>
    {firstPerson && <FixedCamera />}
    <color attach='background' args={['#94a3a6']} />
    {firstPerson && <OfficeRoom />}
    <hemisphereLight intensity={1.8} color='#fff8ef' groundColor='#80766a' />
    <directionalLight position={[2, 4, 3]} color='#fff2dc' intensity={1.7} />
    <primitive object={tableModel} dispose={null} />
    {!firstPerson && seats.map((seat, i) => seat && <SeatMarker key={i} seat={seat} position={[seatPositions[i][0] * 1.2, surfaceY + 0.1, seatPositions[i][2] * 1.2]} active={currentSeat === i} turnDeadlineAt={turnDeadlineAt} serverNow={serverNow} />)}
    <TurnRing position={seatPositions[currentSeat]} own={mySeat === currentSeat} deadline={turnDeadlineAt} serverNow={serverNow} reducedMotion={reducedMotion} />
    {children({ surfaceY, seatPositions, characterPositions, anchor, reducedMotion, firstPerson })}
  </>
}
let supported3D
const canRender3D = () => {
  // Feature detection avoids creating a second GPU context just to probe support.
  supported3D ??= Boolean(window.WebGLRenderingContext || window.WebGL2RenderingContext)
  return supported3D
}
function RendererLifetime({ onContextLost }) {
  const gl = useThree(state => state.gl)
  useEffect(() => {
    let disposing = false
    const lost = event => { if (!disposing) { event.preventDefault(); onContextLost() } }
    gl.domElement.addEventListener('webglcontextlost', lost)
    if (import.meta.env.DEV) (window.__thirteenRenderers ||= new Set()).add(gl)
    return () => {
      disposing = true
      gl.domElement.removeEventListener('webglcontextlost', lost)
      if (import.meta.env.DEV) window.__thirteenRenderers?.delete(gl)
      gl.dispose()
      gl.forceContextLoss()
    }
  }, [gl, onContextLost])
  return null
}
export default function TableScene({ fallback, firstPerson = false, ...props }) {
  const [contextLost, setContextLost] = useState(false)
  const onContextLost = React.useCallback(() => setContextLost(true), [])
  useEffect(() => clearTableAssets, [])
  const [dpr, setDpr] = useState([1, 1.25])
  const showPerf = import.meta.env.DEV && new URLSearchParams(window.location.search).get('perf') === '1'
  const supported = useMemo(canRender3D, [])
  if (!supported) return fallback
  if (contextLost) return <div>{fallback}<button className='sp-btn' onClick={() => window.location.reload()}>Tải lại</button></div>
  return <ErrorBoundary label='CardTable3D' fallback={fallback}>
    <Suspense fallback={<div className='card-table-surface' role='status'>Đang tải bàn bài...</div>}>
      <div className='card-table-surface'>
        <Canvas frameloop='demand' dpr={dpr} gl={{ antialias: Math.min(window.devicePixelRatio || 1, 1.25) < 1.25, powerPreference: 'high-performance' }} camera={{ position: firstPerson ? [0, 1.15, 1.16] : [0, 1.6, 1.07], fov: firstPerson ? 75 : 40, near: 0.01, far: 10 }} onCreated={({ camera, gl }) => { gl.localClippingEnabled = true; camera.lookAt(0, 0.785, firstPerson ? -0.03 : 0.1) }}>
          <RendererLifetime onContextLost={onContextLost} />
          <PerformanceMonitor onDecline={() => setDpr(value => Array.isArray(value) ? 1 : 0.85)} onFallback={() => setDpr(0.85)} />
          {showPerf && firstPerson && <Stats className='card-table-stats' />}
          <AnimationActivity><TableSurface {...props} firstPerson={firstPerson} /></AnimationActivity>
        </Canvas>
      </div>
    </Suspense>
  </ErrorBoundary>
}
