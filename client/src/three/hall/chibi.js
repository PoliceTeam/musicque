import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Chú tiểu chibi dựng hoàn toàn bằng code — không file, không vướng giấy phép.
// Bộ xương có tên và vị trí khớp cố định — bảng tư thế trong monk.js được chỉnh theo đúng bộ xương này.
// Toạ độ theo quy ước file gốc: nhân vật quay mặt về -Z, bên trái (.L) ở phía -X.

const BONES = [
  ['hips', null, [0, 0.7, 0]],
  ['spine', 'hips', [0, 0.06, 0]],
  ['chest', 'spine', [0, 0.12, 0]],
  ['neck', 'chest', [0, 0.1, 0]],
  ['head', 'neck', [0, 0.05, 0]],
  ['upper_arm.L', 'chest', [-0.18, 0.03, 0], [-0.9044746, 0.280779, 0.2807789, 0.1557304]],
  ['forearm.L', 'upper_arm.L', [0, 0.2015565, 0], [-0.0373949, 0.124053, -0.1476102, 0.9805222]],
  ['hand.L', 'forearm.L', [0, 0.1516576, 0], [-0.1254887, 0.1506195, -0.1506196, 0.9689583]],
  ['upper_arm.R', 'chest', [0.18, 0.03, 0], [-0.9044746, -0.280779, -0.2807789, 0.1557304]],
  ['forearm.R', 'upper_arm.R', [0, 0.2015565, 0], [-0.0373949, -0.124053, 0.1476102, 0.9805222]],
  ['hand.R', 'forearm.R', [0, 0.1516576, 0], [-0.1254887, -0.1506195, 0.1506196, 0.9689583]],
  ['thigh.L', 'hips', [-0.095, 0, 0], [-0.9998444, 0, 0, 0.0176388]],
  ['shin.L', 'thigh.L', [0, 0.3402116, 0], [-0.0390453, 0, 0, 0.9992374]],
  ['foot.L', 'shin.L', [0, 0.2802571, 0], [0.6357974, 0, 0, 0.7718561]],
  ['thigh.R', 'hips', [0.095, 0, 0], [-0.9998444, 0, 0, 0.0176388]],
  ['shin.R', 'thigh.R', [0, 0.3402116, 0], [-0.0390453, 0, 0, 0.9992374]],
  ['foot.R', 'shin.R', [0, 0.2802571, 0], [0.6357974, 0, 0, 0.7718561]],
  // Phần áo dưới hông: monk.js nén thấp + xoè rộng xương này khi quỳ để áo trải xuống sàn thay vì lún.
  ['skirt', 'hips', [0, 0, 0]],
]

const COLORS = {
  skin: 0xf3c9a4,
  robe: 0xa7b29a, // áo vải lanh xanh xám
  saffron: 0xe0a33a, // cà sa vàng nghệ
  collar: 0xefe5d0,
  shoe: 0xd9c8a8,
  bead: 0x5b3520, // hạt gỗ
}

// Mức vạt áo trước đi theo đùi (0..1): đủ để đung đưa khi đi và rủ phủ lòng khi quỳ.
const LEG_FOLLOW = 0.2

// Điểm UV trên vùng trắng sau gáy của ảnh mặt (xa nét mặt ở u = 0,75) cho mọi phần không phải đầu.
const BODY_UV = [0.25, 0.5]

