import * as THREE from 'three'
import { createLoader } from './monk.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  ALTAR, COLUMNS, CUSHIONS, DONATION_BOX, HALL, LANTERNS, MOON, PATH, POND, TREES,
} from './layout.js'

const BASE = '/models/hall'
const BG = 0x20251f

// Cảnh dựng hoàn toàn bằng hình khối + texture PBR; chỉ tượng, cây và nhân vật là file GLB.
export const buildWorld = async (renderer, { incense, onProgress = () => {} }) => {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG)
  scene.fog = new THREE.Fog(BG, 16, 52)
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const texLoader = new THREE.TextureLoader()
  const loadTex = (url, srgb) => new Promise((resolve) => {
    texLoader.load(url, (t) => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = anisotropy
      resolve(t)
    }, undefined, () => resolve(null))
  })

  const paintings = Promise.all([
    loadTex(`${BASE}/altar-devotion.jpg`, true),
    loadTex(`${BASE}/altar-wall-calm-20261102.jpg`, true),
  ])
  const environment = loadTex(`${BASE}/environment/woodland.jpg`, true)
  const gltfLoader = createLoader()
  const models = Object.fromEntries(['buddha.glb', 'avalokitesvara.glb', 'mahastamaprapta.glb', 'pine.glb'].map((file) => [file,
    gltfLoader.loadAsync(`${BASE}/models/${file}`).catch((error) => {
      console.warn('[Sảnh] Không nạp được mô hình', file, error)
      return null
    }),
  ]))

  const sets = {}
  await Promise.all(['cloth', 'ground', 'plaster', 'rock', 'roof', 'stone', 'wood'].map(async (name) => {
    const [map, normalMap, roughnessMap] = await Promise.all([
      loadTex(`${BASE}/materials/${name}/color.jpg`, true),
      loadTex(`${BASE}/materials/${name}/normal.jpg`),
      loadTex(`${BASE}/materials/${name}/roughness.jpg`),
    ])
    sets[name] = { map, normalMap, roughnessMap }
  }))
  onProgress(0.35)
  const pbr = (name, repeatX = 1, repeatY = repeatX, extra = {}) => {
    const s = sets[name]
    const tex = (t) => {
      if (!t) return null
      const c = t.clone()
      c.repeat.set(repeatX, repeatY)
      c.needsUpdate = true
      return c
    }
    return new THREE.MeshStandardMaterial({ map: tex(s.map), normalMap: tex(s.normalMap), roughnessMap: tex(s.roughnessMap), ...extra })
  }

  // Ánh sáng: một nguồn chính ấm từ trên, ambient thấp, vài đèn ấm cục bộ.
  scene.add(new THREE.HemisphereLight(0x9fb39a, 0x1a1f19, 0.55))
  const sun = new THREE.DirectionalLight(0xffdcae, 1.7)
  sun.position.set(6, 18, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  scene.add(sun, sun.target)
  const hallLight = new THREE.PointLight(0xffc27a, 14, 20, 1.6)
  hallLight.position.set(0, 4.6, -2)
  const altarLight = new THREE.SpotLight(0xffd59a, 70, 22, 0.5, 0.6, 1.4)
  altarLight.position.set(0, 5.4, -3.5)
  altarLight.target.position.set(0, 2.2, -10.8)
  const pathLight = new THREE.PointLight(0xffa851, 9, 14, 1.6)
  pathLight.position.set(0, 2.4, 18)
  const moonLight = new THREE.PointLight(0xdfe8ff, 26, 26, 1.2)
  moonLight.position.set(0, 7, -21.5)
  scene.add(hallLight, altarLight, altarLight.target, pathLight, moonLight)

  const zones = {
    hall: new THREE.Group(),
    front: new THREE.Group(),
    pond: new THREE.Group(),
    moon: new THREE.Group(),
    grounds: new THREE.Group(),
  }
  const zoneInfo = {
    hall: { x: 0, z: -2.5, r: 15 },
    front: { x: 0, z: 18, r: 12 },
    pond: { x: POND.x, z: POND.z, r: 8 },
    moon: { x: 0, z: -21.5, r: 11 },
  }
  Object.values(zones).forEach((g) => scene.add(g))
  const groundMeshes = []
  const occluders = []
  const box = (w, h, d, mat, x, y, z, group, { cast = true, receive = true } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z)
    m.castShadow = cast
    m.receiveShadow = receive
    group.add(m)
    return m
  }

  // ---------- Mặt đất, sân, lối đi ----------
  const groundMat = pbr('ground', 22, 22, { color: 0x8f9a7f })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), groundMat)
  ground.receiveShadow = true
  zones.grounds.add(ground)
  groundMeshes.push(ground)
  const stoneMat = pbr('stone', 4, 4)
  const court = new THREE.Mesh(new THREE.PlaneGeometry(13, 5).rotateX(-Math.PI / 2), pbr('stone', 5, 2))
  court.position.set(0, 0.01, 10.9)
  court.receiveShadow = true
  zones.front.add(court)
  const pathLen = PATH.toZ - 13.4
  const path = new THREE.Mesh(new THREE.PlaneGeometry(PATH.halfWidth * 2, pathLen).rotateX(-Math.PI / 2), pbr('stone', 1.5, pathLen / 2.4))
  path.position.set(0, 0.012, 13.4 + pathLen / 2)
  path.receiveShadow = true
  zones.front.add(path)

  // ---------- Chánh điện ----------
  const hallW = HALL.maxX - HALL.minX
  const hallD = HALL.maxZ - HALL.minZ
  const hallCZ = (HALL.maxZ + HALL.minZ) / 2
  // Bệ thấp hơn sàn gỗ 1cm và bậc thềm thấp dần dưới mép bệ: không mặt nào trùng cao độ (trùng là z-fighting, nhấp nháy).
  const platformTop = HALL.floorY - 0.01
  const platform = box(hallW + 0.6, platformTop, hallD + 0.4, pbr('stone', 8, 1), 0, platformTop / 2, hallCZ, zones.hall, { cast: false })
  platform.material.color = new THREE.Color(0xb8b2a4)
  const woodFloor = pbr('wood', 6, 6, { color: 0xc9a27a })
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(hallW, hallD).rotateX(-Math.PI / 2), woodFloor)
  floor.position.set(0, HALL.floorY, hallCZ)
  floor.receiveShadow = true
  zones.hall.add(floor)
  groundMeshes.push(floor)
  for (let i = 0; i < 3; i++) {
    const h = platformTop * (3 - i) / 4
    const step = box(HALL.doorHalf * 2 + 0.4, h, 0.22, stoneMat, 0, h / 2, HALL.maxZ + 0.2 + 0.11 + i * 0.22, zones.hall, { cast: false })
    groundMeshes.push(step)
  }

  const wallH = 5.4
  const plaster = pbr('plaster', 4, 2, { color: 0xe6dccb })
  const wallY = HALL.floorY + wallH / 2
  occluders.push(
    box(0.3, wallH, hallD, plaster, HALL.minX, wallY, hallCZ, zones.hall),
    box(0.3, wallH, hallD, plaster, HALL.maxX, wallY, hallCZ, zones.hall),
    box(hallW, wallH, 0.3, plaster, 0, wallY, HALL.minZ, zones.hall),
  )
  const wood = pbr('wood', 1, 3, { color: 0x7a3b26 })
  const darkWood = pbr('wood', 3, 1, { color: 0x4a2a1c })
  // Mặt tiền: cửa song gỗ đóng hai bên, giữa mở.
  const lattice = latticeTexture()
  const doorMat = new THREE.MeshStandardMaterial({ map: lattice, color: 0xf3e3c3, emissive: 0x6b4520, emissiveIntensity: 0.25, roughness: 0.9 })
  const sideW = HALL.maxX - HALL.doorHalf
  for (const sign of [-1, 1]) {
    const cx = sign * (HALL.doorHalf + sideW / 2)
    occluders.push(box(sideW, wallH - 1.2, 0.18, doorMat, cx, HALL.floorY + (wallH - 1.2) / 2, HALL.maxZ, zones.hall))
    box(sideW, 1.2, 0.3, plaster, cx, HALL.floorY + wallH - 0.6, HALL.maxZ, zones.hall)
  }
  box(HALL.doorHalf * 2, 1.2, 0.3, plaster, 0, HALL.floorY + wallH - 0.6, HALL.maxZ, zones.hall)
  // Cột gỗ (instanced) trong điện và mặt tiền.
  const colGeo = new THREE.CylinderGeometry(0.24, 0.27, wallH, 14)
  const colPos = [...COLUMNS, ...[-10, -6.5, -3, 3, 6.5, 10].map((x) => [x, HALL.maxZ + 0.15])]
  const cols = new THREE.InstancedMesh(colGeo, wood, colPos.length)
  const m4 = new THREE.Matrix4()
  colPos.forEach(([x, z], i) => cols.setMatrixAt(i, m4.makeTranslation(x, HALL.floorY + wallH / 2, z)))
  cols.castShadow = true
  cols.receiveShadow = true
  zones.hall.add(cols)
  // Trần và xà.
  const ceiling = box(hallW, 0.2, hallD, darkWood, 0, HALL.floorY + wallH + 0.1, hallCZ, zones.hall)
  occluders.push(ceiling)
  for (let z = HALL.minZ + 2; z < HALL.maxZ; z += 4) box(hallW, 0.34, 0.3, wood, 0, HALL.floorY + wallH - 0.17, z, zones.hall, { cast: false })
  box(0.4, 0.4, hallD, wood, -8.8, HALL.floorY + wallH - 0.2, hallCZ, zones.hall, { cast: false })
  box(0.4, 0.4, hallD, wood, 8.8, HALL.floorY + wallH - 0.2, hallCZ, zones.hall, { cast: false })
  // Mái: khối chóp cụt bốn mặt + nóc.
  const roofMat = pbr('roof', 10, 4, { color: 0x5d6460 })
  const roofGeo = new THREE.CylinderGeometry(0.42, 1, 1, 4, 1).rotateY(Math.PI / 4)
  const roof = new THREE.Mesh(roofGeo, roofMat)
  roof.scale.set((hallW + 4.5) / Math.SQRT2 * 1, 3.6, (hallD + 4) / Math.SQRT2)
  roof.position.set(0, HALL.floorY + wallH + 0.2 + 1.8, hallCZ)
  roof.castShadow = true
  zones.hall.add(roof)
  box(hallW * 0.48, 0.5, 0.5, pbr('roof', 4, 1, { color: 0x3c4240 }), 0, HALL.floorY + wallH + 3.95, hallCZ, zones.hall)

  // Tranh thờ sau tượng và hai bên tường.
  const [paintTex, wallTex] = await paintings
  onProgress(0.5)
  if (paintTex) {
    paintTex.wrapS = paintTex.wrapT = THREE.ClampToEdgeWrapping
    const p = new THREE.Mesh(new THREE.PlaneGeometry(11.6, 5.8), new THREE.MeshStandardMaterial({ map: paintTex, roughness: 0.95, color: 0xb0a090 }))
    p.position.set(0, HALL.floorY + 2.75, HALL.minZ + 0.17)
    zones.hall.add(p)
  }
  if (wallTex) {
    wallTex.wrapS = wallTex.wrapT = THREE.ClampToEdgeWrapping
    const mat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, color: 0x8c8274 })
    for (const sign of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.9), mat)
      w.position.set(sign * (HALL.maxX - 0.17), HALL.floorY + 3.1, -4.5)
      w.rotation.y = -sign * Math.PI / 2
      zones.hall.add(w)
    }
  }

  // Bệ thờ, bàn thờ, nến.
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xb08a3e, metalness: 0.75, roughness: 0.38 })
  const altarBase = box(ALTAR.maxX - ALTAR.minX, 0.7, ALTAR.maxZ - ALTAR.minZ - 0.4, darkWood, 0, HALL.floorY + 0.35, (ALTAR.minZ + ALTAR.maxZ) / 2 - 0.2, zones.hall)
  altarBase.material = darkWood
  const lotusBase = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.55, 0.9, 8), goldMat)
  lotusBase.position.set(0, HALL.floorY + 1.15, -10.9)
  lotusBase.castShadow = true
  zones.hall.add(lotusBase)
  box(5.2, 0.12, 1.1, wood, 0, HALL.floorY + 1.0, -8.95, zones.hall)
  box(4.8, 0.9, 0.9, darkWood, 0, HALL.floorY + 0.45, -8.95, zones.hall)
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffb050, emissiveIntensity: 0.6 })
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffd38a })
  const flames = []
  for (const x of [-2, 2]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 10), candleMat)
    c.position.set(x, HALL.floorY + 1.26, -8.95)
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6).scale(1, 1.8, 1), flameMat)
    f.position.set(x, HALL.floorY + 1.53, -8.95)
    flames.push(f)
    f.userData.keep = true
    zones.hall.add(c, f)
  }
  for (const x of [-1, 0, 1]) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.14, 14), goldMat)
    bowl.position.set(x, HALL.floorY + 1.13, -8.95)
    zones.hall.add(bowl)
  }

  // Hòm công đức: chỉ để xem.
  const boxGroup = new THREE.Group()
  const chest = box(0.8, 0.85, 0.6, darkWood, 0, 0.425, 0, boxGroup)
  chest.material = darkWood
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3), new THREE.MeshStandardMaterial({ map: labelTexture('Công đức'), roughness: 0.6 }))
  plaque.position.set(0, 0.5, 0.302)
  box(0.36, 0.02, 0.06, new THREE.MeshBasicMaterial({ color: 0x111111 }), 0, 0.855, 0, boxGroup, { cast: false })
  boxGroup.add(plaque)
  boxGroup.position.set(DONATION_BOX.x, HALL.floorY, DONATION_BOX.z)
  boxGroup.rotation.y = -0.35
  zones.hall.add(boxGroup)

  // 100 nệm (một draw call).
  const cushionGeo = new THREE.BoxGeometry(0.95, 0.12, 0.82)
  const cushionMat = pbr('cloth', 1, 1, { color: 0x9a4a2e })
  const cushions = new THREE.InstancedMesh(cushionGeo, cushionMat, CUSHIONS.length)
  CUSHIONS.forEach((c, i) => cushions.setMatrixAt(i, m4.makeTranslation(c.x, HALL.floorY + 0.06, c.z)))
  cushions.receiveShadow = true
  zones.hall.add(cushions)

  // Đèn hoa sen treo trong điện.
  const lotusLampMat = new THREE.MeshStandardMaterial({ color: 0xffc9b8, emissive: 0xff9a6a, emissiveIntensity: 0.9, roughness: 0.7 })
  const lampGeo = new THREE.SphereGeometry(0.28, 12, 8).scale(1, 0.8, 1)
  const cordMat = new THREE.MeshBasicMaterial({ color: 0x2a1a12 })
  for (const x of [-6, -2, 2, 6]) for (const z of [-5, 0.5, 5]) {
    const l = new THREE.Mesh(lampGeo, lotusLampMat)
    l.position.set(x, HALL.floorY + 4.0, z)
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.2, 4), cordMat)
    cord.position.set(x, HALL.floorY + 4.8, z)
    zones.hall.add(l, cord)
  }

  // ---------- Tượng ----------
  const placeStatue = async (file, height, x, y, z) => {
    try {
      const gltf = await models[file]
      if (!gltf) return
      const s = gltf.scene
      const b = new THREE.Box3().setFromObject(s)
      const scale = height / (b.max.y - b.min.y)
      s.scale.setScalar(scale)
      s.position.set(x, y - b.min.y * scale, z)
      s.traverse((o) => {
        if (o.isMesh) {
          // Tượng nằm trong điện có mái che nắng: bóng của tượng không ai thấy mà tốn ~0,5ms GPU.
          o.castShadow = false
          o.receiveShadow = true
          o.userData.keep = true
          if (o.material) o.material.envMapIntensity = 1.3
        }
      })
      zones.hall.add(s)
    } catch (error) {
      console.warn('[Sảnh] Không nạp được tượng', file, error)
    }
  }
  await Promise.all([
    placeStatue('buddha.glb', 3.5, 0, HALL.floorY + 1.6, -10.9),
    placeStatue('avalokitesvara.glb', 3.9, -3.9, HALL.floorY + 0.72, -10.5),
    placeStatue('mahastamaprapta.glb', 3.9, 3.9, HALL.floorY + 0.72, -10.5),
  ])
  for (const x of [-3.9, 3.9]) {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, 0.3, 8), goldMat)
    ped.position.set(x, HALL.floorY + 0.85, -10.5)
    zones.hall.add(ped)
  }
  onProgress(0.75)

  // ---------- Lư hương ----------
  const bronze = new THREE.MeshStandardMaterial({ color: 0x5f4a2c, metalness: 0.85, roughness: 0.42 })
  const censer = new THREE.Group()
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.35, 8), stoneMat)
  base.position.y = 0.175
  const potProfile = [[0.0, 0], [0.42, 0], [0.55, 0.12], [0.58, 0.35], [0.5, 0.5], [0.56, 0.56], [0.0, 0.56]].map(([r, y]) => new THREE.Vector2(r, y))
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potProfile, 24), bronze)
  pot.position.y = 0.55
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8b847a, roughness: 1 }))
  ash.position.y = 1.08
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.25, 6), bronze)
    const a = (i / 3) * Math.PI * 2
    leg.position.set(Math.cos(a) * 0.38, 0.45, Math.sin(a) * 0.38)
    censer.add(leg)
  }
  censer.add(base, pot, ash)
  censer.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  censer.position.set(incense.x, 0, incense.z)
  zones.front.add(censer)
  occluders.push(censer)
  const stickGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 4).translate(0, 0.5, 0)
  const stickMat = new THREE.MeshStandardMaterial({ color: 0x8a3b23 })
  const emberGeo = new THREE.SphereGeometry(0.018, 6, 4)
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a })
  const sticks = []
  for (let i = 0; i < 12; i++) {
    const stick = new THREE.Mesh(stickGeo, stickMat)
    const ember = new THREE.Mesh(emberGeo, emberMat)
    const a = i * 2.39996
    const r = 0.08 + (i % 4) * 0.07
    stick.position.set(Math.cos(a) * r, 1.08, Math.sin(a) * r)
    stick.rotation.set(Math.sin(a) * 0.08, 0, Math.cos(a) * 0.08)
    stick.visible = ember.visible = false
    stick.userData.keep = ember.userData.keep = true
    censer.add(stick, ember)
    sticks.push({ stick, ember })
  }
  const smoke = createSmoke(new THREE.Vector3(incense.x, 1.45, incense.z))
  zones.front.add(smoke.points)

  // ---------- Đường đèn lồng ----------
  const lanternPostGeo = new THREE.BoxGeometry(0.18, 1.3, 0.18)
  const lanternGeo = new THREE.CylinderGeometry(0.2, 0.17, 0.42, 10)
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffd9a8, emissive: 0xff9433, emissiveIntensity: 1.2, roughness: 0.8 })
  const capGeo = new THREE.ConeGeometry(0.3, 0.18, 10)
  const lanternMeshes = []
  for (const [x, z] of LANTERNS) {
    const post = new THREE.Mesh(lanternPostGeo, stoneMat)
    post.position.set(x, 0.65, z)
    post.castShadow = true
    const l = new THREE.Mesh(lanternGeo, lanternMat)
    l.position.set(x, 1.52, z)
    const cap = new THREE.Mesh(capGeo, darkWood)
    cap.position.set(x, 1.82, z)
    zones.front.add(post, l, cap)
    lanternMeshes.push(l)
  }

  // ---------- Cây ----------
  try {
    const pine = await models['pine.glb']
    if (pine) {
      // Vật liệu gốc là MeshPhysicalMaterial (đắt nhất); Standard trông gần như y hệt với cây.
      pine.scene.traverse((o) => {
        if (!o.isMesh || !o.material.isMeshPhysicalMaterial) return
        const m = o.material
        o.material = new THREE.MeshStandardMaterial({
          name: m.name, map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, metalnessMap: m.metalnessMap,
          color: m.color, roughness: m.roughness, metalness: m.metalness, alphaTest: m.alphaTest, side: m.side, transparent: m.transparent,
        })
        m.dispose()
      })
      const variants = pine.scene.children.slice()
      variants.forEach((v) => {
        v.position.set(0, 0, 0)
        // ponytail: cây ~200k tam giác mỗi cây, không đổ bóng để khỏi vẽ lại trong shadow pass.
        v.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false } })
      })
      TREES.forEach(([x, z], i) => {
        const t = variants[i % variants.length].clone()
        t.userData.keep = true // mỗi cây ~130k tam giác: giữ riêng để còn cắt theo khung nhìn từng cây
        const b = new THREE.Box3().setFromObject(t)
        const h = 3.6 + ((i * 37) % 10) / 4
        const s = h / (b.max.y - b.min.y)
        t.scale.multiplyScalar(s)
        t.position.set(x, -b.min.y * s, z)
        t.rotation.y = i * 1.7
        const zone = z > HALL.maxZ ? zones.front : z < MOON.maxZ + 2 ? zones.moon : zones.grounds
        zone.add(t)
      })
    }
  } catch (error) {
    console.warn('[Sảnh] Không nạp được cây', error)
  }
  onProgress(0.9)

  // ---------- Hồ sen ----------
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1f3a32, roughness: 0.06, metalness: 0.55, envMapIntensity: 1.4 }))
  water.position.set(POND.x, 0.04, POND.z)
  zones.pond.add(water)
  const rockMat = pbr('rock', 1, 1, { color: 0x9a978c })
  const rockGeo = new THREE.DodecahedronGeometry(0.45, 0)
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 34)
  const q = new THREE.Quaternion()
  const sc = new THREE.Vector3()
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2
    const r = POND.r + 0.15 + (i % 3) * 0.12
    q.setFromEuler(new THREE.Euler(i, i * 2, 0))
    sc.set(1 + (i % 4) * 0.2, 0.55 + (i % 3) * 0.15, 1 + (i % 5) * 0.12)
    rocks.setMatrixAt(i, m4.compose(new THREE.Vector3(POND.x + Math.cos(a) * r, 0.12, POND.z + Math.sin(a) * r), q, sc))
  }
  rocks.castShadow = true
  zones.pond.add(rocks)
  const padGeo = new THREE.CircleGeometry(0.42, 18, 0.35, Math.PI * 2 - 0.35).rotateX(-Math.PI / 2)
  const padMat = new THREE.MeshStandardMaterial({ color: 0x3f6b36, roughness: 0.7, side: THREE.DoubleSide })
  const pads = new THREE.InstancedMesh(padGeo, padMat, 22)
  const petalGeo = new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.55, 1.6, 1)
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xf2b5c4, emissive: 0x8a3550, emissiveIntensity: 0.25, roughness: 0.6 })
  const lotusFlowers = new THREE.Group()
  const padData = []
  for (let i = 0; i < 22; i++) {
    const a = i * 2.39996
    const r = 0.8 + ((i * 53) % 37) / 37 * (POND.r - 1.4)
    const x = POND.x + Math.cos(a) * r
    const z = POND.z + Math.sin(a) * r
    padData.push({ x, z, rot: i * 0.9, s: 0.8 + (i % 4) * 0.2 })
    if (i % 3 === 0) {
      const flower = new THREE.Group()
      for (let p = 0; p < 8; p++) {
        const petal = new THREE.Mesh(petalGeo, petalMat)
        petal.rotation.set(0.5 + (p % 2) * 0.25, (p / 8) * Math.PI * 2, 0, 'YXZ')
        flower.add(petal)
      }
      flower.position.set(x + 0.08, 0.08, z)
      lotusFlowers.add(flower)
    }
  }
  zones.pond.add(pads, lotusFlowers)

  // ---------- Sân trăng ----------
  const moonFloor = new THREE.Mesh(new THREE.PlaneGeometry(MOON.maxX - MOON.minX, MOON.maxZ - MOON.minZ).rotateX(-Math.PI / 2), pbr('stone', 6, 4, { color: 0xd7d3c8 }))
  moonFloor.position.set(0, 0.015, (MOON.minZ + MOON.maxZ) / 2)
  moonFloor.receiveShadow = true
  zones.moon.add(moonFloor)
  const lowWall = pbr('stone', 6, 0.5, { color: 0xa8a294 })
  box(MOON.maxX - MOON.minX + 0.6, 0.6, 0.3, lowWall, 0, 0.3, MOON.minZ - 0.15, zones.moon)
  for (const sign of [-1, 1]) box(0.3, 0.6, MOON.maxZ - MOON.minZ, lowWall, sign * (MOON.maxX + 0.15), 0.3, (MOON.minZ + MOON.maxZ) / 2, zones.moon)
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }))
  moonDisc.position.set(-10, 26, -70)
  moonDisc.lookAt(0, 2, 0)
  const halo = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, depthWrite: false, fog: false }))
  halo.position.copy(moonDisc.position).add(new THREE.Vector3(0, 0, -0.1))
  halo.lookAt(0, 2, 0)
  scene.add(moonDisc, halo)
  for (const [x, z] of [[-7.5, -18], [7.5, -18], [-7.5, -25.5], [7.5, -25.5]]) {
    const post = new THREE.Mesh(lanternPostGeo, stoneMat)
    post.position.set(x, 0.65, z)
    const l = new THREE.Mesh(lanternGeo, lanternMat)
    l.position.set(x, 1.52, z)
    zones.moon.add(post, l)
  }

  // Môi trường (phản chiếu nhẹ cho hồ, tượng đồng).
  const envTex = await environment
  if (envTex) {
    envTex.mapping = THREE.EquirectangularReflectionMapping
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromEquirectangular(envTex).texture
    scene.environmentIntensity = 0.35
    envTex.dispose()
    pmrem.dispose()
  }
  onProgress(1)

  // Cập nhật theo khung hình: lửa nến, đèn lồng lay nhẹ, sen trôi, khói nhang.
  const dummy = new THREE.Object3D()
  const update = (dt, now, incenseList = []) => {
    const t = now / 1000
    flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 9 + i * 2) * 0.12 + Math.sin(t * 23 + i) * 0.05 })
    lanternMat.emissiveIntensity = 1.15 + Math.sin(t * 2.1) * 0.06 + Math.sin(t * 7.3) * 0.03
    padData.forEach((p, i) => {
      dummy.position.set(p.x + Math.sin(t * 0.2 + i) * 0.05, 0.06 + Math.sin(t * 0.8 + i) * 0.006, p.z + Math.cos(t * 0.17 + i) * 0.05)
      dummy.rotation.set(0, p.rot + Math.sin(t * 0.1 + i) * 0.1, 0)
      dummy.scale.setScalar(p.s)
      dummy.updateMatrix()
      pads.setMatrixAt(i, dummy.matrix)
    })
    pads.instanceMatrix.needsUpdate = true
    // Mỗi nén hương cháy ngắn dần trong 10 phút; khói theo số nén đang cháy.
    const live = incenseList.filter((i) => now - i.at < 600_000).slice(-sticks.length)
    sticks.forEach(({ stick, ember }, i) => {
      const item = live[i]
      stick.visible = ember.visible = Boolean(item)
      if (!item) return
      const left = 1 - (now - item.at) / 600_000
      stick.scale.y = 0.12 + 0.33 * left
      ember.position.set(stick.position.x, stick.position.y + stick.scale.y, stick.position.z)
      ember.scale.setScalar(1 + Math.sin(t * 5 + i) * 0.25)
    })
    const fresh = live.filter((i) => now - i.at < 8000).length
    smoke.update(dt, live.length * 1.2 + fresh * 6)
  }

  const keep = new Set([...groundMeshes, ...occluders])
  occluders.forEach((o) => o.traverse((c) => keep.add(c)))
  Object.values(zones).forEach((zone) => mergeStatic(zone, keep))

  return { scene, zones, zoneInfo, groundMeshes, occluders, sun, update, puff: () => smoke.burst(26) }
}

