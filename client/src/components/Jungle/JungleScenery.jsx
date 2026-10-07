import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import { useSceneModel } from './jungleAssets'
import { Ripple } from './JungleEffects'
import { LAND_TOP, WATER_TOP } from './jungleMotion'
import { COLS, DENS, ROWS, SIDE_COLOR, TRAPS, denOwner, isWater, squareToWorld, toSquare, trapOwner } from '../../utils/jungle'

const WATER_TINT = '#56b7f0'

const Prop = ({ name, color, shadows, ...props }) => {
  const { scene } = useSceneModel(name, { color, shadows })
  return <primitive object={scene} {...props} />
}

// Bẫy gai: dựng lên khi có quân địch đang đứng trong hang.
const Trap = ({ square, sprung }) => {
  const { scene, animations } = useSceneModel('trap', { shadows: 'both' })
  const ref = useRef()
  const { actions } = useAnimations(animations, ref)
  useEffect(() => {
    const show = actions.show
    const hide = actions.hide
    if (!show || !hide) return
    const action = sprung ? show : hide
    const other = sprung ? hide : show
    other.stop()
    action.reset()
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.play()
  }, [actions, sprung])
  const [x, , z] = squareToWorld(square)
  return (
    <group ref={ref} position={[x, LAND_TOP - 0.02, z]} scale={0.95}>
      <primitive object={scene} />
    </group>
  )
}

