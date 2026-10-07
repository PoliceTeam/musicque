import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RANKS, SUITS, cardNodeName } from '../../utils/cards'
export const useDeck = () => {
  const { scene } = useGLTF('/models/deck-of-cards.glb?v=webp1')
  const gl = useThree(state => state.gl)
  useEffect(() => {
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    scene.traverse(node => {
      if (!node.isMesh) return
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        const texture = material.map
        if (texture && texture.anisotropy !== anisotropy) { texture.anisotropy = anisotropy; texture.needsUpdate = true }
      }
    })
  }, [scene, gl])
  const templates = useMemo(() => {
    const result = {}
    for (const node of scene.children[0]?.children || scene.children) {
      if (!node.name.includes('_')) continue
      const clone = node.clone(true)
      clone.position.set(0, 0, 0)
      clone.scale.set(1, 1, 1)
      clone.updateMatrixWorld(true)
      const center = new THREE.Box3().setFromObject(clone).getCenter(new THREE.Vector3())
      clone.traverse((child) => {
        if (child.isMesh) {
          child.geometry = child.geometry.clone().translate(-center.x, -center.y, -center.z)
        }
      })
      clone.scale.setScalar(100)
      result[node.name] = clone
    }
    if (!result.Spade_Ace) throw new Error('Card meshes are missing')
    return result
  }, [scene])
  useEffect(() => () => Object.values(templates).forEach((node) => node.traverse((child) => { if (child.isMesh) child.geometry.dispose() })), [templates])
  return useMemo(() => Object.fromEntries(RANKS.flatMap((rank) => SUITS.map((suit) => [rank + suit, templates[cardNodeName(rank + suit)]]))), [templates])
}
