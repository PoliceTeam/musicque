import React from 'react'
import atlas from './ui_atlas.json'

// Ảnh cắt từ atlas UI (bộ "Neon Dance — Assets v3"): phím, chữ chấm điểm, combo, chữ số, icon.
// Vẽ bằng background-position nên cả HUD chỉ tải một file PNG.
const URL = '/audition/atlas/ui_atlas.png'
const { w: AW, h: AH } = atlas.meta.size

const AtlasImg = ({ name, height, width, className = '', style, alt = '' }) => {
  const f = atlas.frames[name]?.frame
  if (!f) return null
  const s = height != null ? height / f.h : width / f.w
  return (
    <span
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : 'true'}
      className={`au-atlas ${className}`}
      style={{
        width: f.w * s,
        height: f.h * s,
        backgroundImage: `url(${URL})`,
        backgroundSize: `${AW * s}px ${AH * s}px`,
        backgroundPosition: `${-f.x * s}px ${-f.y * s}px`,
        ...style
      }}
    />
  )
}

export default AtlasImg
