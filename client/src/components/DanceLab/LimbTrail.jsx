import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

// Vệt sáng bám theo một khớp (bàn tay/bàn chân): dải ribbon luôn quay về camera, lấy mẫu vị trí
// thế giới của xương mỗi khung hình. Additive blending nên chồng lên nhau sẽ sáng thêm như phát quang.
// Đứng yên thì các mẫu dồn về một điểm và vệt tự tắt.
// Độ dài tính theo thời gian (không theo số khung) để máy yếu/fps thấp không kéo vệt dài cả giây.

const SAMPLES = 32
const DURATION = 0.3 // giây

const vertexShader = /* glsl */ `
  attribute float aFade;
  attribute float aSide;
  varying float vFade;
  varying float vSide;
  void main() {
    vFade = aFade;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  varying float vSide;
  void main() {
    float edge = 1.0 - vSide * vSide;          // mềm ở hai mép dải
    float core = smoothstep(0.55, 1.0, edge);  // lõi giữa gần trắng
    float a = vFade * vFade * edge * uOpacity; // đuôi mờ dần
    gl_FragColor = vec4(mix(uColor, vec3(1.0), core * 0.6 * vFade), a);
  }
`

const LimbTrail = ({ bone, color, width = 0.12 }) => {
  const camera = useThree((s) => s.camera)
  const started = useRef(false)

  const { geometry, material, points, times, tmp } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const position = new Float32Array(SAMPLES * 2 * 3)
    const fade = new Float32Array(SAMPLES * 2)
    const side = new Float32Array(SAMPLES * 2)
    const index = []
    for (let i = 0; i < SAMPLES; i++) {
      side[i * 2] = -1
      side[i * 2 + 1] = 1
      if (i < SAMPLES - 1) {
        const a = i * 2
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aFade', new THREE.BufferAttribute(fade, 1).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1))
    g.setIndex(index)
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.95 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
    return {
      geometry: g,
      material: m,
      points: Array.from({ length: SAMPLES }, () => new THREE.Vector3()),
      times: new Float64Array(SAMPLES), // thời điểm lấy mẫu, cùng thứ tự với points (cũ -> mới)
      tmp: { head: new THREE.Vector3(), tangent: new THREE.Vector3(), view: new THREE.Vector3(), side: new THREE.Vector3() }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- màu cập nhật qua uniform bên dưới
  }, [])

  useEffect(() => { material.uniforms.uColor.value.set(color) }, [material, color])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  useFrame(({ clock }) => {
    const { head, tangent, view, side } = tmp
    const now = clock.elapsedTime
    bone.getWorldPosition(head)
    if (!started.current) {
      // khởi tạo toàn bộ mẫu tại khớp, tránh vệt kéo từ gốc toạ độ ở khung đầu
      points.forEach((p) => p.copy(head))
      times.fill(now)
      started.current = true
    }
    const oldest = points.shift()
    points.push(oldest.copy(head))
    times.copyWithin(0, 1)
    times[SAMPLES - 1] = now

    // Mẫu quá DURATION bị dồn về mẫu còn hạn cũ nhất -> phần đó thành đoạn rỗng, không vẽ.
    let firstLive = SAMPLES - 1
    while (firstLive > 0 && now - times[firstLive - 1] <= DURATION) firstLive--
    for (let i = 0; i < firstLive; i++) points[i].copy(points[firstLive])

    const pos = geometry.attributes.position.array
    const fade = geometry.attributes.aFade.array
    for (let i = 0; i < SAMPLES; i++) {
      const p = points[i]
      const f = i < firstLive ? 0 : Math.max(0, 1 - (now - times[i]) / DURATION) // 1 = đầu (khớp), 0 = đuôi
      fade[i * 2] = fade[i * 2 + 1] = f
      tangent.subVectors(points[Math.min(i + 1, SAMPLES - 1)], points[Math.max(i - 1, 0)])
      view.subVectors(camera.position, p)
      side.crossVectors(tangent, view)
      const len = side.length()
      if (len > 1e-6) side.multiplyScalar((width * 0.5 * (0.25 + 0.75 * f)) / len)
      else side.set(0, 0, 0)
      const o = i * 6
      pos[o] = p.x - side.x; pos[o + 1] = p.y - side.y; pos[o + 2] = p.z - side.z
      pos[o + 3] = p.x + side.x; pos[o + 4] = p.y + side.y; pos[o + 5] = p.z + side.z
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aFade.needsUpdate = true
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={10} />
}

export default LimbTrail