const faceTexture = () => {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')
  // Nền trắng: ảnh nhân với màu đỉnh, nên đầu ra màu da còn thân lấy vùng trắng (BODY_UV) ra đúng màu áo.
  g.fillStyle = '#fff'
  g.fillRect(0, 0, 512, 256)
  // Mặt nằm ở hướng -Z của khối cầu, tức u = 0,75 trên ảnh trải.
  const cx = 384
  g.fillStyle = 'rgba(236, 140, 130, 0.35)'
  for (const dx of [-62, 62]) {
    g.beginPath()
    g.ellipse(cx + dx, 150, 20, 11, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.strokeStyle = '#5a3a28'
  g.lineCap = 'round'
  g.lineWidth = 6
  for (const dx of [-38, 38]) {
    // Mắt nhắm hiền: cung cong xuống.
    g.beginPath()
    g.arc(cx + dx, 126, 15, Math.PI * 0.15, Math.PI * 0.85)
    g.stroke()
  }
  g.lineWidth = 5
  g.beginPath()
  g.arc(cx, 150, 11, Math.PI * 0.2, Math.PI * 0.8)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export const createChibiTemplate = () => {
  const scene = new THREE.Group()
  scene.name = 'ChibiMonkRig'
  const bones = {}
  for (const [name, parent, t, q] of BONES) {
    const b = new THREE.Bone()
    b.name = name
    b.position.fromArray(t)
    if (q) b.quaternion.set(q[0], q[1], q[2], q[3])
    ;(parent ? bones[parent] : scene).add(b)
    bones[name] = b
  }
  scene.updateMatrixWorld(true)
  const order = BONES.map(([name]) => name)
  const boneIndex = (name) => order.indexOf(name)

  // Mỗi phần được dựng trong không gian xương của nó rồi đưa về tư thế gốc, gắn cứng vào xương đó.
  // weights(x, y, z) → [[xương, trọng số], …] (tối đa 4) cho phần cần uốn theo nhiều xương (thân áo).
  const parts = []
  const part = (geometry, bone, color, { local = true, weights, uv = false } = {}) => {
    const g = geometry
    if (local) g.applyMatrix4(bones[bone].matrixWorld)
    const n = g.attributes.position.count
    if (!uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2).map((_, i) => BODY_UV[i % 2]), 2))
    const col = new THREE.Color(color)
    const colors = new Float32Array(n * 3)
    const si = new Float32Array(n * 4)
    const sw = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      colors.set([col.r, col.g, col.b], i * 3)
      const list = weights ? weights(g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i)) : [[bone, 1]]
      list.slice(0, 4).forEach(([b, w], k) => {
        si[i * 4 + k] = boneIndex(b)
        sw[i * 4 + k] = w
      })
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4))
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4))
    parts.push(g)
  }
  const limb = (len, r0, r1, open = false) => new THREE.CylinderGeometry(r1, r0, len, 12, 1, open).translate(0, len / 2, 0)

  // Thân áo dáng chuông: phần trên theo ngực, giữa theo lưng, dưới theo hông. Vạt trước phần dưới
  // còn đi theo đùi trái/phải, nên quỳ thì vạt phủ qua gối, đi thì vạt đung đưa theo chân.
  const clamp01 = (v) => Math.max(0, Math.min(1, v))
  const torsoWeights = (x, y, z) => {
    if (y > 0.9) return [['chest', 1]]
    if (y > 0.78) {
      const w = (y - 0.78) / 0.12
      return [['chest', w], ['spine', 1 - w]]
    }
    if (y > 0.7) {
      const w = (y - 0.7) / 0.08
      return [['spine', w], ['hips', 1 - w]]
    }
    const front = clamp01(0.5 - z / 0.3) // mặt trước là -Z
    // Chỉ theo đùi một phần: theo trọn thì khi quỳ (đùi gần nằm ngang) mép vạt trước bị xoay vểnh lên ngang bụng.
    const leg = LEG_FOLLOW * clamp01((0.68 - y) / 0.2) * front
    const left = clamp01(0.5 - x / 0.2) // chân trái ở phía -X
    return [['skirt', 1 - leg], ['thigh.L', leg * left], ['thigh.R', leg * (1 - left)]]
  }
  // Áo hở dưới (không có đáy): khi quỳ vạt trước xoay ra không lộ một mảng đáy tối.
  const robe = [[0.001, 1.0], [0.11, 0.995], [0.19, 0.93], [0.215, 0.82], [0.225, 0.7], [0.255, 0.55], [0.3, 0.42], [0.31, 0.38]]
  // Lathe sinh mặt hướng ra ngoài khi đường viền đi từ dưới lên.
  const profile = (pts) => pts.slice().reverse().map(([r, y]) => new THREE.Vector2(r, y))
  part(new THREE.LatheGeometry(profile(robe), 28), 'hips', COLORS.robe, { local: false, weights: torsoWeights })
  // Vạt cà sa phía trước (hướng -Z) và dải vắt qua vai trái.
  const apron = [[0.2, 0.86], [0.228, 0.72], [0.262, 0.56], [0.312, 0.43], [0.318, 0.41]]
  part(new THREE.LatheGeometry(profile(apron), 14, Math.PI - 0.95, 1.9), 'hips', COLORS.saffron, { local: false, weights: torsoWeights })
  const sash = new THREE.TorusGeometry(0.205, 0.036, 8, 36).scale(1, 1.18, 1.05).rotateZ(0.62).translate(0, 0.82, 0)
  // Dải cà sa uốn theo thân áo; gắn cứng vào ngực thì lúc cúi sâu nó tách khỏi lưng thành một vòng.
  part(sash, 'chest', COLORS.saffron, { local: false, weights: torsoWeights })
  part(new THREE.TorusGeometry(0.1, 0.03, 8, 24).rotateX(Math.PI / 2).translate(0, 0.985, 0), 'chest', COLORS.collar, { local: false })

  // Chuỗi tràng hạt đeo cổ: vòng sau gáy cao, buông thấp trước ngực, có hạt chủ và tua vàng.
  const BEADS = 24
  for (let i = 0; i < BEADS; i++) {
    const t = (i / BEADS) * Math.PI * 2
    const front = (1 + Math.cos(t)) / 2
    const r = 0.15 + 0.08 * front
    part(new THREE.SphereGeometry(0.019, 6, 4).translate(r * Math.sin(t), 0.975 - 0.135 * front, -r * Math.cos(t)), 'chest', COLORS.bead, { local: false })
  }
  part(new THREE.SphereGeometry(0.028, 10, 8).translate(0, 0.815, -0.232), 'chest', COLORS.bead, { local: false })
  part(new THREE.ConeGeometry(0.02, 0.07, 8).translate(0, 0.762, -0.236), 'chest', COLORS.saffron, { local: false })

  // Tay áo rộng, bàn tay tròn.
  for (const s of ['L', 'R']) {
    part(limb(0.2, 0.072, 0.07), `upper_arm.${s}`, COLORS.robe)
    part(limb(0.15, 0.07, 0.082), `forearm.${s}`, COLORS.robe)
    // Khuỷu và gối bo tròn: khi gập không lộ mặt cắt phẳng của ống tay/ống quần.
    part(new THREE.SphereGeometry(0.076, 12, 8), `forearm.${s}`, COLORS.robe)
    part(new THREE.SphereGeometry(0.086, 12, 8), `shin.${s}`, COLORS.robe)
    part(new THREE.SphereGeometry(0.052, 12, 10).translate(0, 0.045, 0), `hand.${s}`, COLORS.skin)
    // Chân ngắn trong ống quần, giày vải.
    // Ống quần đùi kín đầu (ống hở lộ miệng rỗng khi quỳ), nối vào khối gối tròn.
    part(limb(0.28, 0.082, 0.076), `thigh.${s}`, COLORS.robe)
    part(limb(0.33, 0.07, 0.062).translate(0, -0.05, 0), `shin.${s}`, COLORS.robe)
    part(new THREE.SphereGeometry(1, 12, 10).scale(0.066, 0.115, 0.058).translate(0, 0.06, 0.012), `foot.${s}`, COLORS.shoe)
  }
  // Tai.
  for (const x of [-0.248, 0.248]) part(new THREE.SphereGeometry(0.046, 10, 8).scale(0.55, 1, 1).translate(x, 1.19, 0.01), 'head', COLORS.skin, { local: false })

  // Đầu tròn to, trọc, mặt vẽ bằng canvas.
  part(new THREE.SphereGeometry(0.255, 28, 20).translate(0, 1.205, 0), 'head', COLORS.skin, { local: false, uv: true })

  // Gộp cả người (kể cả đầu) thành một mesh một vật liệu: mỗi chú tiểu chỉ tốn một lần vẽ.
  const skeleton = new THREE.Skeleton(order.map((n) => bones[n]))
  const body = new THREE.SkinnedMesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, map: faceTexture(), roughness: 0.8 }))
  body.name = 'ChibiBody'
  scene.add(body)
  body.bind(skeleton)
  scene.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(scene)
  const height = box.max.y - box.min.y
  return { scene, scale: 1.12 / height, floor: box.min.y }
}
