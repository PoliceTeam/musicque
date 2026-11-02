import React from 'react'
import { afterEach, expect, it } from 'vitest'
import { createRoot, advance, act, extend } from '@react-three/fiber'
import * as THREE from 'three'
import TurnRing from './TurnRing'

extend(THREE)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const renderer = (canvas) => ({ domElement: canvas, render() {}, setSize() {}, setPixelRatio() {}, dispose() {}, shadowMap: {} })
let root
afterEach(() => act(() => root.unmount()))

it('shows a thick countdown on the felt and moves to the next seat', async () => {
  root = createRoot(document.createElement('canvas'))
  const scene = new THREE.Scene()
  root.configure({ scene, gl: renderer, frameloop: 'never', size: { width: 100, height: 100, top: 0, left: 0 } })
  const table = { serverNow: Date.now(), receivedAt: Date.now(), turnDeadlineAt: Date.now() + 10000 }
  await act(async () => root.render(<TurnRing position={[0, .785, .57]} table={table} turnMs={20000} reducedMotion />))
  await act(async () => advance(1))
  const ring = scene.getObjectByName('table-turn-ring')
  expect(ring.position.z).toBe(.57)
  expect(ring.children[2].geometry.parameters.outerRadius - ring.children[2].geometry.parameters.innerRadius).toBeGreaterThan(.03)
  expect(ring.children[2].geometry.drawRange.count).toBeGreaterThan(350)
  expect(ring.children[2].geometry.drawRange.count).toBeLessThan(410)
  expect(ring.children[2].material.depthWrite).toBe(false)
  await act(async () => root.render(<TurnRing position={[.57, .785, 0]} table={table} turnMs={20000} reducedMotion />))
  await act(async () => advance(2))
  expect(ring.position.x).toBe(.57)
  expect(ring.position.z).toBe(0)
})
