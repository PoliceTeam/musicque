import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Euler, Raycaster, Vector2, Vector3 } from 'three'
import { useAnimationActivity } from './activity'
import { clampDolly, clampLook, dampSpring, decayInertia, DEFAULT_PITCH, degreesPerPixel, isLookDrag, normalizeWheel, releaseVelocity, rubberBandYaw } from './dragLook'
export default function DragLookCamera({ reducedMotion }) {
  const { camera, gl, scene } = useThree()
  const activity = useAnimationActivity()
  const state = useRef({ yaw: 0, yawTarget: 0, yawVelocity: 0, inertia: 0, dragging: false, shake: Infinity, active: false, zoom: 0, zoomTarget: 0, zoomVelocity: 0 })
  const scratch = useMemo(() => ({ euler: new Euler(0, 0, 0, 'YXZ'), ray: new Raycaster(), pointer: new Vector2(), forward: new Vector3() }), [])
  useLayoutEffect(() => { camera.position.set(0, 1.15, 1.16); camera.quaternion.setFromEuler(scratch.euler.set(DEFAULT_PITCH, 0, 0)); camera.updateWorldMatrix(true, false) }, [camera, scratch])
  useEffect(() => {
    const canvas = gl.domElement, currentState = state.current
    let candidate = null, suppressUntil = 0
    const start = () => { if (!state.current.active) { state.current.active = true; activity.start() } }
    const reset = () => {
      if (candidate?.dragging && canvas.hasPointerCapture(candidate.id)) canvas.releasePointerCapture(candidate.id)
      candidate = null
      const current = state.current
      current.yawTarget = 0; current.zoomTarget = 0; current.inertia = 0; current.dragging = false
      start()
    }
    const wheel = event => {
      event.preventDefault()
      state.current.zoomTarget = clampDolly(state.current.zoomTarget - normalizeWheel(event, canvas.clientHeight) * 0.0006)
      start()
    }
    const down = event => {
      if (event.button !== 0) return
      const current = state.current
      current.inertia = 0
      candidate = { id: event.pointerId, x: event.clientX, yaw: current.yawTarget, rawYaw: current.yawTarget, radiansPerPixel: degreesPerPixel(camera.fov, camera.aspect, canvas.clientWidth) * Math.PI / 180, dragging: false, samples: [{ time: event.timeStamp, yaw: current.yawTarget }] }
    }
    const move = event => {
      if (!candidate || candidate.id !== event.pointerId) return
      const coalesced = event.getCoalescedEvents?.()
      for (const sample of coalesced?.length ? coalesced : [event]) {
        const dx = sample.clientX - candidate.x
        if (!candidate.dragging && !isLookDrag(dx)) continue
        if (!candidate.dragging) { candidate.dragging = true; state.current.dragging = true; canvas.setPointerCapture(event.pointerId) }
        candidate.rawYaw = candidate.yaw + dx * candidate.radiansPerPixel
        state.current.yawTarget = rubberBandYaw(candidate.rawYaw)
        candidate.samples.push({ time: sample.timeStamp, yaw: state.current.yawTarget })
        candidate.samples = candidate.samples.filter(point => point.time >= sample.timeStamp - 80)
      }
      if (!candidate.dragging) return
      event.preventDefault(); event.stopImmediatePropagation()
      start()
    }
    const up = event => {
      if (!candidate || candidate.id !== event.pointerId) return
      if (candidate.dragging) {
        suppressUntil = performance.now() + 250
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
        candidate.samples.push({ time: event.timeStamp, yaw: state.current.yawTarget })
        state.current.dragging = false
        state.current.inertia = reducedMotion || event.type === 'pointercancel' ? 0 : releaseVelocity(candidate.samples, event.timeStamp)
        // A held edge returns to its hard limit without ever exceeding 30 degrees.
        state.current.yawTarget = clampLook(candidate.rawYaw).yaw
        event.preventDefault(); event.stopImmediatePropagation()
        start()
      }
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
    canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('pointerdown', down, true); window.addEventListener('pointermove', move, true); canvas.addEventListener('click', click, true); canvas.addEventListener('dblclick', doubleClick, true)
    window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true)
    window.addEventListener('card-table:reset-view', reset); window.addEventListener('card-table:bomb', bomb)
    return () => {
      if (candidate?.dragging && canvas.hasPointerCapture(candidate.id)) canvas.releasePointerCapture(candidate.id)
      canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('pointerdown', down, true); window.removeEventListener('pointermove', move, true); canvas.removeEventListener('click', click, true); canvas.removeEventListener('dblclick', doubleClick, true)
      window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true)
      window.removeEventListener('card-table:reset-view', reset); window.removeEventListener('card-table:bomb', bomb)
      currentState.active = false; activity.stop()
    }
  }, [activity, camera, gl, scene, scratch, reducedMotion])
  useFrame((_, delta) => {
    const current = state.current
    if (!current.active) return
    delta = activity.step(delta)
    if (!current.dragging && current.inertia) {
      const next = decayInertia(current.inertia, delta)
      const target = current.yawTarget + next.distance
      current.yawTarget = clampLook(target).yaw
      current.inertia = Math.abs(next.velocity) < 0.001 || target !== current.yawTarget ? 0 : next.velocity
    }
    const yaw = reducedMotion ? { value: current.yawTarget, velocity: 0 } : dampSpring(current.yaw, current.yawVelocity, current.yawTarget, delta, 0.06)
    current.yaw = clampLook(yaw.value).yaw; current.yawVelocity = yaw.velocity
    if (Math.abs(current.yaw - current.yawTarget) < 1e-5 && Math.abs(current.yawVelocity) < 1e-4) { current.yaw = current.yawTarget; current.yawVelocity = 0 }
    const zoom = reducedMotion ? { value: current.zoomTarget, velocity: 0 } : dampSpring(current.zoom, current.zoomVelocity, current.zoomTarget, delta)
    current.zoom = clampDolly(zoom.value); current.zoomVelocity = zoom.velocity
    if (Math.abs(current.zoom - current.zoomTarget) < 1e-5 && Math.abs(current.zoomVelocity) < 1e-4) { current.zoom = current.zoomTarget; current.zoomVelocity = 0 }
    scratch.forward.set(0, 0, -1).applyEuler(scratch.euler.set(DEFAULT_PITCH, current.yaw, 0))
    camera.position.set(0, 1.15, 1.16).addScaledVector(scratch.forward, current.zoom)
    current.shake += delta * 1000
    const shaking = current.shake < 250, decay = shaking ? 1 - current.shake / 250 : 0
    const pitchShake = shaking ? Math.sin(current.shake * 0.08) * 0.008 * decay : 0
    const yawShake = shaking ? Math.sin(current.shake * 0.11) * 0.012 * decay : 0
    camera.quaternion.setFromEuler(scratch.euler.set(DEFAULT_PITCH + pitchShake, clampLook(current.yaw + yawShake).yaw, 0))
    camera.updateWorldMatrix(true, false)
    if (!shaking && !current.inertia && current.zoom === current.zoomTarget && current.zoomVelocity === 0 && current.yaw === current.yawTarget && current.yawVelocity === 0) {
      current.active = false; activity.stop()
    }
  }, -2)
  return null
}
