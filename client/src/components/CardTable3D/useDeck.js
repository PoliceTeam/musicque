import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { RANKS, SUITS, cardNodeName } from '../../utils/cards'
export const useDeck = () => {
  const { scene } = useGLTF('/models/deck-of-cards.glb')
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