const latticeTexture = () => {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#f1e2c6'
  g.fillRect(0, 0, 256, 256)
  g.strokeStyle = '#6a3a22'
  g.lineWidth = 7
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke()
    g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 2)
  return t
}

const labelTexture = (text) => {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#7a1f17'
  g.fillRect(0, 0, 256, 128)
  g.strokeStyle = '#d6aa55'
  g.lineWidth = 8
  g.strokeRect(8, 8, 240, 112)
  g.fillStyle = '#e9c77a'
  g.font = '600 42px serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 128, 66)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const softDot = (stops) => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  stops.forEach(([o, col]) => grad.addColorStop(o, col))
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}
const haloTexture = () => softDot([[0, 'rgba(255,244,214,0.55)'], [0.45, 'rgba(255,244,214,0.12)'], [1, 'rgba(255,244,214,0)']])

// Khói: một Points với tối đa 90 hạt; hạt bay lên, nở ra rồi tan.
const createSmoke = (origin) => {
  const MAX = 90
  const positions = new Float32Array(MAX * 3)
  const sizes = new Float32Array(MAX)
  const alphas = new Float32Array(MAX)
  const parts = Array.from({ length: MAX }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vz: 0, seed: Math.random() * 10 }))
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { map: { value: softDot([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]) } },
    vertexShader: `attribute float size; attribute float alpha; varying float vAlpha;
      void main(){ vAlpha = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 300.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying float vAlpha;
      void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.86,0.85,0.82), c.a * vAlpha); }`,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  let carry = 0
  const spawn = () => {
    const p = parts.find((q) => q.life <= 0)
    if (!p) return
    p.max = 5 + Math.random() * 3
    p.life = p.max
    p.x = origin.x + (Math.random() - 0.5) * 0.25
    p.y = origin.y
    p.z = origin.z + (Math.random() - 0.5) * 0.25
    p.vx = (Math.random() - 0.5) * 0.06
    p.vz = (Math.random() - 0.5) * 0.06
  }
  const update = (dt, rate) => {
    carry += dt * Math.min(rate, 14)
    while (carry >= 1) { spawn(); carry -= 1 }
    const t = performance.now() / 1000
    parts.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= dt
        const age = 1 - p.life / p.max
        p.x += (p.vx + Math.sin(t * 0.7 + p.seed) * 0.05 * age) * dt
        p.z += (p.vz + Math.cos(t * 0.6 + p.seed) * 0.04 * age) * dt
        p.y += (0.32 - age * 0.12) * dt
        positions.set([p.x, p.y, p.z], i * 3)
        sizes[i] = 0.18 + age * 1.1
        alphas[i] = Math.min(1, age * 6) * (1 - age) * 0.38
      } else alphas[i] = 0
    })
    geo.attributes.position.needsUpdate = true
    geo.attributes.size.needsUpdate = true
    geo.attributes.alpha.needsUpdate = true
  }
  return { points, update, burst: (n) => { for (let i = 0; i < n; i++) spawn() } }
}

