import { Color } from 'three'
// Matches spotify.css surfaces, text and the single Spotify green accent.
export const roomPalettes = {
  light: { wall: '#f8f8f8', wallAccent: '#ddeee1', floorA: '#d9ccba', floorB: '#d0c1ac', rug: '#a9bab0', wood: '#766a5d', fabric: '#c9ceca', metal: '#555b58', glass: '#d3e7eb', plant: '#75987b', potted: '#c3b7a4', lampShade: '#e5e1d7', lampGlow: '#f5ebcb', logoTint: '#121212', fog: '#f5f5f5' },
  dark: { wall: '#181818', wallAccent: '#193424', floorA: '#564e42', floorB: '#4b443a', rug: '#34443b', wood: '#49413a', fabric: '#343a36', metal: '#242b28', glass: '#3c5961', plant: '#416b49', potted: '#615449', lampShade: '#4e5048', lampGlow: '#c0b28b', logoTint: '#ffffff', fog: '#121212' },
}
export function recolorRoom(geometry, paletteKeys, palette) {
  const color = geometry.attributes.color, keys = geometry.attributes.paletteKey, shades = geometry.attributes.shade
  const colors = paletteKeys.map(key => new Color(palette[key]))
  for (let i = 0; i < color.count; i++) {
    const value = colors[keys.getX(i)], shade = shades.getX(i)
    color.setXYZ(i, value.r * shade, value.g * shade, value.b * shade)
  }
  color.needsUpdate = true
}
