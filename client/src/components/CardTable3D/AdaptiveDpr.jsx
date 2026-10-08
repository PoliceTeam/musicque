import React, { useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { AnimationContext } from './activity'
import { maxCanvasDpr, observeMotionDpr } from './dpr'

// Low DPR while something moves, full DPR for the resting frame. `onDpr` mirrors the value into
// the Canvas `dpr` prop: R3F re-applies that prop on every parent render and would undo setDpr.
export default function AdaptiveDpr({ onDpr }) {
  const activity = useContext(AnimationContext)
  const { size, setDpr } = useThree()
  // A slow GPU lowers only the full-DPR ceiling, never below 1; the motion DPR follows it.
  const [ceiling, setCeiling] = useState(2)
  const media = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)'), [])
  const [reducedMotion, setReducedMotion] = useState(Boolean(media?.matches))
  const [moving, setMoving] = useState(false)
  const fullDpr = Math.min(ceiling, maxCanvasDpr(size.width, size.height, window.devicePixelRatio || 1))
  useEffect(() => {
    if (!media) return undefined
    const change = () => setReducedMotion(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [media])
  useEffect(() => activity.subscribe(() => setMoving(activity.size > 0)), [activity])
  // setDpr resizes the drawing buffer and invalidates, so the next frame renders at the new density.
  useLayoutEffect(() => observeMotionDpr(activity, fullDpr, dpr => { setDpr(dpr); onDpr(dpr) }, reducedMotion), [activity, fullDpr, reducedMotion, setDpr, onDpr])
  // The monitor counts frames per 250 ms. On-demand idle redraws (turn countdown ~10/s) would read as
  // a slow GPU, so it only samples continuous motion.
  return moving && <PerformanceMonitor onDecline={() => setCeiling(value => Math.max(1, Math.min(value, 1.5)))} onFallback={() => setCeiling(1)} />
}
