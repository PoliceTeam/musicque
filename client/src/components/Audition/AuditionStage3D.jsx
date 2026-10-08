import React, { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Hud, Lightformer, useGLTF } from '@react-three/drei'
import { CLIP_TEMPO, TARGET_HEIGHT, TRAIL_BONES } from '../DanceLab/danceLab'
import LimbTrail from '../DanceLab/LimbTrail'
import { clipTimeAt } from '../../utils/danceSync'
import { ASSET, DANCER_SPACING, LOBBY_PANEL_SPACE, TRAIL_COLORS } from './auditionConfig'
import LobbyHud from './LobbyHud'
import { PodiumWorld, ResultOverlay } from './ResultScene'
import { fontFamily, makeTexture, slotOf } from './resultBoard'

const FADE = 0.25
const DRIFT_TAU = 1.2 // giây — trượt chậm hơn mức này bị khử (giữ nhân vật trên bục), lắc hông nhanh thì giữ nguyên

// Chiều cao bind-pose của bản gốc (đo một lần, trước khi gắn vào group nào).
const baseHeightOf = (scene) => {
  if (scene.userData.baseHeight === undefined) {
    const box = new THREE.Box3().setFromObject(scene)
    scene.userData.baseHeight = box.max.y - box.min.y
  }
  return scene.userData.baseHeight
}

// anim = { clip, synced, once, timeScale, key }: đổi clip hoặc key thì crossfade sang clip đó.
// synced: thời gian clip lấy từ đồng hồ bài nhạc (khớp phách) thay vì tự chạy.
// Mỗi người chơi một bản clone (SkeletonUtils) — hai người chọn cùng nhân vật vẫn đứng hai chỗ.
const Dancer = ({ url, pos, anim, audioRef, track, latencyRef, trails, name, isMe, isLeader, platform }) => {
  const { scene: source, animations } = useGLTF(url)
  const scene = useMemo(() => cloneSkinned(source), [source])
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene])
  const actions = useMemo(() => Object.fromEntries(animations.map((c) => [c.name, mixer.clipAction(c)])), [animations, mixer])
  const current = useRef(null)
  const hips = useMemo(() => scene.getObjectByName('mixamorigHips'), [scene])
  const drift = useRef(null)
  const root = useRef(null)
  const placed = useRef(false)
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), up: new THREE.Vector3(), v: new THREE.Vector3(), h: new THREE.Vector3() }), [])

  const scale = useMemo(() => {
    const h = baseHeightOf(source)
    return h > 0 ? TARGET_HEIGHT / h : 1
  }, [source])

  const limbs = useMemo(
    () => TRAIL_BONES.map((l) => ({ ...l, bone: scene.getObjectByName(l.bone) })).filter((l) => l.bone),
    [scene]
  )

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.frustumCulled = false
        // vật liệu xuất từ FBX Mixamo có roughness thấp -> da/vải bóng như nhựa ướt dưới đèn sân khấu
        for (const m of [].concat(o.material)) if (m && 'roughness' in m) m.roughness = Math.max(m.roughness, 0.75)
      }
    })
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(scene)
    }
  }, [scene, mixer])

  useEffect(() => {
    const next = actions[anim.clip]
    if (!next) return
    next.setLoop(anim.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
    next.clampWhenFinished = Boolean(anim.once)
    next.timeScale = anim.synced ? 0 : (anim.timeScale ?? 1)
    next.reset().setEffectiveWeight(1).fadeIn(FADE).play()
    const prev = current.current
    if (prev && prev !== next) prev.fadeOut(FADE)
    current.current = next
  }, [actions, anim.clip, anim.key, anim.once, anim.synced, anim.timeScale])

  useFrame((_, dt) => {
    // trượt mượt tới chỗ đứng mới khi đổi hạng (người dẫn đầu bước lên trước)
    if (root.current) {
      const p = root.current.position
      const y = pos[2] || 0 // độ cao bục (bảng điểm cuối bài)
      if (!placed.current) { p.set(pos[0], y, pos[1]); placed.current = true }
      const k = 1 - Math.exp(-dt * 3)
      p.x += (pos[0] - p.x) * k
      p.y += (y - p.y) * k
      p.z += (pos[1] - p.z) * k
    }
    mixer.update(dt)
    const a = current.current
    const audio = audioRef.current
    const tempo = CLIP_TEMPO[anim.clip]
    if (anim.synced && a && audio && tempo) {
      a.time = clipTimeAt(audio.currentTime - latencyRef.current, track, tempo)
      mixer.update(0)
    }
    // Khử root motion trôi ngang (Swing, Northern Soul đi khắp sân) để luôn đứng trên bục:
    // trừ trung bình trượt của vị trí ngang của hông, giữ nguyên thành phần thẳng đứng.
    if (hips?.parent && dt > 0) {
      const { q, up, v, h } = tmp
      hips.parent.getWorldQuaternion(q)
      up.set(0, 1, 0).applyQuaternion(q.invert()).normalize()
      v.copy(up).multiplyScalar(hips.position.dot(up))
      h.copy(hips.position).sub(v)
      if (!drift.current) drift.current = { ema: h.clone(), anchor: h.clone() }
      drift.current.ema.lerp(h, 1 - Math.exp(-dt / DRIFT_TAU))
      hips.position.copy(v).add(h).sub(drift.current.ema).add(drift.current.anchor)
    }
  })

  return (
    <>
      <group ref={root}>
        <group scale={scale}>
          <primitive object={scene} />
        </group>
        {/* vòng sáng chỉ đánh dấu nhân vật của mình */}
        {isMe && <Platform kind={platform} />}
        {name && <NameTag name={name} isMe={isMe} isLeader={isLeader} />}
      </group>
      {/* vệt sáng dựng theo toạ độ thế giới nên phải nằm ngoài group đã dời chỗ */}
      {trails && limbs.map((l) => <LimbTrail key={l.id} bone={l.bone} color={TRAIL_COLORS[l.kind]} />)}
    </>
  )
}

