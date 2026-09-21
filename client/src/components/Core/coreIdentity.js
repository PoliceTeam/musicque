export const CORE_PRESETS = [
  { id: 'polite-blue', name: 'Polite Blue', description: 'Xanh dương chủ đạo' },
  { id: 'polite-red', name: 'Polite Red', description: 'Đỏ nổi bật' },
  { id: 'polite-yellow', name: 'Polite Yellow', description: 'Vàng năng lượng' },
  { id: 'polite-green', name: 'Polite Green', description: 'Xanh lá tươi mới' },
]

const LEGACY_STYLE_MAP = {
  aurora: 'polite-blue',
  solar: 'polite-yellow',
  neon: 'polite-blue',
  ruby: 'polite-red',
  crystal: 'polite-blue',
}

export const isCoreActive = (core) =>
  Boolean(core?.active && core?.expiresAt && new Date(core.expiresAt).getTime() > Date.now())

export const getCoreClassName = (core, extra = '') => {
  if (!isCoreActive(core)) return extra.trim()
  return [
    'core-identity',
    `core-identity--${LEGACY_STYLE_MAP[core.style] || core.style || 'polite-blue'}`,
    `core-identity--${core.intensity || 'subtle'}`,
    core.motionEnabled === false ? 'core-identity--still' : '',
    extra,
  ]
    .filter(Boolean)
    .join(' ')
}
