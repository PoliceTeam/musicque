import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useAnimationActivity } from './activity'
import { freshThrows, projectilePoint, THROW_FLIGHT_MS, throwDuration } from './throws'
import './social.css'
function impactTexture(item) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')
  context.fillStyle = item === 'tomato' ? '#e8443a' : '#f5c13d'
  if (item === 'tomato') {
    context.beginPath(); context.arc(64, 64, 30, 0, Math.PI * 2); context.fill()
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4
      context.beginPath(); context.ellipse(64 + Math.cos(angle) * 29, 64 + Math.sin(angle) * 29, 15 + i % 3, 8, angle, 0, Math.PI * 2); context.fill()
    }
    for (let i = 0; i < 6; i++) { context.beginPath(); context.arc(12 + i * 20, 12 + i % 3 * 46, 3 + i % 3, 0, Math.PI * 2); context.fill() }
    context.fillStyle = '#ff7b66'; context.beginPath(); context.ellipse(53, 50, 15, 10, -.4, 0, Math.PI * 2); context.fill()
  } else {
    for (const [cx, cy, radius] of [[64, 64, 42], [16, 20, 10], [110, 24, 12], [104, 109, 11]]) {
      context.beginPath()
      for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? radius * .4 : radius
        const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r
        if (!i) context.moveTo(x, y); else context.lineTo(x, y)
      }
      context.closePath(); context.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
function itemGeometry(item) {
  const geometry = item === 'tomato' ? new THREE.SphereGeometry(.036, 10, 6) : new THREE.DodecahedronGeometry(.037, 0)
  const positions = geometry.getAttribute('position'), colors = []
  const color = new THREE.Color(item === 'tomato' ? '#e8443a' : '#909d9f')
  for (let i = 0; i < positions.count; i++) {
    const tint = color.clone().multiplyScalar(.8 + .2 * (positions.getY(i) / .037 + 1) / 2)
    colors.push(tint.r, tint.g, tint.b)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geometry
}
export default function ThrowEffects({ events, seats, anchor, positions, spaces, reducedMotion, serverOffset = 0, onImpact }) {
  const { camera, size } = useThree()
  const activity = useAnimationActivity()
  const root = useMemo(() => { const group = new THREE.Group(); group.name = 'table-throw-effects'; return group }, [])
  const records = useRef([]), seen = useRef(new Set())
  const point = useMemo(() => new THREE.Vector3(), [])
  const [screenHit, setScreenHit] = useState(null)
  const resources = useMemo(() => ({
    tomato: itemGeometry('tomato'), stone: itemGeometry('stone'),
    material: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 }),
    splats: { tomato: impactTexture('tomato'), stone: impactTexture('stone') },
  }), [])
  useEffect(() => {
    const now = Date.now() + serverOffset
    const ids = new Set((events || []).map(event => event?.id))
    seen.current = new Set([...seen.current].filter(id => ids.has(id)))
    for (const event of freshThrows(events, seen.current, seats, now)) {
      if (seen.current.has(event.id)) continue
      seen.current.add(event.id)
      const headPosition = seat => seat === anchor ? camera.localToWorld(new THREE.Vector3(.05, -.04, -.2)) : spaces.current[`head:${seat}`]?.position.clone() || new THREE.Vector3(positions[seat][0], 1.05, positions[seat][2])
      const mesh = new THREE.Mesh(resources[event.item], resources.material)
      mesh.userData.throwId = event.id
      root.add(mesh)
      const age = Math.max(0, now - new Date(event.at).getTime())
      records.current.push({ event, mesh, from: headPosition(event.fromSeat).toArray(), to: headPosition(event.targetSeat).toArray(), born: performance.now() - age, hit: false })
    }
    if (records.current.length) activity.start()
  }, [events, seats, anchor, positions, spaces, resources, root, activity, camera, serverOffset])
  useEffect(() => {
    if (!screenHit) return undefined
    const timeout = setTimeout(() => setScreenHit(null), Math.max(0, 1500 - (performance.now() - screenHit.startedAt)))
    return () => clearTimeout(timeout)
  }, [screenHit])
  useEffect(() => () => {
    records.current.forEach(record => record.sprite?.material.dispose())
    root.clear(); records.current = []
    resources.tomato.dispose(); resources.stone.dispose(); resources.material.dispose()
    Object.values(resources.splats).forEach(texture => texture.dispose())
    activity.stop()
  }, [root, resources, activity])
  useFrame(() => {
    const now = performance.now()
    records.current = records.current.filter(record => {
      const { event, mesh } = record, elapsed = now - record.born
      const flight = reducedMotion ? 0 : THROW_FLIGHT_MS
      if (elapsed < flight) {
        mesh.position.fromArray(projectilePoint(record.from, record.to, elapsed / flight))
        mesh.rotation.set(elapsed / 60, elapsed / 90, elapsed / 130)
        return true
      }
      const hitAge = elapsed - flight
      if (!record.hit) {
        record.hit = true
        const impact = { ...event, startedAt: record.born + flight }
        onImpact?.(impact)
        if (event.targetSeat === anchor) {
          setScreenHit({ ...impact, delay: -(performance.now() - impact.startedAt), left: positions[event.fromSeat][0] < 0 })
          if (!reducedMotion) window.dispatchEvent(new Event('card-table:hit'))
        } else {
          record.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: resources.splats[event.item], transparent: true, depthWrite: false, depthTest: false }))
          record.sprite.scale.setScalar(event.item === 'tomato' ? .26 : .3)
          record.sprite.userData.impactId = event.id
          root.add(record.sprite)
        }
      }
      mesh.visible = !reducedMotion && event.item === 'stone' && event.targetSeat !== anchor && hitAge < 350
      if (mesh.visible) { mesh.position.fromArray(record.to); mesh.position.y += Math.sin(hitAge / 350 * Math.PI) * .12; mesh.rotation.z += .15 }
      if (record.sprite) {
        const head = spaces.current[`head:${event.targetSeat}`]
        record.sprite.position.copy(head?.position || point.fromArray(record.to))
        point.copy(camera.position).sub(record.sprite.position).normalize().multiplyScalar(.09)
        record.sprite.position.add(point)
        record.sprite.material.opacity = Math.max(0, 1 - hitAge / (event.item === 'tomato' ? 2000 : 1200))
      }
      if (hitAge < throwDuration(event.item) - THROW_FLIGHT_MS) return true
      root.remove(mesh)
      if (record.sprite) { root.remove(record.sprite); record.sprite.material.dispose() }
      return false
    })
    if (!records.current.length) activity.stop()
  })
  return <>
    <primitive object={root} dispose={null} />
    {screenHit && <Html fullscreen calculatePosition={() => [size.width / 2, size.height / 2]} zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}><div key={screenHit.id} className={`card-table-screen-hit ${screenHit.left ? 'is-left' : ''}`} style={{ animationDelay: `${screenHit.delay}ms` }} aria-hidden='true'><svg viewBox='0 0 128 128'><path fill={screenHit.item === 'tomato' ? '#e8443a' : '#f5c13d'} d={screenHit.item === 'tomato' ? 'M38 38C19 8 3 30 30 51C-8 55 2 81 37 72C17 115 44 129 57 90C77 128 100 111 82 84C128 108 133 77 95 64C130 39 111 15 82 40C81 0 54 0 57 35Z' : 'M64 10 77 45 114 45 85 67 95 107 64 83 33 107 43 67 14 45 51 45Z'} /><circle fill={screenHit.item === 'tomato' ? '#ff7661' : '#fff3b6'} cx='54' cy='50' r='13' /></svg></div></Html>}
  </>
}