// Nhãn tên trên đầu: sprite (luôn quay về camera) vẽ bằng canvas, không dùng HTML.
const NameTag = ({ name, isMe, isLeader }) => {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 96
    const ctx = c.getContext('2d')
    ctx.font = `800 40px ${fontFamily()}`
    const text = `${isLeader ? '♛ ' : ''}${name}`
    const w = Math.min(500, ctx.measureText(text).width + 48)
    const x = (512 - w) / 2
    ctx.beginPath()
    ctx.roundRect(x, 14, w, 68, 34)
    ctx.fillStyle = isLeader ? 'rgba(60, 40, 0, 0.85)' : 'rgba(10, 6, 30, 0.75)'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = isLeader || isMe ? '#ffd84d' : 'rgba(255,255,255,0.25)'
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = isLeader || isMe ? '#ffd84d' : '#e9e4ff'
    ctx.fillText(text, 256, 50, 470)
    return makeTexture(c)
  }, [name, isMe, isLeader])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <sprite position={[0, TARGET_HEIGHT + 0.16, 0]} scale={[0.9, 0.169, 1]} renderOrder={5}>
      <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

const PLATFORM = { idle: 'platform_cyan', dance: 'platform_pink', showtime: 'platform_gold' }

// Vòng sáng dưới chân: ảnh đã vẽ sẵn phối cảnh nên dựng như billboard đứng sát sàn.
const Platform = ({ kind }) => {
  const textures = useLoader(THREE.TextureLoader, Object.values(PLATFORM).map((n) => ASSET.effect(n)))
  const map = textures[Object.keys(PLATFORM).indexOf(kind)] || textures[0]
  const mat = useRef(null)
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = 0.75 + 0.25 * Math.sin(clock.elapsedTime * 4)
  })
  return (
    // vừa ôm hai bàn chân (~0.9m ngang), tỉ lệ ảnh 512×160
    <mesh position={[0, 0.03, 0.12]} renderOrder={-1}>
      <planeGeometry args={[0.95, 0.3]} />
      <meshBasicMaterial ref={mat} map={map} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  )
}

