import { Box3, Color, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { buildOfficeRoom } from './officeRoom'
import { recolorRoom, roomPalettes } from './roomPalette'
describe('stylized office room', () => {
  it('stays within the triangle and room bounds, away from the table and chairs', () => {
    const { geometry, bounds } = buildOfficeRoom()
    const bufferBytes = Object.values(geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0)
    expect(bufferBytes * 2 + 512 * 128 * 4).toBeLessThan(5 * 1024 * 1024)
    expect(geometry.attributes.position.count / 3).toBeLessThanOrEqual(6000)
    geometry.computeBoundingBox()
    expect(geometry.boundingBox.min.x).toBeGreaterThanOrEqual(-3.000001)
    expect(geometry.boundingBox.max.x).toBeLessThanOrEqual(3.000001)
    expect(geometry.boundingBox.min.z).toBeGreaterThanOrEqual(-3.000001)
    expect(geometry.boundingBox.max.z).toBeLessThanOrEqual(3.000001)
    expect(geometry.boundingBox.min.y).toBeGreaterThanOrEqual(-0.030001)
    expect(geometry.boundingBox.max.y).toBeLessThanOrEqual(2.800001)
    const playingFootprint = new Box3(new Vector3(-1.2, 0.05, -1.2), new Vector3(1.2, 1.6, 1.2))
    for (const { name, box } of bounds) {
      if (name.startsWith('pendant')) expect(box.min.y, name).toBeGreaterThan(1.45)
      else expect(box.intersectsBox(playingFootprint), name).toBe(false)
    }
    geometry.dispose()
  })
  it('adds a central pendant and limits emission to lamp surfaces', () => {
    const { geometry, paletteKeys, bounds } = buildOfficeRoom()
    expect(bounds.filter(part => part.name.startsWith('pendant'))).toHaveLength(3)
    const bulb = bounds.find(part => part.name === 'pendantBulb').box
    expect(bulb.getCenter(new Vector3()).x).toBeCloseTo(.55)
    expect(bulb.getCenter(new Vector3()).z).toBeCloseTo(-.25)
    const emission = geometry.attributes.lampEmission
    for (let i = 0; i < emission.count; i++) {
      const key = paletteKeys[geometry.attributes.paletteKey.getX(i)]
      expect(emission.getX(i)).toBeCloseTo(key === 'lampGlow' ? 1 : key === 'lampShade' ? .08 : 0)
    }
    geometry.dispose()
  })
  it('places two wall sconces and restricts their falloff to wall surfaces', () => {
    const { geometry, paletteKeys, bounds } = buildOfficeRoom()
    expect(bounds.filter(part => part.name === 'wallSconceBulb')).toHaveLength(2)
    for (let i = 0; i < geometry.attributes.wallSurface.count; i++) {
      const key = paletteKeys[geometry.attributes.paletteKey.getX(i)]
      expect(geometry.attributes.wallSurface.getX(i)).toBe(key.startsWith('wall') ? 1 : 0)
    }
    geometry.dispose()
  })
  it('recolours every palette index without rebuilding geometry', () => {
    const { geometry, paletteKeys } = buildOfficeRoom()
    const positions = geometry.attributes.position.array, colors = geometry.attributes.color.array
    for (const palette of Object.values(roomPalettes)) {
      for (const key of paletteKeys) expect(palette[key], key).toBeDefined()
      recolorRoom(geometry, paletteKeys, palette)
      for (let i = 0; i < geometry.attributes.color.count; i++) {
        const expected = new Color(palette[paletteKeys[geometry.attributes.paletteKey.getX(i)]]), shade = geometry.attributes.shade.getX(i)
        expect(geometry.attributes.color.getX(i)).toBeCloseTo(expected.r * shade)
        expect(geometry.attributes.color.getY(i)).toBeCloseTo(expected.g * shade)
        expect(geometry.attributes.color.getZ(i)).toBeCloseTo(expected.b * shade)
      }
      expect(geometry.attributes.position.array).toBe(positions)
      expect(geometry.attributes.color.array).toBe(colors)
    }
    geometry.dispose()
  })
})

it('preserves the SVG viewBox and reading direction, adding the missing E stem in both themes', async () => {
  const {readFileSync}=await import('node:fs')
  const {wallWordmarkSvg}=await import('./officeRoom')
  const source=readFileSync('public/brand/logo-wordmark.svg','utf8')
  for(const palette of Object.values(roomPalettes)) {
    const svg=wallWordmarkSvg(source,palette.logoTint)
    expect(svg).toContain('viewBox="-14 0 956 190"')
    expect(svg).toContain(`stroke="${palette.logoTint}"`)
    expect(svg).toContain('<path d="M825 30 L825 150"/>')
    expect(svg).not.toMatch(/scale\(-1/)
  }
})