// Gộp các mesh tĩnh cùng vật liệu (và cùng cờ đổ/nhận bóng) trong một khu thành một mesh:
// ~250 draw call của đèn lồng, nến, bậc, xà… còn vài chục. Bỏ qua thứ có animation, mesh
// instanced/có xương, và mesh dùng cho va chạm/raycast (sàn, tường).
const mergeStatic = (zone, keep) => {
  zone.updateMatrixWorld(true)
  const buckets = new Map()
  zone.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || keep.has(o)) return
    for (let p = o; p && p !== zone; p = p.parent) if (p.userData.keep) return
    const g = o.geometry
    if (!g.index || !g.attributes.normal || !g.attributes.uv) return
    const key = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(o)
  })
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue
    const geos = meshes.map((m) => {
      const g = new THREE.BufferGeometry()
      g.setIndex(m.geometry.index.clone())
      for (const name of ['position', 'normal', 'uv']) g.setAttribute(name, m.geometry.attributes[name].clone())
      return g.applyMatrix4(m.matrixWorld)
    })
    const merged = mergeGeometries(geos)
    if (!merged) continue
    const first = meshes[0]
    const mesh = new THREE.Mesh(merged, first.material)
    mesh.castShadow = first.castShadow
    mesh.receiveShadow = first.receiveShadow
    zone.add(mesh)
    meshes.forEach((m) => m.removeFromParent())
  }
}
