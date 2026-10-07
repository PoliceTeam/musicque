import { useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { PIECES } from '../../utils/jungle'

// Asset Kenney (CC0). Mỗi pack một thư mục vì texture của các pack trùng tên colormap.png.
const BASE = '/models/jungle'
export const PET_URLS = {
  koala: `${BASE}/pets/animal-koala.glb`,
  cat: `${BASE}/pets/animal-cat.glb`,
  dog: `${BASE}/pets/animal-dog.glb`,
  fox: `${BASE}/pets/animal-fox.glb`,
  tiger: `${BASE}/pets/animal-tiger.glb`,
  lion: `${BASE}/pets/animal-lion.glb`,
  elephant: `${BASE}/pets/animal-elephant.glb`,
}
export const SCENE_URLS = {
  tile: `${BASE}/td/tile.glb`,
  water: `${BASE}/td/snow-tile-dirt.glb`,
  trapTile: `${BASE}/td/tile-spawn.glb`,
  denTile: `${BASE}/td/tile-dirt.glb`,
  trap: `${BASE}/dungeon/trap.glb`,
  tent: `${BASE}/forest/tent.glb`,
  flag: `${BASE}/forest/flag.glb`,
  tree: `${BASE}/forest/tree.glb`,
  treeHigh: `${BASE}/forest/tree-high.glb`,
  rocksLow: `${BASE}/forest/rocks-low.glb`,
  stones: `${BASE}/forest/stones.glb`,
  plant: `${BASE}/forest/plant.glb`,
  grass: `${BASE}/forest/patch-grass.glb`,
  bush: `${BASE}/td/detail-tree.glb`,
  bushLarge: `${BASE}/td/detail-tree-large.glb`,
  pebbles: `${BASE}/td/detail-rocks.glb`,
  boulders: `${BASE}/td/detail-rocks-large.glb`,
  crystal: `${BASE}/td/detail-crystal.glb`,
}
export const iconUrl = (type) => `${BASE}/pets/${PIECES[type]?.icon || 'animal-cat.png'}`

export const preloadJungleAssets = () => {
  Object.values(PET_URLS).forEach((url) => useGLTF.preload(url))
  Object.values(SCENE_URLS).forEach((url) => useGLTF.preload(url))
}

// Kích thước quân theo cấp: Voi to nhất, Chuột nhỏ nhất (tính theo bề ngang, ô = 1).
const PIECE_SIZE = { rat: 0.56, cat: 0.6, dog: 0.63, wolf: 0.65, leopard: 0.67, tiger: 0.7, lion: 0.72, elephant: 0.8 }

// ---- Đổi màu texture cho các con vật mượn model ----

const rgbToHsl = (r, g, b) => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h / 6, s, l]
}
const hslToRgb = (h, s, l) => {
  if (s === 0) return [l, l, l]
  const hue = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3)]
}

const TINTS = {
  // Cáo cam → sói xám lạnh, giữ nguyên độ sáng tối để còn mặt mũi.
  wolf: (r, g, b) => {
    const [, s, l] = rgbToHsl(r, g, b)
    if (s < 0.25 || l < 0.12 || l > 0.92) return [r, g, b]
    const shade = 0.25 + l * 0.65
    return [shade * 0.92, shade * 0.95, shade * 1.05]
  },
  // Hổ cam → báo vàng óng, sọc đen giữ nguyên.
  leopard: (r, g, b) => {
    const [h, s, l] = rgbToHsl(r, g, b)
    if (s < 0.3 || l < 0.15 || h > 0.15) return [r, g, b]
    return hslToRgb(0.125, Math.min(1, s * 1.05), Math.min(0.75, l + 0.1))
  },
  // Koala xám → chuột nâu xám ấm hơn.
  rat: (r, g, b) => {
    const [, s, l] = rgbToHsl(r, g, b)
    if (s > 0.35 || l < 0.12 || l > 0.9) return [r, g, b]
    return [l * 1.08, l * 0.98, l * 0.9]
  },
}

const tintCache = new Map()
const tintedMap = (map, variant) => {
  const key = `${map.uuid}:${variant}`
  if (tintCache.has(key)) return tintCache.get(key)
  const image = map.image
  const width = image?.width
  const height = image?.height
  if (!width || !height || typeof document === 'undefined') return map
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0)
  const data = ctx.getImageData(0, 0, width, height)
  const px = data.data
  const fn = TINTS[variant]
  for (let i = 0; i < px.length; i += 4) {
    const [r, g, b] = fn(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255)
    px[i] = Math.max(0, Math.min(255, r * 255))
    px[i + 1] = Math.max(0, Math.min(255, g * 255))
    px[i + 2] = Math.max(0, Math.min(255, b * 255))
  }
  ctx.putImageData(data, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.flipY = map.flipY
  texture.colorSpace = map.colorSpace
  texture.magFilter = map.magFilter
  texture.minFilter = map.minFilter
  texture.wrapS = map.wrapS
  texture.wrapT = map.wrapT
  texture.needsUpdate = true
  tintCache.set(key, texture)
  return texture
}

// Bản sao model quân cờ: material riêng (để làm xám khi bị yếu), texture đổi màu nếu
// là con vật mượn model, và được chuẩn hoá: chân chạm y=0, tâm ở giữa ô, rộng theo cấp.
export const usePieceModel = (type) => {
  const meta = PIECES[type]
  const gltf = useGLTF(PET_URLS[meta.model])
  return useMemo(() => {
    const scene = gltf.scene.clone(true)
    const materials = []
    scene.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow = true
      child.receiveShadow = false
      const source = child.material
      const material = source.clone()
      if (meta.tint && material.map) material.map = tintedMap(source.map, meta.tint)
      material.userData.baseColor = material.color.clone()
      child.material = material
      materials.push(material)
    })
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = PIECE_SIZE[type] / Math.max(size.x, size.z)
    return {
      scene,
      materials,
      animations: gltf.animations,
      scale,
      offset: [-center.x * scale, -box.min.y * scale, -center.z * scale],
      height: size.y * scale,
    }
  }, [gltf, meta.tint, type])
}

// Bản sao tĩnh cho cảnh vật; `color` nhân thêm màu (dùng để tô nước, cờ theo phe).
export const useSceneModel = (key, { color, shadows = 'receive' } = {}) => {
  const gltf = useGLTF(SCENE_URLS[key])
  return useMemo(() => {
    const scene = gltf.scene.clone(true)
    scene.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow = shadows === 'cast' || shadows === 'both'
      child.receiveShadow = shadows === 'receive' || shadows === 'both'
      if (color) {
        child.material = child.material.clone()
        child.material.color = new THREE.Color(color)
      }
    })
    return { scene, animations: gltf.animations }
  }, [gltf, color, shadows])
}
