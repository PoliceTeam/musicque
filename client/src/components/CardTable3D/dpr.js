export const PIXEL_BUDGET = 4_500_000
export function maxCanvasDpr(width, height, deviceDpr = 1) {
  return Math.min(deviceDpr, 2, Math.sqrt(PIXEL_BUDGET / Math.max(1, width * height)))
}

export function observeMotionDpr(activity, fullDpr, apply, reducedMotion = false) {
  let timeout, previous
  const change = dpr => { if (dpr !== previous) { previous = dpr; apply(dpr) } }
  const update = () => {
    clearTimeout(timeout)
    if (activity.size && !reducedMotion) change(Math.min(fullDpr, 1.25))
    else if (reducedMotion) change(fullDpr)
    else timeout = setTimeout(() => change(fullDpr), 150)
  }
  change(activity.size && !reducedMotion ? Math.min(fullDpr, 1.25) : fullDpr)
  const unsubscribe = activity.subscribe(update)
  return () => { clearTimeout(timeout); unsubscribe() }
}
