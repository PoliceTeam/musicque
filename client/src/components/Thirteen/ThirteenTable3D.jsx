import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useDeck } from '../CardTable3D/useDeck'
import Card3D from '../CardTable3D/Card3D'
import TableScene from '../CardTable3D/TableScene'
import OpponentAvatar from '../CardTable3D/OpponentAvatar'
import { useCardTransitions } from '../CardTable3D/useCardTransitions'
import { MOTION } from '../CardTable3D/anim'
import { buildThirteenSnapshot, isBombTrick } from '../../utils/thirteenScene'
import ThirteenFallback2D from './ThirteenFallback2D'
function CameraHand({ spaces, lowered, reducedMotion, children }) {
  const { camera, scene } = useThree()
  const anchor = useMemo(() => new THREE.Group(), [])
  spaces.current.camera = anchor
  useLayoutEffect(() => { const anchors = spaces.current; scene.add(camera); camera.add(anchor); return () => { camera.remove(anchor); delete anchors.camera } }, [camera, scene, anchor, spaces])
  useFrame((_, delta) => { anchor.position.y += ((lowered ? -0.17 : 0) - anchor.position.y) * (reducedMotion ? 1 : 1 - Math.exp(-10 * delta)); anchor.updateWorldMatrix(true, true) }, -1)
  return createPortal(children, anchor)
}
function SceneEffects({ frame, reducedMotion, deck, surfaceY }) {
  const shuffle = useRef(), flash = useRef(), burst = useRef()
  const elapsed = useRef(0)
  const object = useMemo(() => new THREE.Object3D(), [])
  const previousTrick = useRef(frame.trickKey)
  const bomb = useRef(false)
  const previousCombo = useRef(frame.trick)
  useEffect(() => {
    if (frame.trickKey !== previousTrick.current) {
      bomb.current = isBombTrick(previousCombo.current, frame.trick)
      previousTrick.current = frame.trickKey; previousCombo.current = frame.trick; elapsed.current = 0
    }
  }, [frame.trick, frame.trickKey])
  useEffect(() => { elapsed.current = 0; bomb.current = false }, [frame.matchId, frame.finished])
  useFrame((_, delta) => {
    elapsed.current += delta * 1000
    const time = elapsed.current
    if (shuffle.current) {
      shuffle.current.visible = frame.deal && !reducedMotion && time < MOTION.shuffle
      shuffle.current.rotation.z = Math.sin(time / 35) * 0.08
      shuffle.current.position.y = Math.abs(Math.sin(time / 65)) * 0.008
    }
    if (flash.current) flash.current.material.opacity = bomb.current && !reducedMotion ? Math.max(0, 0.8 * (1 - time / MOTION.bomb)) : 0
    if (burst.current) {
      const progress = time / MOTION.finish
      burst.current.visible = frame.finished && !reducedMotion && progress < 1
      if (burst.current.visible) for (let i = 0; i < 8; i++) {
        const angle = i * 2.4
        object.position.set((frame.winnerPosition?.[0] || 0) + Math.cos(angle) * progress * 0.2, surfaceY + Math.sin(Math.PI * Math.min(progress, 1)) * 0.45 + i * 0.003, (frame.winnerPosition?.[2] || 0) + Math.sin(angle) * progress * 0.2)
        object.rotation.set(progress * 8 + i, progress * 5, angle)
        object.updateMatrix(); burst.current.setMatrixAt(i, object.matrix)
      }
      if (burst.current.visible) burst.current.instanceMatrix.needsUpdate = true
    }
  })
  return <>
    <group ref={shuffle}>{[0, 1, 2].map(i => <Card3D key={i} deck={deck} cardId='AS' target={{ position: [0, surfaceY + 0.004 + i * 0.002, 0], faceUp: false }} reducedMotion />)}</group>
    <mesh ref={flash} position={[0, surfaceY + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.11, 0.16, 64]} /><meshBasicMaterial color='#ed5353' transparent opacity={0} depthWrite={false} /></mesh>
    <instancedMesh ref={burst} args={[null, null, 8]} visible={false}><planeGeometry args={[0.04, 0.06]} /><meshBasicMaterial color='#fff5d2' side={THREE.DoubleSide} /></instancedMesh>
  </>
}
function ThirteenCards({ table, myHand, selectedCards, toggleCard, surfaceY, seatPositions, characterPositions, anchor, reducedMotion, firstPerson, dealOnMount, preview, handLowered, turnMs }) {
  const deck = useDeck()
  const spaces = useRef({})
  const poseStore = useMemo(() => ({ current: new Map(), matchId: table.matchId }), [table.matchId])
  const next = useMemo(() => buildThirteenSnapshot({ table, myHand, anchor, surfaceY, seatPositions, firstPerson, preview }), [table, myHand, anchor, surfaceY, seatPositions, firstPerson, preview])
  const frame = useCardTransitions(next, { dealOnMount, matchId: table.matchId, isBomb: isBombTrick })
  const renderCard = (card) => <Card3D key={`${frame.matchId}:${card.id}`} deck={deck} cardId={card.cardId} target={card} from={card.from} delay={card.delay} duration={card.duration} height={card.height} reducedMotion={reducedMotion} dim={card.dim} spaces={spaces} poseStore={poseStore} poseId={card.id} selected={card.zone === 'hand' && card.seat === anchor && selectedCards.includes(card.cardId)} onClick={!preview && table.status === 'playing' && card.zone === 'hand' && card.seat === anchor && card.faceUp ? () => toggleCard(card.cardId) : undefined} />
  return <>
    {firstPerson && <CameraHand spaces={spaces} lowered={handLowered} reducedMotion={reducedMotion}>{frame.cards.filter(card => card.space === 'camera').map(renderCard)}</CameraHand>}
    {firstPerson && table.seats.map((seat, i) => seat && i !== anchor && <OpponentAvatar key={`${table.matchId}:${i}`} seat={seat} seatIndex={i} position={characterPositions[i]} clipHeight={surfaceY - 0.01} active={table.currentSeat === i} playedKey={frame.trick?.bySeat === i ? frame.trickKey : null} turnDeadlineAt={table.turnDeadlineAt} serverNow={table.serverNow} turnMs={turnMs} spaces={spaces} reducedMotion={reducedMotion}>{frame.cards.filter(card => card.space === `seat:${i}`).map(renderCard)}</OpponentAvatar>)}
    {frame.cards.filter(card => !firstPerson || card.space === 'world' || !card.space).map(renderCard)}
    <SceneEffects frame={frame} reducedMotion={reducedMotion} deck={deck} surfaceY={surfaceY} />
  </>
}
export default function ThirteenTable3D(props) {
  return <TableScene seats={props.table.seats} currentSeat={props.table.currentSeat} userId={props.userId} turnDeadlineAt={props.table.turnDeadlineAt} serverNow={props.table.serverNow} firstPerson={props.firstPerson} fallback={<ThirteenFallback2D {...props} />}>
    {(surface) => <ThirteenCards {...props} {...surface} />}
  </TableScene>
}