// Vệt sáng trôi trên mặt sông: shader nhỏ, trong suốt, không ghi depth.
const RiverSheen = ({ center, size }) => {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      void main(){
        float wave = sin(vUv.y * 22.0 + uTime * 1.6 + sin(vUv.x * 7.0 + uTime * 0.7) * 1.8);
        float streak = smoothstep(0.82, 1.0, wave);
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.0, 0.08, 1.0 - vUv.x) * smoothstep(0.0, 0.05, vUv.y) * smoothstep(0.0, 0.05, 1.0 - vUv.y);
        gl_FragColor = vec4(1.0, 1.0, 1.0, streak * 0.28 * edge);
      }`,
  }), [])
  useFrame((state) => { material.uniforms.uTime.value = state.clock.elapsedTime })
  return (
    <mesh position={[center[0], WATER_TOP + 0.005, center[2]]} rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={1}>
      <planeGeometry args={size} />
    </mesh>
  )
}

const Tile = ({ square }) => {
  const [x, , z] = squareToWorld(square)
  const den = denOwner(square)
  if (isWater(square)) return <Prop name='water' color={WATER_TINT} position={[x, 0, z]} />
  if (den) return <Prop name='denTile' position={[x, 0.1, z]} />
  if (trapOwner(square)) return <Prop name='trapTile' position={[x, 0, z]} />
  return <Prop name='tile' position={[x, 0, z]} />
}

// Ổ thú: lều + cờ màu phe, quay mặt vào giữa bàn.
const Den = ({ side, winner }) => {
  const [x, , z] = squareToWorld(DENS[side])
  const facing = side === 'red' ? Math.PI : 0
  const flagColor = winner ? SIDE_COLOR[winner] : SIDE_COLOR[side]
  return (
    <group position={[x, 0.2, z]}>
      <Prop name='tent' shadows='both' scale={0.62} rotation={[0, facing, 0]} position={[0, 0, side === 'red' ? 0.12 : -0.12]} />
      <Prop key={flagColor} name='flag' color={flagColor} shadows='cast' scale={0.9} position={[0.36, 0, side === 'red' ? -0.3 : 0.3]} />
    </group>
  )
}

// Cây cối, đá bao quanh bàn — vị trí cố định để mọi người thấy giống nhau.
const DECOR = [
  ['treeHigh', -5.2, -4.8, 0.9, 0.4], ['tree', -4.4, -3.1, 0.75, 1.2], ['tree', -5.4, -1.2, 0.85, 2.1],
  ['bushLarge', -4.3, 0.2, 1.4, 0], ['treeHigh', -5.3, 1.6, 0.8, 0.8], ['tree', -4.5, 3.4, 0.8, 2.6],
  ['treeHigh', -5.1, 5.2, 0.9, 1.7], ['rocksLow', -4.4, -5.4, 0.8, 0.3], ['boulders', -4.2, 4.6, 1.2, 1],
  ['treeHigh', 5.2, 4.8, 0.9, 2.2], ['tree', 4.4, 3.1, 0.75, 0.6], ['tree', 5.4, 1.2, 0.85, 1.8],
  ['bushLarge', 4.3, -0.2, 1.4, 0.5], ['treeHigh', 5.3, -1.6, 0.8, 0.2], ['tree', 4.5, -3.4, 0.8, 1.1],
  ['treeHigh', 5.1, -5.2, 0.9, 2.9], ['rocksLow', 4.4, 5.4, 0.8, 2.4], ['boulders', 4.2, -4.6, 1.2, 0.4],
  ['stones', -2.2, 5.6, 0.7, 0.3], ['plant', -1.2, 5.4, 1.4, 0], ['crystal', 1.6, 5.5, 1.3, 0.6], ['bush', 2.6, 5.7, 1.4, 0],
  ['stones', 2.2, -5.6, 0.7, 2.1], ['plant', 1.2, -5.4, 1.4, 1], ['crystal', -1.6, -5.5, 1.3, 2.2], ['bush', -2.6, -5.7, 1.4, 0],
  ['grass', -4.1, -1.9, 1, 0], ['grass', 4.1, 1.9, 1, 0], ['pebbles', -3.9, 2.4, 1.2, 0.5], ['pebbles', 3.9, -2.4, 1.2, 1.5],
  ['tree', -6.6, -2.8, 0.8, 0.9], ['tree', 6.6, 2.8, 0.8, 1.9], ['treeHigh', -6.8, 3.2, 0.85, 0.1], ['treeHigh', 6.8, -3.2, 0.85, 1.4],
  ['tree', -3.4, 6.6, 0.8, 0.2], ['tree', 3.4, -6.6, 0.8, 2.7], ['treeHigh', 0.4, 6.9, 0.85, 1.2], ['treeHigh', -0.4, -6.9, 0.85, 0.7],
]

const RIVERS = [
  { squares: ['b4', 'c4', 'b5', 'c5', 'b6', 'c6'] },
  { squares: ['e4', 'f4', 'e5', 'f5', 'e6', 'f6'] },
]

export const JungleScenery = ({ sprungTraps = new Set(), winner = null }) => {
  const squares = useMemo(() => {
    const list = []
    for (let y = 0; y < ROWS; y += 1) for (let x = 0; x < COLS; x += 1) list.push(toSquare(x, y))
    return list
  }, [])

  return (
    <group>
      {/* Nền cỏ lớn + viền đất dưới bàn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[16, 48]} />
        <meshStandardMaterial color='#79c46a' roughness={1} />
      </mesh>
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[COLS + 0.5, 0.1, ROWS + 0.5]} />
        <meshStandardMaterial color='#b98a5a' roughness={1} />
      </mesh>

      {squares.map((square) => <Tile key={square} square={square} />)}
      {[...TRAPS.red, ...TRAPS.blue].map((square) => <Trap key={square} square={square} sprung={sprungTraps.has(square)} />)}
      <Den side='red' winner={winner} />
      <Den side='blue' winner={winner} />

      {RIVERS.map((river, i) => {
        const points = river.squares.map(squareToWorld)
        const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length
        const cz = points.reduce((sum, p) => sum + p[2], 0) / points.length
        return (
          <group key={i}>
            <RiverSheen center={[cx, 0, cz]} size={[2, 3]} />
            <Ripple position={[cx - 0.4, WATER_TOP + 0.01, cz - 0.9]} delay={i * 0.7} period={2.6} maxScale={0.35} />
            <Ripple position={[cx + 0.5, WATER_TOP + 0.01, cz + 0.8]} delay={1.3 + i * 0.4} period={3.1} maxScale={0.3} />
          </group>
        )
      })}

      {DECOR.map(([name, x, z, scale, rot], i) => (
        <Prop key={i} name={name} shadows='both' position={[x, 0, z]} scale={scale} rotation={[0, rot, 0]} />
      ))}
    </group>
  )
}
