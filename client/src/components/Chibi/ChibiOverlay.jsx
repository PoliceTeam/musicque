import React, { Suspense, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import ErrorBoundary from '../ErrorBoundary'

const CHIBI_URL = '/models/chibi.glb?v=fbx-reexport'
const PENGUIN_URL = '/models/penguin.glb?v=1'
const CLIP_SWITCH_MS = 15_000
const CLIP_FADE_SEC = 0.45

/*
 * ── Bố cục hai nhân vật ───────────────────────────────────────────────
 * Cả hai đều re-export từ FBX gốc qua Blender (GLB của Sketchfab có scale~100 hỏng).
 * Chibi cao ~1.089 đơn vị; penguin đã được chuẩn hoá lúc convert: chân ở y=0,
 * tư thế đứng cao đúng 1.0 đơn vị.
 *
 * Bao động (animated bbox) đo trong Blender trên TOÀN BỘ số khung của MỌI clip —
 * tức là mép rộng nhất mà tay/chân/cánh với tới trong cả điệu nhảy, không phải
 * bbox tư thế đứng yên:
 *
 *   chibi    x ∈ [-0.479, 0.486]  (rộng 0.966)   cao 0.000 → 1.168
 *   penguin  x ∈ [-0.605, 0.564]  (rộng 1.169)   cao 0.000 → 1.118
 *
 * Đã kiểm lại bằng cách chiếu TỪNG ĐỈNH qua đúng camera dưới đây, quét hết 913
 * khung của cả 3 clip. Toạ độ sau chiếu (NDC, khung là -1..1):
 *
 *   penguin  x ∈ [-0.779, -0.090]
 *   chibi    x ∈ [ 0.041,  0.810]
 *
 * → khe hở 0.131 NDC ≈ 37px ở khổ 560px, lề trái 0.221 và lề phải 0.190 nên
 * không con nào bị cắt. Hai mixer chạy độc lập, pha trôi tự do, nên phải so bao
 * ngoài kiểu này: mọi cặp tư thế đều đã được tính. Sửa scale/vị trí/FRAME_ASPECT
 * thì phải đo lại, đừng ước lượng bằng mắt.
 */
const CHIBI_SCALE = 1.2
const PENGUIN_SCALE = 0.92
const CHIBI_X = 0.64
const PENGUIN_X = -0.67
/** Mặt sàn chung để hai nhân vật đứng cùng một cao độ. */
const GROUND_Y = 0.28

/*
 * fov là góc nhìn DỌC, nên chỉ TỈ LỆ w/h mới quyết định bề ngang nhìn thấy được.
 * Ở z=4.9 vùng nhìn cao 2 × 4.9 × tan(15°) ≈ 2.626 đơn vị, nên bề ngang là
 * 2.626 × FRAME_ASPECT ≈ 3.23 — đủ chứa cặp 2.45 đơn vị và còn dư mỗi bên ~0.39.
 *
 * Khung phải khoá cứng tỉ lệ bằng aspect-ratio: nếu đặt width/height thành hai
 * giá trị chặn px riêng (min(…vh, …px) cho cả hai) thì trên màn hình rất cao,
 * width chạm trần px trước, tỉ lệ tụt xuống và hai model bị cắt mất rìa.
 */
const FRAME_ASPECT = 64 / 52

/** Bỏ metalness/backface để model phẳng màu, hợp với overlay nhẹ. */
function normalizeMaterials(scene) {
  scene.traverse((child) => {
    if (!child.isMesh) return
    child.castShadow = false
    child.receiveShadow = false
    child.frustumCulled = false

    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat) => {
      if (!mat) return
      mat.side = THREE.DoubleSide
      mat.transparent = false
      mat.depthWrite = true
      if ('metalness' in mat) mat.metalness = Math.min(mat.metalness ?? 0, 0.15)
      if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 0.6, 0.55)
      mat.needsUpdate = true
    })
  })
}

/** Ưu tiên clip kpop lên đầu; các clip còn lại giữ nguyên thứ tự. */
function kpopFirst(names) {
  return [...names].sort((a, b) => {
    const aKpop = a.toLowerCase().includes('kpop') ? 0 : 1
    const bKpop = b.toLowerCase().includes('kpop') ? 0 : 1
    return aKpop - bKpop
  })
}

/**
 * Một nhân vật biết nhảy: nạp GLB, chạy vòng các clip và crossfade giữa chúng.
 * Model chỉ có một clip thì phát thẳng, không hẹn giờ đổi clip.
 */
