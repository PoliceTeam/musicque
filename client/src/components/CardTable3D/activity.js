import { createContext, useContext, useEffect, useMemo } from 'react'
export const AnimationContext = createContext(null)
const idle = { start() {}, stop() {}, step: delta => delta }
export const createAnimationActivity = (invalidate) => {
  const active = new Set()
  if (import.meta.env.DEV) window.__thirteenActiveAnimations = active
  return {
    start(key) { active.add(key); invalidate() },
    stop(key) { active.delete(key) },
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
    return {
      start() { lastTime = performance.now(); activity.start(key) },
      stop: () => activity.stop(key),
      step() { const now = performance.now(), delta = (now - lastTime) / 1000; lastTime = now; return delta },
    }
  }, [activity])
  useEffect(() => handle.stop, [handle])
  return handle
}
