export const STICKY_MARGIN = 12

export const snapStickyPosition = ({
  x,
  y,
  width,
  height,
  viewportWidth,
  viewportHeight,
  bottomInset = STICKY_MARGIN,
}) => {
  const maxX = Math.max(STICKY_MARGIN, viewportWidth - width - STICKY_MARGIN)
  const maxY = Math.max(STICKY_MARGIN, viewportHeight - height - bottomInset)
  const clampedX = Math.min(maxX, Math.max(STICKY_MARGIN, x))
  const clampedY = Math.min(maxY, Math.max(STICKY_MARGIN, y))
  const distances = {
    left: clampedX - STICKY_MARGIN,
    right: maxX - clampedX,
    bottom: maxY - clampedY,
  }
  const edge = Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0]

  if (edge === 'left') return { edge, x: STICKY_MARGIN, y: clampedY }
  if (edge === 'right') return { edge, x: maxX, y: clampedY }
  return { edge, x: clampedX, y: maxY }
}

export const restoreStickyPosition = (saved, dimensions) => {
  const { width, height, viewportWidth, viewportHeight, bottomInset } = dimensions
  const maxX = Math.max(STICKY_MARGIN, viewportWidth - width - STICKY_MARGIN)
  const maxY = Math.max(STICKY_MARGIN, viewportHeight - height - bottomInset)

  if (saved?.edge === 'left') return { edge: 'left', x: STICKY_MARGIN, y: Math.min(maxY, Math.max(STICKY_MARGIN, saved.y || STICKY_MARGIN)) }
  if (saved?.edge === 'right') return { edge: 'right', x: maxX, y: Math.min(maxY, Math.max(STICKY_MARGIN, saved.y || STICKY_MARGIN)) }
  if (saved?.edge === 'bottom') return { edge: 'bottom', x: Math.min(maxX, Math.max(STICKY_MARGIN, saved.x || STICKY_MARGIN)), y: maxY }

  return { edge: 'bottom', x: Math.round((viewportWidth - width) / 2), y: maxY }
}
