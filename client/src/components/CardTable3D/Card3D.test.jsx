import React from 'react'
import { afterEach, expect, it } from 'vitest'
import { createRoot, advance, act, extend } from '@react-three/fiber'
import * as THREE from 'three'
import Card3D from './Card3D'
import { dealMotion, dealSchedule } from './cardMotion'
import { readWorldPose } from './cardSpaces'

const { Group, MeshBasicMaterial, PlaneGeometry } = THREE
extend(THREE)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const renderer = (canvas) => ({ domElement: canvas, render() {}, setSize() {}, setPixelRatio() {}, dispose() {}, shadowMap: {} })
const deck = { AS: new Group(), overlays: { glowGeometry: new PlaneGeometry(), glowMaterial: new MeshBasicMaterial(), dimGeometry: new PlaneGeometry(), dimMaterial: new MeshBasicMaterial() } }
let root
afterEach(() => act(() => root.unmount()))

it('keeps an own-seat card waiting in the deck while the camera anchor rotates', async () => {
  const deckPosition = [0, 0.8, 0]
  const hand = ['a', 'b'].map((id, index) => ({ id, cardId: 'AS', zone: 'hand', seat: 0, position: [index * 0.02, -0.1, -0.38], faceUp: true, space: 'camera' }))
  const { scheduled, pickupAt } = dealSchedule(hand, { anchor: 0, deckPosition })
  const entry = scheduled[1], motion = dealMotion(entry, pickupAt, 0, deckPosition)
  expect(entry.start).toBeGreaterThan(0)
  const anchor = new Group(), spaces = { current: { camera: anchor } }
  root = createRoot(document.createElement('canvas'))
  root.configure({ gl: renderer, frameloop: 'never', size: { width: 100, height: 100, top: 0, left: 0 } })
  await act(async () => root.render(
    <primitive object={anchor}><Card3D deck={deck} cardId='AS' target={{ ...entry.card, ...motion }} from={motion.from} delay={motion.delay} duration={motion.duration} height={motion.height} spaces={spaces} /></primitive>
  ))
  const card = anchor.children[0]
  let time = 0
  const frame = () => act(() => advance(time += 0.01))
  await frame()
  const waiting = readWorldPose(card).position
  anchor.rotation.y = 0.6; anchor.position.x = 0.3
  await frame()
  readWorldPose(card).position.forEach((value, i) => expect(value).toBeCloseTo(waiting[i], 6))
})
