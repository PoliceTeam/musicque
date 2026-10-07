import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
export const TABLE_MODEL_URLS = ['/models/deck-of-cards.glb?v=webp1', '/models/dinner-table.glb?v=webp1', '/models/chibi.glb']
const scenes = new Map()
export function useTableGLTF(url) {
  const data = useGLTF(url)
  return useMemo(() => { scenes.set(url, data.scene); return data }, [url, data])
}
export const clearTableAssets = () => {
  const disposed = new Set()
  const dispose = resource => { if (resource && !disposed.has(resource)) { disposed.add(resource); resource.dispose() } }
  for (const scene of scenes.values()) scene.traverse(node => {
    if (!node.isMesh) return
    dispose(node.geometry)
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      for (const value of Object.values(material)) if (value?.isTexture && !disposed.has(value)) { value.image?.close?.(); dispose(value) }
      dispose(material)
    }
  })
  scenes.clear()
  for (const url of TABLE_MODEL_URLS) useGLTF.clear(url)
}