// Camera gốc (0, 1.35, 7.6) nhìn (0, 0.95, 0) — lùi xa cho nhân vật nhỏ lại; hàng sau đông người thì
// lùi thêm theo cùng tỉ lệ (phóng đều quanh gốc sàn nên đường chân trời trên ảnh nền giữ nguyên).
// Bảng điểm cuối bài: nhìn thấp xuống để nhân vật + bục nằm nửa trên khung, chừa nửa dưới cho bảng thông số.
const CAMERA = {
  play: { y: 1.35, z: 7.6, look: 0.95 },
  podium: { y: 2.1, z: 8.6, look: -0.15 }
}

// panelPx: bảng phòng chờ chiếm mép phải màn hình — vừa khung theo phần còn trống và dời camera
// sang phải để cả nhóm nhân vật nằm giữa phần trống đó.
const CameraRig = ({ halfWidth, mode, panelPx = 0 }) => {
  const camera = useThree((s) => s.camera)
  const { width, height } = useThree((s) => s.size)
  useEffect(() => {
    const c = CAMERA[mode] || CAMERA.play
    const half = halfWidth + 0.9
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const freeW = Math.max(width - panelPx, width * 0.4)
    const k = Math.max(1, half / (c.z * tanV * (freeW / height)))
    const shift = c.z * k * tanV * (width / height) * (panelPx / width)
    camera.position.set(shift, c.y * k, c.z * k)
    camera.lookAt(shift, c.look * k, 0)
  }, [camera, halfWidth, width, height, mode, panelPx])
  return null
}

// Không dùng useProgress: store của nó cập nhật ngay trong lúc component khác đang suspend
// (useLoader), React báo "Cannot update a component while rendering a different component".
const Loader = () => (
  <Html center>
    <div className='au-loading'>Đang tải nhân vật…</div>
  </Html>
)

// DEV: tab ẩn thì rAF dừng, kiểm thử tự bước khung qua window.__auditionStage.step(n).
const DevHook = () => {
  const get = useThree((s) => s.get)
  const advance = useThree((s) => s.advance)
  useEffect(() => {
    window.__auditionStage = {
      step: (frames = 1, dt = 1 / 60) => {
        for (let i = 0; i < frames; i++) {
          get().clock.oldTime = performance.now() - dt * 1000
          advance(performance.now())
        }
      }
    }
    return () => { delete window.__auditionStage }
  }, [get, advance])
  return null
}

// Đội hình: người điểm cao nhất (isLeader) đứng giữa, bước lên trước; những người còn lại
// đứng ngang hàng phía sau. Chưa ai dẫn đầu thì cả phòng đứng một hàng.
export const LEADER_Z = 1.3
// Có người dẫn đầu thì hàng sau chừa trống chính giữa (không ai bị người đứng trước che khuất):
// lấy các ô ±0.5, ±1.5… khoảng cách gần tâm trước, rồi xếp trái → phải theo thứ tự trang đưa vào.
const backSlots = (n) => {
  const slots = []
  for (let j = 0; slots.length < n; j++) slots.push(-(j + 0.5), j + 0.5)
  return slots.slice(0, n).sort((a, b) => a - b).map((k) => k * DANCER_SPACING)
}

// Bảng điểm cuối bài: đứng theo hạng (RANK_SLOTS) — hạng 1–2 trên bục, còn lại dưới sàn.
const podiumLayout = (dancers, ranks) => {
  const pos = new Map(dancers.map((d) => {
    const [x, z, h] = slotOf(ranks.get(d.id) || dancers.length)
    return [d.id, [x, z, h]]
  }))
  const halfWidth = Math.max(0, ...[...pos.values()].map((p) => Math.abs(p[0])))
  return { pos, halfWidth }
}

