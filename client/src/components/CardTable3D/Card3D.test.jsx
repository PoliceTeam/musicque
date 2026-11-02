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
  const scene = new THREE.Scene()
  root.configure({ scene, gl: renderer, frameloop: 'never', size: { width: 100, height: 100, top: 0, left: 0 } })
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

it('raises selected cards in-plane without tilting with an opaque border, keeping hover lighter', async () => {
  const selectionMaterial = new MeshBasicMaterial({ color: '#3d7dee' })
  root = createRoot(document.createElement('canvas'))
  const scene = new THREE.Scene()
  root.configure({ scene, gl: renderer, frameloop: 'never', size: { width: 100, height: 100, top: 0, left: 0 } })
  const selectedDeck = { ...deck, overlays: { ...deck.overlays, selectionMaterial } }
  const cardProps = { deck: selectedDeck, cardId: 'AS', position: [0, 0, 0], reducedMotion: true }
  await act(async () => root.render(<Card3D {...cardProps} selected />))
  await act(async () => advance(1))
  const card = scene.children[0].children[0]
  expect(card.position.y).toBe(.033)
  expect(card.rotation.x).toBe(0)
  expect(card.position.z).toBe(0)
  expect(card.children[1].material).toBe(selectionMaterial)
  expect(card.children[1].material.opacity).toBe(1)
  await act(async () => root.render(<Card3D {...cardProps} />))
  await act(async () => advance(2))
  expect(card.position.y).toBe(0)
  expect(card.rotation.x).toBe(0)
  expect(card.children[1].visible).toBe(false)
})

it('keeps selected-card depth and draw order so the visible overlapping neighbour wins the raycast', async () => {
  const face = new THREE.Mesh(new PlaneGeometry(.058, .089), new MeshBasicMaterial())
  const cardDeck = { ...deck, AS: face, overlays: { ...deck.overlays, selectionMaterial: new MeshBasicMaterial(), glowGeometry: new PlaneGeometry(.064, .095) } }
  root = createRoot(document.createElement('canvas'))
  const scene = new THREE.Scene()
  root.configure({ scene, gl: renderer, frameloop: 'never', size: { width: 100, height: 100, top: 0, left: 0 } })
  const first = { position: [0, 0, 0], faceUp: true, tilt: Math.PI / 2, order: 1000 }
  const next = { ...first, position: [.015, 0, .0005], order: 1001 }
  await act(async () => root.render(<><Card3D deck={cardDeck} cardId='AS' target={first} selected reducedMotion /><Card3D deck={cardDeck} cardId='AS' target={next} reducedMotion /></>))
  await act(async () => advance(1))
  scene.updateMatrixWorld(true)
  const selected = scene.children[0], neighbour = scene.children[1]
  expect(selected.children[0].position.toArray()).toEqual([0, .033, 0])
  expect(selected.children[0].rotation.x).toBe(0)
  expect(selected.children[0].children[0].renderOrder).toBe(1000)
  expect(neighbour.children[0].children[0].renderOrder).toBe(1001)
  const ray = new THREE.Raycaster(new THREE.Vector3(.02, .02, 1), new THREE.Vector3(0, 0, -1))
  const hit = ray.intersectObjects(scene.children, true)[0].object
  expect(hit.parent.parent).toBe(neighbour)
})
