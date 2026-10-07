import { Box3, BoxGeometry, CircleGeometry, CylinderGeometry, ConeGeometry, Float32BufferAttribute, IcosahedronGeometry, Object3D } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { recolorRoom, roomPalettes } from './roomPalette'
export function buildOfficeRoom() {
  const parts = [], paletteKeys = [], bounds = []
  const add = (source, at, key, rotation = [0, 0, 0], name = key) => {
    const object = new Object3D(); object.position.fromArray(at); object.rotation.set(...rotation); object.updateMatrix()
    const geometry = source.index ? source.toNonIndexed() : source.clone(); source.dispose(); geometry.applyMatrix4(object.matrix)
    if (!paletteKeys.includes(key)) paletteKeys.push(key)
    const position = geometry.attributes.position, normal = geometry.attributes.normal
    const keys = new Float32Array(position.count).fill(paletteKeys.indexOf(key)), shades = new Float32Array(position.count)
    for (let i = 0; i < position.count; i++) {
      const seam = key.startsWith('wall') ? 0.82 + Math.min(1, Math.max(0, position.getY(i) / 0.25)) * 0.18 : 1
      shades[i] = seam * (normal.getY(i) < -0.5 ? 0.72 : 1)
    }
    geometry.setAttribute('paletteKey', new Float32BufferAttribute(keys, 1)); geometry.setAttribute('shade', new Float32BufferAttribute(shades, 1)); geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(position.count * 3), 3))
    bounds.push({ name, box: new Box3().setFromBufferAttribute(position) }); parts.push(geometry)
  }
  const box = (size, at, key, name) => add(new BoxGeometry(...size), at, key, undefined, name)
  const cylinder = (radius, height, at, key, rotation, name) => add(new CylinderGeometry(radius, radius, height, 12), at, key, rotation, name)
  for (const [height, y] of [[0.25, 0.125], [2.55, 1.525]]) {
    box([6, height, 0.1], [0, y, -2.95], 'wall')
    for (const x of [-2.95, 2.95]) box([0.1, height, 6], [x, y, 0], 'wall')
  }
  // The upper drag limit exposes the top edge; this flat cap stays in the merged draw.
  add(new BoxGeometry(6, 0.02, 6), [0, 2.79, 0], 'wall', undefined, 'ceiling')
  box([2.7, 1.4, 0.025], [0, 1.95, -2.88], 'wallAccent')
  for (let i = 0; i < 12; i++) box([0.5, 0.02, 6], [-2.75 + i * 0.5, -0.01, 0], i % 2 ? 'floorA' : 'floorB', 'floor')
  add(new CircleGeometry(1.55, 48), [0, 0.0005, 0], 'rug', [-Math.PI / 2, 0, 0], 'rug')
  box([1.05, 0.06, 0.3], [1.8, 1.05, -2.7], 'wood')
  for (let i = 0; i < 4; i++) cylinder(0.14, 0.018, [1.45 + i * 0.22, 1.22, -2.72], 'metal', [Math.PI / 2, 0, 0])
  // Quiet wall areas behind side faces; window and tall props sit nearer the front corners.
  box([0.035, 1.1, 1.7], [-2.875, 1.9, 0.7], 'wood')
  for (const y of [1.65, 2.15]) for (const z of [0.3, 1.1]) box([0.04, 0.46, 0.74], [-2.85, y, z], 'glass')
  add(new RoundedBoxGeometry(0.65, 0.26, 1.65, 1, 0.055), [-2.48, 0.28, -1.05], 'fabric')
  add(new RoundedBoxGeometry(0.15, 0.58, 1.7, 1, 0.04), [-2.78, 0.53, -1.05], 'fabric')
  for (const z of [-1.83, -0.27]) box([0.7, 0.25, 0.12], [-2.48, 0.51, z], 'fabric')
  for (const z of [-1.43, -0.68]) add(new RoundedBoxGeometry(0.54, 0.1, 0.68, 1, 0.035), [-2.39, 0.45, z], 'fabric')
  box([0.48, 0.05, 0.48], [-2.35, 0.5, 0.4], 'wood')
  box([0.12, 0.48, 0.12], [-2.35, 0.24, 0.4], 'metal')
  cylinder(0.19, 0.3, [-2.68, 0.15, -0.06], 'potted')
  for (let i = 0; i < 3; i++) add(new IcosahedronGeometry(0.2, 0), [-2.62 + (i - 1) * 0.1, 0.57 + i * 0.1, -0.06], 'plant')
  box([0.65, 0.85, 1.8], [2.52, 0.425, -1.2], 'fabric')
  box([0.72, 0.06, 1.9], [2.5, 0.88, -1.2], 'wood')
  box([0.35, 0.42, 0.36], [2.47, 1.12, -0.65], 'metal')
  box([0.02, 0.2, 0.22], [2.28, 1.15, -0.65], 'glass')
  cylinder(0.025, 0.035, [2.27, 1.2, -0.65], 'metal', [0, 0, Math.PI / 2])
  cylinder(0.065, 0.1, [2.3, 0.98, -1.05], 'lampShade')
  cylinder(0.065, 0.1, [2.3, 0.98, -1.3], 'lampShade')
  for (const z of [-1.6, -0.7]) {
    cylinder(0.012, 0.45, [2.45, 2.5, z], 'metal')
    add(new ConeGeometry(0.22, 0.18, 12), [2.45, 2.19, z], 'lampShade')
    cylinder(0.18, 0.015, [2.45, 2.1, z], 'lampGlow')
  }
  box([0.38, 1.05, 0.4], [2.55, 0.525, 0.35], 'metal')
  for (const y of [0.3, 0.75]) add(new CircleGeometry(0.12, 12), [2.35, y, 0.35], 'wood', [0, -Math.PI / 2, 0])
  const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose())
  recolorRoom(geometry, paletteKeys, roomPalettes.light)
  return { geometry, paletteKeys, bounds }
}
