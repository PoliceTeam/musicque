export const fanLayout = (count, { width = 0.058, height = 0.089, spacing = 0.015, maxSpread = 50 * Math.PI / 180, baseOrder = 1000 } = {}) => {
  if (!Number.isInteger(count) || count < 0 || count > 52) throw new RangeError('Invalid fan count')
  const step = count > 1 ? Math.min(0.11, maxSpread / (count - 1)) : 0
  const angles = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * step)
  let radius = 1.2 * height
  // Larger hands need a larger pivot radius to meet both index spacing and spread limits.
  for (let i = 1; i < count; i++) radius = Math.max(radius, (spacing + width / 2 * (Math.cos(angles[i]) - Math.cos(angles[i - 1]))) / (Math.sin(angles[i]) - Math.sin(angles[i - 1])) - height / 2 + 1e-9)
  return angles.map((angle, i) => ({ position: [radius * Math.sin(angle), radius * (Math.cos(angle) - 1), 0], rotation: -angle, angle, depth: i * 0.0005, order: baseOrder + i, radius }))
}