function DancingModel({ url, scale, position, orderClips }) {
  const { scene, animations } = useGLTF(url)
  const { actions, mixer } = useAnimations(animations, scene)

  useEffect(() => {
    normalizeMaterials(scene)
  }, [scene])

  useEffect(() => {
    const names = Object.keys(actions || {})
    if (!names.length) return undefined

    const clipNames = orderClips ? orderClips(names) : names
    clipNames.forEach((name) => {
      const action = actions[name]
      if (!action) return
      action.enabled = true
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
    })

    let index = 0
    actions[clipNames[index]].reset().fadeIn(CLIP_FADE_SEC).play()

    if (clipNames.length < 2) {
      return () => mixer?.stopAllAction()
    }

    const timerId = window.setInterval(() => {
      const nextIndex = (index + 1) % clipNames.length
      const from = actions[clipNames[index]]
      const to = actions[clipNames[nextIndex]]
      if (!from || !to) return

      to.reset().play()
      from.crossFadeTo(to, CLIP_FADE_SEC, true)
      index = nextIndex
    }, CLIP_SWITCH_MS)

    return () => {
      window.clearInterval(timerId)
      mixer?.stopAllAction()
    }
  }, [actions, mixer, orderClips])

  return (
    <group position={position} scale={scale}>
      <primitive object={scene} />
    </group>
  )
}

function Dancers() {
  const chibiPos = useMemo(() => [CHIBI_X, GROUND_Y, 0], [])
  // Chibi có chân ở y ≈ -0.012 (× 1.2), bù lại để hai nhân vật đứng cùng mặt sàn.
  const penguinPos = useMemo(() => [PENGUIN_X, GROUND_Y - 0.015, 0], [])

  return (
    <>
      <DancingModel
        url={CHIBI_URL}
        scale={CHIBI_SCALE}
        position={chibiPos}
        orderClips={kpopFirst}
      />
      {/*
        Không xoay sẵn penguin: điệu nhảy của nó tự quay người (khung 30 quay
        trái, khung 150 quay phải), nên một góc yaw cố định không giữ nó hướng
        về phía chibi được, mà lại làm bbox theo x nở ra vì trộn với chiều z.
      */}
      <DancingModel url={PENGUIN_URL} scale={PENGUIN_SCALE} position={penguinPos} />
    </>
  )
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true
}

function ChibiCanvas() {
  return (
    <div
      className="chibi-overlay"
      aria-hidden="true"
      style={{
        position: 'fixed',
        right: 0,
        bottom: 0,
        width: 'min(64vh, 560px)',
        aspectRatio: String(FRAME_ASPECT),
        // Dưới zIndexPopupBase của antd (1000) để không vẽ đè lên Modal/Drawer.
        zIndex: 900,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        dpr={[1, 1.75]}
        // Lùi camera ra xa mới làm model nhỏ đi (fov cố định); nới bề ngang thì
        // sửa FRAME_ASPECT. Model cao ~1.09 đơn vị; ở z=4.9 nó chiếm ~50% chiều cao khung.
        camera={{ position: [0, 1.44, 4.9], fov: 30, near: 0.1, far: 100 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
        onCreated={({ camera, gl }) => {
          // Ngắm cao hơn tâm model để chân đứng sát đáy khung.
          camera.lookAt(0, 1.39, 0)
          gl.setClearColor(0x000000, 0)
        }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <ambientLight intensity={1} />
        <hemisphereLight intensity={0.7} color="#ffffff" groundColor="#888888" />
        <directionalLight position={[2.5, 4, 3]} intensity={1.45} />
        <directionalLight position={[-2.5, 2, 1]} intensity={0.55} />
        {/*
          Environment tải HDR từ CDN ngoài (raw.githack.com) và có thể bị chặn
          trong mạng nội bộ. Suspense RIÊNG để nó không giữ chân model: model
          hiện ngay, ánh sáng môi trường ghép vào sau nếu tải được.
        */}
        <Suspense fallback={null}>
          <Environment preset="city" environmentIntensity={0.25} />
        </Suspense>
        <Suspense fallback={null}>
          <Dancers />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default function ChibiOverlay() {
  // Người dùng bật "giảm chuyển động" thì bỏ hẳn, khỏi dựng WebGL context.
  if (prefersReducedMotion()) return null

  // <Canvas> đẩy cả lỗi lẫn suspend ra ngoài chính nó
  // ("if (error) throw error" / "if (block) throw block"), nên cần cả hai lớp:
  // ErrorBoundary để model/HDR hỏng không làm trắng trang, và Suspense để
  // promise thoát ra có chỗ đỡ thay vì dội lên tận gốc cây React.
  return (
    <ErrorBoundary label="ChibiOverlay">
      <Suspense fallback={null}>
        <ChibiCanvas />
      </Suspense>
    </ErrorBoundary>
  )
}
