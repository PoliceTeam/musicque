import { animationTimeScale } from './anim'
import { createContext, useContext, useEffect, useMemo } from 'react'
export const AnimationContext = createContext(null)
const idle = { start() {}, stop() {}, step: delta => delta }
export const createAnimationActivity = (invalidate) => {
  const active = new Set(), listeners = new Set()
  if (import.meta.env.DEV) window.__thirteenActiveAnimations = active
  // Listeners hear only idle <-> moving transitions: stop() runs every frame and must stay cheap.
  const notify = () => listeners.forEach(listener => listener())
  return {
    start(key) { const idle = !active.size; active.add(key); invalidate(); if (idle) notify() },
    stop(key) { if (active.delete(key) && !active.size) notify() },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    tick() { if (active.size) invalidate() },
    get size() { return active.size },
  }
}

export function useAnimationActivity() {
  const activity = useContext(AnimationContext)
  const handle = useMemo(() => {
    if (!activity) return idle
    const key = Symbol('animation')
    let lastTime = performance.now()
    const timeScale = animationTimeScale()
    return {
      start() { lastTime = performance.now(); activity.start(key) },
      stop: () => activity.stop(key),
      step() { const now = performance.now(), delta = (now - lastTime) / 1000 / timeScale; lastTime = now; return delta },
    }
  }, [activity])
  useEffect(() => handle.stop, [handle])
  return handle
}
