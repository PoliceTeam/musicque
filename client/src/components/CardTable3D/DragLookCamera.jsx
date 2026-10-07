import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, Raycaster, Vector2 } from 'three'
import { useAnimationActivity } from './activity'
import { clampLook, DEFAULT_PITCH, isLookDrag } from './dragLook'
export default function DragLookCamera({ reducedMotion }) {
  const { camera, gl, scene } = useThree()
  const activity = useAnimationActivity()
  const state = useRef({ yaw: 0, pitch: DEFAULT_PITCH, target: { yaw: 0, pitch: DEFAULT_PITCH }, reset: null, shake: Infinity, active: false })
  const scratch = useMemo(() => ({ euler: new Euler(0, 0, 0, 'YXZ'), ray: new Raycaster(), pointer: new Vector2() }), [])
  useLayoutEffect(() => { camera.position.set(0, 1.15, 1.16); camera.quaternion.setFromEuler(scratch.euler.set(DEFAULT_PITCH, 0, 0)); camera.updateWorldMatrix(true, false) }, [camera, scratch])
  useEffect(() => {
    const canvas = gl.domElement
    let candidate = null, suppressUntil = 0
    const start = () => { if (!state.current.active) { state.current.active = true; activity.start() } }
    const reset = () => {
      const current = state.current
      current.reset = { yaw: current.yaw, pitch: current.pitch, elapsed: 0 }
      current.target = { yaw: 0, pitch: DEFAULT_PITCH }; start()
    }
    const down = event => {
      if (event.button !== 0) return
      candidate = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: state.current.target.yaw, pitch: state.current.target.pitch, dragging: false }
    }
    const move = event => {
      if (!candidate || candidate.id !== event.pointerId) return
      const dx = event.clientX - candidate.x
      if (!candidate.dragging && !isLookDrag(dx)) return
      if (!candidate.dragging) { candidate.dragging = true; canvas.setPointerCapture(event.pointerId) }
      event.preventDefault(); event.stopImmediatePropagation()
      state.current.reset = null
      state.current.target = clampLook(candidate.yaw - dx * 0.003)
      start()
    }
    const up = event => {
      if (!candidate || candidate.id !== event.pointerId) return
      if (candidate.dragging) { suppressUntil = performance.now() + 250; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId) }
      candidate = null
    }
    const click = event => { if (performance.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); suppressUntil = 0 } }
    const doubleClick = event => {
      if (performance.now() < suppressUntil) return
      const rect = canvas.getBoundingClientRect()
      scratch.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
      scratch.ray.setFromCamera(scratch.pointer, camera)
      let hit = scratch.ray.intersectObjects(scene.children, true)[0]?.object
      while (hit) { if (hit.userData.card) return; hit = hit.parent }
      reset()
    }
    const bomb = () => { if (!reducedMotion) { state.current.shake = 0; start() } }
    canvas.addEventListener('pointerdown', down, true); window.addEventListener('pointermove', move, true); canvas.addEventListener('click', click, true); canvas.addEventListener('dblclick', doubleClick, true)
    window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true)
    window.addEventListener('card-table:reset-view', reset); window.addEventListener('card-table:bomb', bomb)
    return () => {
      if (candidate?.dragging && canvas.hasPointerCapture(candidate.id)) canvas.releasePointerCapture(candidate.id)
      canvas.removeEventListener('pointerdown', down, true); window.removeEventListener('pointermove', move, true); canvas.removeEventListener('click', click, true); canvas.removeEventListener('dblclick', doubleClick, true)
      window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true)
      window.removeEventListener('card-table:reset-view', reset); window.removeEventListener('card-table:bomb', bomb)
    }
  }, [activity, camera, gl, scene, scratch, reducedMotion])
  useFrame((_, delta) => {
    const current = state.current
    if (!current.active) return
    delta = activity.step(delta)
    if (current.reset) {
      current.reset.elapsed += delta * 1000
      const progress = reducedMotion ? 1 : Math.min(1, current.reset.elapsed / 400), eased = 1 - (1 - progress) ** 3
      current.yaw = current.reset.yaw * (1 - eased)
      current.pitch = current.reset.pitch + (DEFAULT_PITCH - current.reset.pitch) * eased
      if (progress === 1) current.reset = null
    } else {
      const alpha = reducedMotion ? 1 : 1 - Math.exp(-delta / 0.12)
      current.yaw += (current.target.yaw - current.yaw) * alpha; current.pitch += (current.target.pitch - current.pitch) * alpha
    }
    current.shake += delta * 1000
    const shaking = current.shake < 250, decay = shaking ? 1 - current.shake / 250 : 0
    const pitchShake = shaking ? Math.sin(current.shake * 0.08) * 0.008 * decay : 0
    const yawShake = shaking ? Math.sin(current.shake * 0.11) * 0.012 * decay : 0
    camera.quaternion.setFromEuler(scratch.euler.set(current.pitch + pitchShake, current.yaw + yawShake, 0))
    camera.updateWorldMatrix(true, false)
    if (!current.reset && !shaking && Math.abs(current.yaw - current.target.yaw) < 1e-5 && Math.abs(current.pitch - current.target.pitch) < 1e-5) {
      current.yaw = current.target.yaw; current.pitch = current.target.pitch; current.active = false; activity.stop()
    }
  }, -2)
  return null
}
