import React, { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, useAnimations, useGLTF, useProgress } from '@react-three/drei'
import { CLIP_TEMPO, DANCERS, ONE_SHOT_CLIPS, SPACING, TARGET_HEIGHT, TRAIL_BONES } from './danceLab'
import { clipTimeAt } from '../../utils/danceSync'
import LimbTrail from './LimbTrail'

const FADE = 0.3

const Dancer = ({ url, x, clip, loop, speed, paused, restartKey, onClips, trails, trailColors, music }) => {
  const { scene, animations } = useGLTF(url)
  const { actions, mixer } = useAnimations(animations, scene)
  const current = useRef(null)

  // Đo một lần ở tư thế bind, khi scene chưa gắn vào group nào, rồi cache lại: useGLTF dùng chung
  // một scene, mount lại (ẩn/hiện, HMR) mà đo nữa thì Box3 tính cả scale của group cũ.
  const scale = useMemo(() => {
    if (scene.userData.baseHeight === undefined) {
      const box = new THREE.Box3().setFromObject(scene)
      scene.userData.baseHeight = box.max.y - box.min.y
    }
    const h = scene.userData.baseHeight
    return h > 0 ? TARGET_HEIGHT / h : 1
  }, [scene])

  useEffect(() => {
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.frustumCulled = false // khung bao ở tư thế bind, động tác breakdance văng ra ngoài sẽ bị cắt
      }
    })
    onClips?.(animations.map((a) => a.name))
  }, [scene, animations, onClips])

  useEffect(() => {
    const next = actions[clip]
    if (!next) return
    const once = !loop || ONE_SHOT_CLIPS.has(clip)
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
    next.clampWhenFinished = once
    next.reset().fadeIn(FADE).play()
    const prev = current.current
    if (prev && prev !== next) prev.fadeOut(FADE)
    current.current = next
  }, [actions, clip, loop, restartKey])

  // GLTFLoader bỏ dấu ':' khỏi tên node: 'mixamorig:LeftHand' -> 'mixamorigLeftHand'.
  const limbs = useMemo(
    () => TRAIL_BONES.map((l) => ({ ...l, bone: scene.getObjectByName(l.bone) })).filter((l) => l.bone),
    [scene]
  )

  const tempo = CLIP_TEMPO[clip]
  const synced = Boolean(music && tempo)

  useEffect(() => {
    // Theo nhạc: thời gian clip do đồng hồ <audio> quyết định, mixer chỉ còn lo fade giữa các clip.
    mixer.timeScale = synced ? 1 : paused ? 0 : speed
    const a = actions[clip]
    if (a) a.timeScale = synced ? 0 : 1
  }, [mixer, actions, clip, synced, paused, speed])

  useFrame(() => {
    const a = current.current
    const audio = music?.audioRef.current
    if (!synced || !a || !audio) return
    const once = !loop || ONE_SHOT_CLIPS.has(clip)
    a.time = clipTimeAt(audio.currentTime, music.track, tempo, { loop: !once, nudge: music.nudge })
    mixer.update(0) // áp tư thế ngay khung này (useAnimations đã update mixer trước đó)
  })

  return (
    <>
      <group position={[x, 0, 0]} scale={scale}>
        <primitive object={scene} />
      </group>
      {/* Vệt sáng nằm ở gốc scene (toạ độ thế giới), không nằm trong group đã scale */}
      {trails && limbs.map((l) => (
        <LimbTrail key={l.id} bone={l.bone} color={trailColors[l.kind]} />
      ))}
    </>
  )
}

// Camera gốc (0, 1.4, 9) nhìn (0, 1.3, 0); khung hẹp hoặc nhiều người thì lùi ra theo cùng tỉ lệ
// (phóng đều quanh gốc sàn nên đường chân trời của sàn trên ảnh nền giữ nguyên vị trí).
const CameraRig = ({ count }) => {
  const camera = useThree((s) => s.camera)
  const { width, height } = useThree((s) => s.size)
  useEffect(() => {
    const half = ((Math.max(count, 1) - 1) / 2) * SPACING + 1.2
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (width / height)
    const k = Math.max(1, half / (9 * tanH))
    camera.position.set(0, 1.4 * k, 9 * k)
    camera.lookAt(0, 1.3 * k, 0)
  }, [camera, count, width, height])
  return null
}

