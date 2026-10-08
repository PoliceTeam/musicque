import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useTableGLTF } from './assets'
import * as THREE from 'three'
import { RANKS, SUITS, cardNodeName } from '../../utils/cards'
export const useDeck = () => {
  const { scene } = useTableGLTF('/models/deck-of-cards.glb?v=webp1')
  const gl = useThree(state => state.gl)
  const overlays = useMemo(() => ({
    glowGeometry: new THREE.PlaneGeometry(0.068, 0.099),
    selectionMaterial: new THREE.MeshBasicMaterial({ color: '#3d7dee', side: THREE.DoubleSide }),
    glowMaterial: new THREE.MeshBasicMaterial({ color: '#72edb5', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    dimGeometry: new THREE.PlaneGeometry(0.058, 0.089),
    dimMaterial: new THREE.MeshBasicMaterial({ color: '#26383d', transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
  }), [])
  useEffect(() => () => Object.values(overlays).forEach(resource => resource.dispose()), [overlays])
  const templates = useMemo(() => {
    const result = {}
    const materials = new Map()
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    const cheapMaterial = source => {
      if (!materials.has(source)) {
        if (source.map) source.map.anisotropy = anisotropy
        materials.set(source, new THREE.MeshLambertMaterial({ name: source.name, map: source.map, color: source.color, side: THREE.FrontSide }))
      }
      return materials.get(source)
    }
    for (const node of scene.children[0]?.children || scene.children) {
      if (!node.name.includes('_')) continue
      const clone = node.clone(true)
      clone.position.set(0, 0, 0)
      clone.scale.set(1, 1, 1)
      clone.updateMatrixWorld(true)
      const center = new THREE.Box3().setFromObject(clone).getCenter(new THREE.Vector3())
      clone.traverse((child) => {
        if (child.isMesh) {
          child.material = Array.isArray(child.material) ? child.material.map(cheapMaterial) : cheapMaterial(child.material)
          child.geometry = child.geometry.clone().translate(-center.x, -center.y, -center.z)
        }
      })
      clone.scale.setScalar(100)
      result[node.name] = clone
    }
    if (!result.Spade_Ace) throw new Error('Card meshes are missing')
    return result
  }, [scene, gl])
  useEffect(() => () => {
    const materials = new Set()
    Object.values(templates).forEach(node => node.traverse(child => {
      if (child.isMesh) { child.geometry.dispose(); (Array.isArray(child.material) ? child.material : [child.material]).forEach(material => materials.add(material)) }
    }))
    materials.forEach(material => material.dispose())
  }, [templates])
  return useMemo(() => ({ ...Object.fromEntries(RANKS.flatMap((rank) => SUITS.map((suit) => [rank + suit, templates[cardNodeName(rank + suit)]]))), overlays }), [templates, overlays])
}
