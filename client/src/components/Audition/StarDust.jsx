import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

// Bụi sao rơi từ một khớp (tay/chân) khi qua Finish Move: hạt sinh tại vị trí thế giới của xương,
// văng nhẹ ra rồi rơi xuống theo trọng lực, nhấp nháy và nhỏ dần. Toạ độ thế giới nên phải đặt
// ngoài group đã dời chỗ của nhân vật (như LimbTrail). `active` = false thì ngừng sinh hạt mới,
// hạt đang bay vẫn rơi nốt.

const COUNT = 140
const LIFE = 1.3 // giây
const RATE = 90 // hạt mỗi giây
const GRAVITY = -1.8
const COLORS = ['#ffe27a', '#ffffff', '#ffd84d', '#ff9df0', '#9ff4ff'].map((c) => new THREE.Color(c))

const vertexShader = /* glsl */ `
  attribute float aLife;
  attribute float aSize;
  attribute float aSeed;
  attribute vec3 aColor;
  uniform float uPx;
  uniform float uTime;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float twinkle = 0.65 + 0.35 * sin(uTime * 18.0 + aSeed * 40.0);
    vAlpha = aLife * twinkle;
    vColor = aColor;
    gl_PointSize = aSize * (0.35 + 0.65 * aLife) * uPx / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(mix(vColor, vec3(1.0), t.r * 0.5) * t.a, t.a * vAlpha);
  }
`

// Ngôi sao 4 cánh + quầng sáng, vẽ một lần dùng chung.
let starTexture = null
const getStarTexture = () => {
  if (starTexture) return starTexture
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? 31 : 5
    const a = (i * Math.PI) / 4 - Math.PI / 2
    ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fill()
  starTexture = new THREE.CanvasTexture(c)
  return starTexture
}

const StarDust = ({ bone, active = true, size = 0.07 }) => {
  const camera = useThree((s) => s.camera)
  const height = useThree((s) => s.size.height)
  const spawn = useRef(0)
  const next = useRef(0)

  const { geometry, material, vel } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(COUNT), 1).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(COUNT), 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(COUNT), 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
    const m = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: getStarTexture() }, uPx: { value: 400 }, uTime: { value: 0 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    return { geometry: g, material: m, vel: new Float32Array(COUNT * 3) }
  }, [])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  const head = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    // kích thước điểm theo pixel: chiều cao khung / (2·tan(fov/2))
    material.uniforms.uPx.value = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
    material.uniforms.uTime.value = clock.elapsedTime
    const pos = geometry.attributes.position.array
    const life = geometry.attributes.aLife.array
    const sizes = geometry.attributes.aSize.array
    const seeds = geometry.attributes.aSeed.array
    const colors = geometry.attributes.aColor.array

    if (active) {
      bone.getWorldPosition(head)
      spawn.current += RATE * dt
      while (spawn.current >= 1) {
        spawn.current -= 1
        const i = next.current
        next.current = (i + 1) % COUNT
        const o = i * 3
        pos[o] = head.x + (Math.random() - 0.5) * 0.06
        pos[o + 1] = head.y + (Math.random() - 0.5) * 0.06
        pos[o + 2] = head.z + (Math.random() - 0.5) * 0.06
        vel[o] = (Math.random() - 0.5) * 0.5
        vel[o + 1] = Math.random() * 0.35 - 0.05
        vel[o + 2] = (Math.random() - 0.5) * 0.5
        life[i] = 1
        sizes[i] = size * (0.5 + Math.random())
        seeds[i] = Math.random()
        COLORS[Math.floor(Math.random() * COLORS.length)].toArray(colors, o)
      }
      geometry.attributes.aSize.needsUpdate = true
      geometry.attributes.aSeed.needsUpdate = true
      geometry.attributes.aColor.needsUpdate = true
    }

    const drag = Math.exp(-dt * 1.5)
    for (let i = 0; i < COUNT; i++) {
      if (life[i] <= 0) continue
      const o = i * 3
      vel[o] *= drag
      vel[o + 2] *= drag
      vel[o + 1] += GRAVITY * dt
      pos[o] += vel[o] * dt
      pos[o + 1] = Math.max(0.02, pos[o + 1] + vel[o + 1] * dt) // chạm sàn thì nằm lại tắt dần
      pos[o + 2] += vel[o + 2] * dt
      life[i] = Math.max(0, life[i] - dt / LIFE)
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aLife.needsUpdate = true
  })

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={11} />
}

export default StarDust