// DEV: tab ẩn thì requestAnimationFrame dừng, công cụ kiểm thử tự bước khung hình qua window.__danceLab.step(n).
const DevHook = () => {
  const get = useThree((s) => s.get)
  const advance = useThree((s) => s.advance)
  useEffect(() => {
    const v = new THREE.Vector3()
    window.__danceLab = {
      // độ cao hông nhân vật đầu tiên — kiểm thử tự động đo xem nhún có rơi đúng phách không
      hipsY: () => get().scene.getObjectByName('mixamorigHips')?.getWorldPosition(v).y ?? null,
      step: (frames = 1, dt = 1 / 60) => {
        for (let i = 0; i < frames; i++) {
          const clock = get().clock
          clock.oldTime = performance.now() - dt * 1000 // ép delta của khung kế tiếp = dt
          advance(performance.now())
        }
      }
    }
    return () => { delete window.__danceLab }
  }, [get, advance])
  return null
}

const Loader = () => {
  const { progress } = useProgress()
  return (
    <Html center>
      <div className='dl-loading'>Đang tải nhân vật… {Math.round(progress)}%</div>
    </Html>
  )
}

const DanceStage = ({ stage, visible, clipOf, loop, speed, paused, restartKey, onClips, trails, music }) => {
  const shown = DANCERS.filter((d) => visible[d.id])
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.4, 9], fov: 30, near: 0.1, far: 60 }}
      // Nền là ảnh CSS phía sau; DEV giữ buffer để công cụ kiểm thử đọc được khung hình WebGL.
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: import.meta.env.DEV }}
    >
      <CameraRig count={shown.length} />
      {import.meta.env.DEV && <DevHook />}
      <hemisphereLight args={['#ffffff', '#30203a', 1.6]} />
      {/* Đèn trước mặt: fill trắng từ phía camera + key chéo từ trên xuống mang màu sân khấu */}
      <directionalLight position={[0, 2.5, 10]} intensity={2.4} color='#ffffff' />
      <directionalLight position={[3, 7, 7]} intensity={2.2} color={stage.key} castShadow />
      <spotLight position={[0, 7, 6]} angle={0.55} penumbra={0.8} intensity={60} distance={25} decay={1.5} color='#ffffff' />
      {/* Đèn ngược viền màu */}
      <directionalLight position={[-4, 3, -5]} intensity={2.5} color={stage.rim} />
      <directionalLight position={[4, 3, -5]} intensity={2.5} color={stage.rim} />
      {/* Môi trường phản chiếu tự dựng (không tải HDR ngoài) để vật liệu PBR không bị tối */}
      <Environment resolution={64}>
        <Lightformer form='rect' intensity={2} position={[0, 2, 6]} scale={[8, 4, 1]} color='#ffffff' />
        <Lightformer form='rect' intensity={1.5} position={[-6, 3, -2]} scale={[4, 6, 1]} color={stage.rim} />
        <Lightformer form='rect' intensity={1.5} position={[6, 3, -2]} scale={[4, 6, 1]} color={stage.rim} />
      </Environment>
      <Suspense fallback={<Loader />}>
        {shown.map((d, i) => (
          <Dancer
            key={d.id}
            url={d.url}
            x={(i - (shown.length - 1) / 2) * SPACING}
            clip={clipOf(d.id)}
            loop={loop}
            speed={speed}
            paused={paused}
            restartKey={restartKey}
            onClips={onClips}
            trails={trails}
            trailColors={stage.trail}
            music={music}
          />
        ))}
      </Suspense>
      <ContactShadows position={[0, 0.01, 0]} scale={12} blur={2.4} opacity={0.55} far={3} />
    </Canvas>
  )
}

DANCERS.forEach((d) => useGLTF.preload(d.url))

export default DanceStage
