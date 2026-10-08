import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Hud, OrthographicCamera } from '@react-three/drei'
import atlas from './ui_atlas.json'
import { FRAME } from './auditionConfig'
import { BOARD_ASPECT, drawBoard, fontFamily, loadAtlasImage, makeTexture, slotOf } from './resultBoard'

// Màn bảng điểm cuối bài dựng hoàn toàn trong scene WebGL:
// - thế giới 3D: bục vàng (hạng 1), bục bạc (hạng 2), đèn rọi, pháo giấy; hạng 3 trở đi đứng dưới sàn;
// - lớp Hud (camera trực giao, đơn vị = pixel): bảng thông số từng người, tiêu đề, nút bấm 3D.


const PODIUM = {
  1: { color: '#ffc93c', emissive: '#7a4a00', ring: '#ffe27a' },
  2: { color: '#cfd8e3', emissive: '#2b3440', ring: '#ffffff' }
}

const canvasTexture = (w, h, draw) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  return makeTexture(c)
}

const Podium = ({ rank }) => {
  const [x, z, h] = slotOf(rank)
  const style = PODIUM[rank]
  const ring = useRef(null)
  const numberTex = useMemo(() => canvasTexture(256, 256, (ctx, w, hh) => {
    ctx.font = `italic 900 190px ${fontFamily()}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = rank === 1 ? '#5a3800' : '#3a4250'
    ctx.fillText(String(rank), w / 2, hh / 2 + 8)
  }), [rank])
  useEffect(() => () => numberTex.dispose(), [numberTex])
  useFrame(({ clock }) => {
    if (ring.current) ring.current.material.emissiveIntensity = 1.6 + Math.sin(clock.elapsedTime * 3 + rank) * 0.8
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 0.7, h, 48]} />
        <meshStandardMaterial color={style.color} emissive={style.emissive} emissiveIntensity={0.35} metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh ref={ring} position={[0, h + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.6, 48]} />
        <meshStandardMaterial color={style.ring} emissive={style.ring} emissiveIntensity={2} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* số hạng in trên mặt trước bục */}
      <mesh position={[0, h / 2, 0.705]}>
        <planeGeometry args={[Math.min(0.5, h * 1.1), Math.min(0.5, h * 1.1)]} />
        <meshBasicMaterial map={numberTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

const CONFETTI = 260
const CONFETTI_COLORS = ['#ffd84d', '#ff4fd8', '#2fe0ff', '#7dff9a', '#ffffff', '#ff8a3c']

// Pháo giấy rơi phủ khu bục hạng 1–2.
const Confetti = () => {
  const mesh = useRef(null)
  const parts = useMemo(() => Array.from({ length: CONFETTI }, () => ({
    p: new THREE.Vector3((Math.random() - 0.5) * 5 - 0.8, Math.random() * 4.5, (Math.random() - 0.5) * 2 + 0.3),
    v: 0.5 + Math.random() * 0.9,
    sway: Math.random() * Math.PI * 2,
    r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
    spin: (Math.random() - 0.5) * 8
  })), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    const color = new THREE.Color()
    parts.forEach((_, i) => mesh.current.setColorAt(i, color.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length])))
    mesh.current.instanceColor.needsUpdate = true
  }, [parts])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    parts.forEach((c, i) => {
      c.p.y -= c.v * dt
      if (c.p.y < -0.2) c.p.y = 4.5
      c.r.x += c.spin * dt
      c.r.y += c.spin * 0.7 * dt
      dummy.position.set(c.p.x + Math.sin(t * 1.6 + c.sway) * 0.15, c.p.y, c.p.z)
      dummy.rotation.copy(c.r)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[null, null, CONFETTI]} frustumCulled={false}>
      <planeGeometry args={[0.06, 0.035]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  )
}

// Đèn rọi chiếu thẳng xuống một chỗ đứng.
const Spot = ({ rank, color, intensity }) => {
  const [x, z, h] = slotOf(rank)
  const target = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => { target.position.set(x, h, z) }, [target, x, z, h])
  return (
    <>
      <primitive object={target} />
      <spotLight position={[x, 6.5, z + 2.5]} target={target} angle={0.28} penumbra={0.6} intensity={intensity} distance={20} decay={1.2} color={color} castShadow />
    </>
  )
}

export const PodiumWorld = ({ ranks }) => {
  const has = (r) => [...ranks.values()].includes(r)
  return (
    <>
      {has(1) && <Podium rank={1} />}
      {has(2) && <Podium rank={2} />}
      {has(1) && <Spot rank={1} color='#ffe08a' intensity={140} />}
      {has(2) && <Spot rank={2} color='#e8f0ff' intensity={90} />}
      <Confetti />
    </>
  )
}

// ---------- Lớp Hud: bảng thông số + tiêu đề + nút ----------

const Board = ({ entry, x, y, w, delay }) => {
  const h = w * BOARD_ASPECT
  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 480
    c.height = Math.round(480 * BOARD_ASPECT)
    return c
  }, [])
  const tex = useMemo(() => makeTexture(canvas), [canvas])
  const [, setTick] = useState(0)
  useEffect(() => {
    const img = loadAtlasImage(() => setTick((n) => n + 1))
    drawBoard(canvas, entry, img)
    tex.needsUpdate = true
  }) // vẽ lại mỗi lần render (entry đổi hoặc atlas vừa tải xong) — rẻ, chỉ khi bảng điểm mở
  useEffect(() => () => tex.dispose(), [tex])
  const ref = useRef(null)
  const born = useRef(null)
  const top = entry.rank <= 2
  useFrame(({ clock }) => {
    if (!ref.current) return
    if (born.current === null) born.current = clock.elapsedTime
    const t = Math.max(0, clock.elapsedTime - born.current - delay)
    const k = 1 - Math.pow(1 - Math.min(1, t / 0.55), 3) // trồi lên từ dưới
    const float = top ? Math.sin(clock.elapsedTime * 2 + entry.rank) * 4 : 0
    ref.current.position.set(x, y - (1 - k) * (h + 60) + float, 0)
    const s = top ? 1 + Math.sin(clock.elapsedTime * 3) * 0.012 : 1
    ref.current.scale.setScalar(s)
  })
  return (
    <mesh ref={ref} position={[x, y - h, 0]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}

const Title = ({ text, sub, x = 0, y }) => {
  const tex = useMemo(() => canvasTexture(1400, 200, (ctx, w) => {
    const font = fontFamily()
    ctx.textAlign = 'center'
    ctx.font = `italic 900 92px ${font}`
    const g = ctx.createLinearGradient(w / 2 - 400, 0, w / 2 + 400, 0)
    g.addColorStop(0, '#2fe0ff')
    g.addColorStop(1, '#ff4fd8')
    ctx.shadowColor = 'rgba(255, 79, 216, 0.7)'
    ctx.shadowBlur = 24
    ctx.fillStyle = g
    ctx.fillText(text, w / 2, 100)
    if (sub) {
      ctx.shadowBlur = 0
      ctx.font = `700 40px ${font}`
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.fillText(sub, w / 2, 168)
    }
  }), [text, sub])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh position={[x, y, 0]}>
      <planeGeometry args={[620, 89]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}

const Button3D = ({ icon, label, x, y, onClick }) => {
  const [hover, setHover] = useState(false)
  const [tick, setTick] = useState(0)
  const tex = useMemo(() => {
    const img = loadAtlasImage(() => setTick((n) => n + 1))
    return canvasTexture(256, 320, (ctx, w) => {
      const f = atlas.frames[FRAME.icon(icon)]?.frame
      if (img && f) ctx.drawImage(img, f.x, f.y, f.w, f.h, 28, 0, 200, 200)
      ctx.font = `800 40px ${fontFamily()}`
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = '#000'
      ctx.shadowBlur = 8
      ctx.fillText(label, w / 2, 270)
    })
  }, [icon, label, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => tex.dispose(), [tex])
  useEffect(() => () => { document.body.style.cursor = '' }, [])
  return (
    <mesh
      position={[x, y, 1]}
      scale={hover ? 1.08 : 1}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onPointerOver={() => { setHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}
    >
      <planeGeometry args={[88, 110]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}

// entries đã xếp theo thứ tự trái → phải giống chỗ đứng trên sân khấu.
const ResultHud = ({ entries, title, sub, onContinue, onLeave }) => {
  const { width, height } = useThree((s) => s.size)
  const n = Math.max(entries.length, 1)
  const gap = 14
  const w = Math.max(150, Math.min(205, (width - 120) / n - gap))
  const total = n * w + (n - 1) * gap
  const baseY = -height / 2 + (w * BOARD_ASPECT) / 2 + 22
  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 100]} />
      {/* tiêu đề đặt góc trái trên để không đè lên đầu nhân vật trên bục */}
      <Title text={title} sub={sub} x={-width / 2 + 330} y={height / 2 - 62} />
      {entries.map((e, i) => {
        const top = e.rank <= 2
        const bw = top ? w * 1.08 : w
        return (
          <Board
            key={e.userId}
            entry={e}
            w={bw}
            x={-total / 2 + w / 2 + i * (w + gap)}
            y={baseY + (top ? (bw - w) * BOARD_ASPECT * 0.5 + 6 : 0)}
            delay={0.15 + (e.rank - 1) * 0.12}
          />
        )
      })}
      {onContinue && <Button3D icon='retry' label='Phòng chờ' x={width / 2 - 170} y={height / 2 - 72} onClick={onContinue} />}
      {onLeave && <Button3D icon='home' label='Rời phòng' x={width / 2 - 70} y={height / 2 - 72} onClick={onLeave} />}
    </>
  )
}

// results: { entries (theo thứ tự trái → phải), title, sub, onContinue, onLeave }
export const ResultOverlay = ({ results }) => (
  <Hud renderPriority={1}>
    <ResultHud {...results} />
  </Hud>
)