const layout = (dancers) => {
  const leader = dancers.find((d) => d.isLeader)
  const row = dancers.filter((d) => d !== leader)
  const xs = leader ? backSlots(row.length) : row.map((_, i) => (i - (row.length - 1) / 2) * DANCER_SPACING)
  const pos = new Map(row.map((d, i) => [d.id, [xs[i], leader ? -0.2 : 0]]))
  if (leader) pos.set(leader.id, [0, LEADER_Z])
  const halfWidth = Math.max(0, ...xs.map(Math.abs))
  return { pos, halfWidth }
}

// dancers: [{ id, url, anim, name, isMe, isLeader, platform }] — thứ tự hàng sau do trang quyết định.
// results (bảng điểm cuối bài): { ranks: Map(userId → hạng), hud: { entries, title, sub, onContinue, onLeave } }
// lobby (phòng chờ, dựng bằng WebGL): xem LobbyHud
const AuditionStage3D = ({ dancers, audioRef, track, latencyRef, showtime, results, lobby }) => {
  const { pos, halfWidth } = results ? podiumLayout(dancers, results.ranks) : layout(dancers)
  return (
  <Canvas
    shadows
    dpr={[1, 2]}
    camera={{ position: [0, 1.35, 7.6], fov: 35, near: 0.1, far: 80 }}
    gl={{ antialias: true, alpha: true, preserveDrawingBuffer: import.meta.env.DEV }}
  >
    <CameraRig halfWidth={halfWidth} mode={results ? 'podium' : 'play'} panelPx={lobby ? LOBBY_PANEL_SPACE : 0} />
    {import.meta.env.DEV && <DevHook />}
    <hemisphereLight args={['#ffffff', '#2a1838', 1.6]} />
    <directionalLight position={[0, 2.5, 10]} intensity={2.4} color='#ffffff' />
    <directionalLight position={[3, 7, 7]} intensity={2} color='#e6dcff' castShadow />
    <spotLight position={[0, 7, 4]} angle={0.45} penumbra={0.7} intensity={showtime ? 160 : 50} distance={30} decay={1.5} color={showtime ? '#ffe28a' : '#ffffff'} />
    <directionalLight position={[-4, 3, -5]} intensity={2.6} color='#ff2fd0' />
    <directionalLight position={[4, 3, -5]} intensity={2.6} color='#2fe0ff' />
    {/* phản chiếu nhẹ thôi: mạnh quá thì da/vải bóng như ướt */}
    <Environment resolution={64} environmentIntensity={0.45}>
      <Lightformer form='rect' intensity={2} position={[0, 2, 6]} scale={[8, 4, 1]} color='#ffffff' />
      <Lightformer form='rect' intensity={1.5} position={[-6, 3, -2]} scale={[4, 6, 1]} color='#ff2fd0' />
      <Lightformer form='rect' intensity={1.5} position={[6, 3, -2]} scale={[4, 6, 1]} color='#2fe0ff' />
    </Environment>
    <Suspense fallback={<Loader />}>
      {dancers.map((d) => (
        <Dancer
          key={`${d.id}-${d.url}`}
          url={d.url}
          pos={pos.get(d.id)}
          anim={d.anim}
          audioRef={audioRef}
          track={track}
          latencyRef={latencyRef}
          trails={d.isMe && !results}
          name={dancers.length > 1 && !results ? d.name : null}
          isMe={d.isMe && !results}
          isLeader={d.isLeader}
          platform={d.platform}
        />
      ))}
      {results && <PodiumWorld ranks={results.ranks} />}
    </Suspense>
    {results && <ResultOverlay results={results.hud} />}
    {lobby && !results && (
      <Hud renderPriority={1}>
        <LobbyHud lobby={lobby} />
      </Hud>
    )}
    <ContactShadows position={[0, 0.01, 0.5]} scale={14} blur={2.4} opacity={0.55} far={3} />
  </Canvas>
  )
}

export default AuditionStage3D
