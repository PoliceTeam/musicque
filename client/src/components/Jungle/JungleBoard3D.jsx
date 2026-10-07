import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls, useProgress } from '@react-three/drei'
import { JungleScenery } from './JungleScenery'
import { JungleGhost, JunglePiece } from './JunglePiece'
import { LAND_TOP, WATER_TOP, moveDuration, pieceWorld } from './jungleMotion'
import { Burst, FloatingText } from './JungleEffects'
import { preloadJungleAssets } from './jungleAssets'
import { playSfx } from './jungleAudio'
import { DENS, SIDE_COLOR, deriveMoveEvent, isWater, jumpArc, looksLikeMove, pieceId, squareToWorld, trapOwner, worldToSquare } from '../../utils/jungle'

preloadJungleAssets()

const tileTop = (square) => (isWater(square) ? WATER_TOP : LAND_TOP)

// Mảng ô phẳng nằm sát mặt ô cờ (đánh dấu nước đi, ô vừa đi…).
const TileMark = ({ square, color, opacity = 0.35, inset = 0.06 }) => {
  const [x, , z] = squareToWorld(square)
  return (
    <mesh position={[x, tileTop(square) + 0.006, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={[1 - inset * 2, 1 - inset * 2]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

// Ô đi được: chấm tròn; ô ăn được: vòng đỏ đập nhịp.
const TargetMark = ({ square, capture }) => {
  const ref = useRef()
  const [x, , z] = squareToWorld(square)
  useFrame((state) => {
    if (!ref.current) return
    const s = capture ? 1 + Math.sin(state.clock.elapsedTime * 6) * 0.07 : 1
    ref.current.scale.setScalar(s)
  })
  return (
    <mesh ref={ref} position={[x, tileTop(square) + 0.015, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
      {capture ? <ringGeometry args={[0.36, 0.46, 40]} /> : <circleGeometry args={[0.13, 28]} />}
      <meshBasicMaterial color={capture ? '#ff4d4f' : '#ffffff'} transparent opacity={capture ? 0.9 : 0.85} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

const JumpPreview = ({ from, to }) => {
  const points = useMemo(() => {
    const a = pieceWorld(from)
    const b = pieceWorld(to)
    const start = [a[0], a[1] + 0.4, a[2]]
    const end = [b[0], b[1] + 0.4, b[2]]
    return Array.from({ length: 24 }, (_, i) => jumpArc(start, end, i / 23, 1.5))
  }, [from, to])
  return <Line points={points} color='#ffffff' lineWidth={2} dashed dashSize={0.18} gapSize={0.12} transparent opacity={0.85} />
}

// Rung nhẹ cả bàn khi ăn quân.
const ShakeGroup = ({ shakeAt, children }) => {
  const ref = useRef()
  const startedAt = useRef(null)
  const lastKey = useRef(shakeAt)
  useFrame((state) => {
    if (!ref.current) return
    if (shakeAt !== lastKey.current) {
      lastKey.current = shakeAt
      startedAt.current = state.clock.elapsedTime
    }
    const age = startedAt.current === null ? 1 : state.clock.elapsedTime - startedAt.current
    if (age < 0.35) {
      const k = (1 - age / 0.35) * 0.06
      ref.current.position.set(Math.sin(age * 90) * k, 0, Math.cos(age * 70) * k)
    } else {
      ref.current.position.set(0, 0, 0)
    }
  })
  return <group ref={ref}>{children}</group>
}

// Camera đứng sau lưng phe mình, hơi cao để thấy trọn 9 hàng.
const CAMERA = { red: [0, 11.6, 9.4], blue: [0, 11.6, -9.4] }
const TARGET = { red: [0, 0, 0.45], blue: [0, 0, -0.45] }

export const JungleLoading = () => {
  const { progress, active } = useProgress()
  if (!active) return null
  return (
    <div className='jg-loading'>
      <div className='jg-loading__bar'><span style={{ width: `${Math.round(progress)}%` }} /></div>
      <small>Đang dựng khu rừng… {Math.round(progress)}%</small>
    </div>
  )
}

const JungleBoard3D = ({ game, mySide, canAct, onMove, inspectedId, onInspect }) => {
  const viewerSide = mySide || 'red'
  const pieces = useMemo(() => game?.board?.pieces || [], [game])
  const legalMoves = useMemo(() => game?.board?.legalMoves || [], [game])
  const pieceBySquare = useMemo(() => new Map(pieces.map((p) => [p.square, p])), [pieces])

  // Sự kiện của nước vừa đi = so state đang hiển thị với state mới.
  const previousRef = useRef(null)
  const event = useMemo(() => deriveMoveEvent(previousRef.current, game), [game])
  const [ghosts, setGhosts] = useState([])
  const [effects, setEffects] = useState([])
  const [texts, setTexts] = useState([])
  const [shakeAt, setShakeAt] = useState(0)
  const [selected, setSelected] = useState(null)
  const [hover, setHover] = useState(null)
  const [pending, setPending] = useState(false)
  const [shakes, setShakes] = useState({})
  const timers = useRef([])
  const seq = useRef(0)

  const later = useCallback((ms, fn) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const addEffect = useCallback((kind, position, tint) => {
    seq.current += 1
    setEffects((list) => [...list, { id: seq.current, kind, position, tint }])
  }, [])
  const addText = useCallback((text, position, tone) => {
    seq.current += 1
    setTexts((list) => [...list, { id: seq.current, text, position, tone }])
  }, [])

  // Quân bị ăn phải có ghost ngay trong lần vẽ này, nếu không sẽ nháy mất một khung.
  useLayoutEffect(() => {
    const previous = previousRef.current
    previousRef.current = game
    if (!event?.captured || !previous?.board) return
    const victim = previous.board.pieces.find((p) => pieceId(p) === event.captured.id)
    if (!victim) return
    setGhosts((list) => [...list, {
      key: `${event.ply}-${victim.type}`,
      piece: victim,
      delayMs: moveDuration(event) * 0.72,
      tip: event.ratEatsElephant,
    }])
  }, [game, event])

  // Hiệu ứng theo thời gian của nước đi.
  useEffect(() => {
    if (!event) return
    const duration = moveDuration(event)
    const to = pieceWorld(event.to)
    if (event.jump) {
      const mid = event.over[Math.floor(event.over.length / 2)] || event.to
      const [mx, , mz] = squareToWorld(mid)
      playSfx('jump')
      later(duration * 0.45, () => {
        addEffect('splash', [mx, WATER_TOP, mz])
        playSfx('splash')
      })
      later(duration * 0.98, () => {
        addEffect('dust', [to[0], LAND_TOP, to[2]])
        playSfx('land')
      })
    } else {
      playSfx('step', duration)
    }
    if (isWater(event.to) && !isWater(event.from)) {
      later(duration * 0.8, () => {
        addEffect('splash', [to[0], WATER_TOP, to[2]])
        playSfx('splash')
      })
    }
    if (!isWater(event.to) && isWater(event.from)) {
      later(duration * 0.3, () => {
        addEffect('splash', squareToWorld(event.from).map((v, i) => (i === 1 ? WATER_TOP : v)))
        playSfx('splash')
      })
    }
    if (trapOwner(event.to) && trapOwner(event.to) !== event.side) {
      later(duration, () => {
        addEffect('sparkle', [to[0], LAND_TOP + 0.6, to[2]])
        addText('Sập bẫy! Cấp 0', [to[0], LAND_TOP + 1.4, to[2]], 'warn')
        playSfx('trap')
      })
    }
    if (event.captured) {
      later(duration * 0.75, () => {
        setShakeAt((value) => value + 1)
        playSfx('capture')
      })
    }
    if (event.ratEatsElephant) {
      later(duration * 0.8, () => {
        addText('Chuột hạ Voi!', [to[0], LAND_TOP + 1.6, to[2]], 'gold')
        playSfx('trombone')
      })
    }
  }, [event, later, addEffect, addText])

  // Kết thúc ván: pháo giấy ở ổ bị chiếm (hoặc giữa bàn).
  const resultKey = game?.result ? `${game.id}:${game.result.reason}` : null
  const shownResult = useRef(null)
  useEffect(() => {
    if (!resultKey || shownResult.current === resultKey) return
    const firstSight = shownResult.current === null && !event
    shownResult.current = resultKey
    if (firstSight) return
    if (!game.result.winner) {
      later(event ? moveDuration(event) : 0, () => playSfx('draw'))
      return
    }
    const target = game.result.reason === 'den' ? squareToWorld(DENS[game.result.winner === 'red' ? 'blue' : 'red']) : [0, 0, 0]
    later(event ? moveDuration(event) : 0, () => {
      playSfx(!mySide || game.result.winner === mySide ? 'win' : 'lose')
      addEffect('confetti', [target[0], LAND_TOP + 0.4, target[2]])
      addEffect('confetti', [target[0] + 0.6, LAND_TOP + 0.4, target[2] - 0.4])
    })
  }, [resultKey, event, game, later, addEffect, mySide])

  useEffect(() => { setSelected(null) }, [game?.board?.ply, game?.status])

  const movesFromSelected = useMemo(
    () => (selected ? legalMoves.filter((move) => move.from === selected) : []),
    [legalMoves, selected],
  )

  const submit = useCallback(async (from, to) => {
    setPending(true)
    const ok = await onMove(from, to)
    setPending(false)
    if (!ok) {
      playSfx('invalid')
      const piece = pieceBySquare.get(from)
      if (piece) setShakes((map) => ({ ...map, [pieceId(piece)]: (map[pieceId(piece)] || 0) + 1 }))
    }
  }, [onMove, pieceBySquare])

  const handleSquare = useCallback((square) => {
    if (!square || !canAct || pending) return
    const occupant = pieceBySquare.get(square)
    if (occupant?.side === mySide) {
      if (selected !== square) playSfx('select')
      setSelected(selected === square ? null : square)
      return
    }
    if (!selected) return
    const legal = movesFromSelected.some((move) => move.to === square)
    // Nước sai nhưng "trông như" nước đi: gửi để server giải thích vì sao không được.
    if (legal || looksLikeMove(selected, square)) submit(selected, square)
    else setSelected(null)
  }, [canAct, pending, pieceBySquare, mySide, selected, movesFromSelected, submit])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sprungTraps = useMemo(() => new Set(pieces.filter((p) => p.weakened).map((p) => p.square)), [pieces])
  const lastMove = game?.board?.lastMove
  const outcomeFor = (side) => {
    if (!game?.result?.winner) return null
    return game.result.winner === side ? 'win' : 'lose'
  }

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: CAMERA[viewerSide], fov: 40, near: 0.1, far: 80 }}
      // DEV giữ buffer để công cụ chụp màn hình/kiểm thử đọc được khung hình WebGL.
      gl={{ antialias: true, preserveDrawingBuffer: import.meta.env.DEV }}
      onPointerMissed={() => {
        setSelected(null)
        onInspect?.(null)
      }}
    >
      <color attach='background' args={['#bfe3f7']} />
      <fog attach='fog' args={['#bfe3f7', 20, 38]} />
      <hemisphereLight args={['#eaf6ff', '#6fae5f', 1.05]} />
      <directionalLight
        position={[5, 12, 6]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0004}
      />
      <OrbitControls
        key={viewerSide}
        makeDefault
        target={TARGET[viewerSide]}
        enablePan={false}
        enableDamping
        minDistance={7}
        maxDistance={19}
        minPolarAngle={0.2}
        maxPolarAngle={1.2}
      />

      <Suspense fallback={null}>
        <ShakeGroup shakeAt={shakeAt}>
          <JungleScenery sprungTraps={sprungTraps} winner={game?.result?.winner || null} />

          {lastMove && <TileMark square={lastMove.from} color='#ffe066' opacity={0.3} />}
          {lastMove && <TileMark square={lastMove.to} color='#ffd43b' opacity={0.42} />}
          {selected && <TileMark square={selected} color='#ffd43b' opacity={0.55} />}
          {hover && hover !== selected && canAct && <TileMark square={hover} color='#ffffff' opacity={0.18} />}
          {movesFromSelected.map((move) => <TargetMark key={move.to} square={move.to} capture={Boolean(move.captured)} />)}
          {movesFromSelected.filter((move) => move.jump).map((move) => <JumpPreview key={`j-${move.to}`} from={move.from} to={move.to} />)}

          {pieces.map((piece) => {
            const id = pieceId(piece)
            return (
              <JunglePiece
                key={id}
                piece={piece}
                motion={event?.id === id ? event : null}
                selected={selected === piece.square}
                inspected={inspectedId === id}
                interactive={canAct && (piece.side === mySide || Boolean(selected))}
                outcome={outcomeFor(piece.side)}
                shakeKey={shakes[id] || 0}
                onSelect={(p) => {
                  // Quân nào cũng mở được thẻ thông tin; quân mình thì còn được chọn để đi.
                  if (p.side !== mySide || !selected || p.square === selected) onInspect?.(id)
                  handleSquare(p.square)
                }}
                onHover={setHover}
              />
            )
          })}

          {ghosts.map((ghost) => (
            <JungleGhost
              key={ghost.key}
              piece={ghost.piece}
              delayMs={ghost.delayMs}
              tip={ghost.tip}
              onVanish={(position, piece) => addEffect('capture', position, SIDE_COLOR[piece.side])}
              onDone={() => setGhosts((list) => list.filter((g) => g.key !== ghost.key))}
            />
          ))}

          {/* Mặt phẳng bắt click cho cả bàn */}
          <mesh
            position={[0, LAND_TOP + 0.002, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => { e.stopPropagation(); handleSquare(worldToSquare(e.point.x, e.point.z)) }}
            onPointerMove={(e) => {
              const square = worldToSquare(e.point.x, e.point.z)
              setHover((current) => (current === square ? current : square))
            }}
            onPointerOut={() => setHover(null)}
          >
            <planeGeometry args={[7, 9]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </ShakeGroup>

        {effects.map((effect) => (
          <Burst
            key={effect.id}
            kind={effect.kind}
            position={effect.position}
            tint={effect.tint}
            onDone={() => setEffects((list) => list.filter((e) => e.id !== effect.id))}
          />
        ))}
        {texts.map((item) => (
          <FloatingText
            key={item.id}
            text={item.text}
            tone={item.tone}
            position={item.position}
            onDone={() => setTexts((list) => list.filter((t) => t.id !== item.id))}
          />
        ))}
      </Suspense>
    </Canvas>
  )
}

export default JungleBoard3D
