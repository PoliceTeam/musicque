import React from 'react'
import { Html } from '@react-three/drei'
export default function SeatMarker({ seat, position, active }) {
  const [x, y, z] = position
  return <>
    {active && <mesh position={[x, y + 0.001, z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.068, 0.073, 48]} /><meshBasicMaterial color='#77d9a0' transparent opacity={0.7} /></mesh>}
    <Html position={[x * 1.2, y + 0.045, z * 1.2]} center><div className={`card-table-seat ${active ? 'is-turn' : ''}`}><strong>{seat.username}</strong><span>{seat.finishedPlace ? `Hạng ${seat.finishedPlace}` : seat.handCount != null ? `${seat.handCount} lá` : ''}</span></div></Html>
  </>
}
