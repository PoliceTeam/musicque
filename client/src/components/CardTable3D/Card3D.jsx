import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
export default function Card3D({ deck, cardId, position, rotation = 0, faceDown = false, selected = false, onClick }) {
  const ref = useRef()
  const initialPosition = useRef([position[0], position[1] + 0.025, position[2]])
  const source = deck[cardId]
  const clone = useMemo(() => source.clone(true), [source])
  useFrame((_, delta) => {
    if (ref.current) {
      const alpha = 1 - Math.exp(-12 * delta)
      ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, position[0], alpha)
      ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, position[1] + (selected ? 0.025 : 0), alpha)
      ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, position[2], alpha)
    }
  })
  return <group ref={ref} position={initialPosition.current} rotation={[faceDown ? Math.PI / 2 : -Math.PI / 2, 0, rotation]} onClick={onClick ? (event) => { event.stopPropagation(); onClick() } : undefined}>
    <primitive object={clone} dispose={null} />
  </group>
}
