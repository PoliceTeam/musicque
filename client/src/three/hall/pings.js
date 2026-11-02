import * as THREE from 'three'
import { DEFAULT_PING, PING_KINDS, PING_MS } from './layout.js'

// Ping trong sảnh: điểm click khi bấm đi (chỉ mình thấy) và ping đánh dấu một chỗ (mọi người thấy).
// Các loại ping chọn cho hợp không khí thiền — không có "nguy hiểm", "rút lui"...

const ringGeo = new THREE.RingGeometry(0.34, 0.42, 48).rotateX(-Math.PI / 2)
const dotGeo = new THREE.CircleGeometry(0.07, 20).rotateX(-Math.PI / 2)
const pillarGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.8, 10, 1, true).translate(0, 0.9, 0)
const fadeMat = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })

export const createPingLayer = (scene, labelsEl) => {
  const group = new THREE.Group()
  group.renderOrder = 5
  scene.add(group)
  const items = []

  // Điểm click: vòng thu dần vào tâm rồi tan, khoảng nửa giây.
  const click = (x, y, z) => {
    const ring = new THREE.Mesh(ringGeo, fadeMat(0xd9f2c4))
    const dot = new THREE.Mesh(dotGeo, fadeMat(0xd9f2c4))
    ring.position.set(x, y + 0.03, z)
    dot.position.set(x, y + 0.031, z)
    group.add(ring, dot)
    items.push({ type: 'click', at: performance.now(), ms: 550, meshes: [ring, dot] })
  }

  const add = ({ kind, x, y, z, name, mine }) => {
    const def = PING_KINDS[kind] || PING_KINDS[DEFAULT_PING]
    const rings = [0, 1].map(() => new THREE.Mesh(ringGeo, fadeMat(def.color)))
    const pillar = new THREE.Mesh(pillarGeo, fadeMat(def.color))
    rings.forEach((r) => r.position.set(x, y + 0.03, z))
    pillar.position.set(x, y, z)
    group.add(pillar, ...rings)
    const el = document.createElement('div')
    el.className = `hall-ping${mine ? ' is-mine' : ''}`
    el.style.setProperty('--ping', `#${def.color.toString(16).padStart(6, '0')}`)
    const icon = document.createElement('span')
    icon.className = 'hall-ping__icon'
    icon.textContent = def.icon
    const text = document.createElement('span')
    text.textContent = def.label
    el.append(icon, text)
    if (name && !mine) {
      const who = document.createElement('small')
      who.textContent = name
      el.append(who)
    }
    labelsEl.appendChild(el)
    items.push({ type: 'ping', at: performance.now(), ms: PING_MS, meshes: [pillar, ...rings], rings, pillar, el, x, y, z })
    // Giới hạn số ping đang hiện để không rối mắt.
    const pings = items.filter((i) => i.type === 'ping')
    if (pings.length > 12) remove(pings[0])
  }

  const remove = (item) => {
    // Không dispose vật liệu: dispose làm three.js giải phóng luôn chương trình shader dùng chung,
    // ping sau phải biên dịch lại (khựng ~130ms). Vật liệu không có texture, GC tự thu.
    item.meshes.forEach((m) => group.remove(m))
    item.el?.remove()
    items.splice(items.indexOf(item), 1)
  }

  const update = (now, place) => {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]
      const t = (now - it.at) / it.ms
      if (t >= 1) {
        remove(it)
        continue
      }
      if (it.type === 'click') {
        const s = 1.5 - t * 1.1
        it.meshes[0].scale.setScalar(s)
        it.meshes.forEach((m) => { m.material.opacity = (1 - t) * 0.9 })
        continue
      }
      const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1
      it.rings.forEach((r, k) => {
        const p = (t * 2.5 + k * 0.5) % 1
        r.scale.setScalar(0.5 + p * 2.4)
        r.material.opacity = (1 - p) * 0.85 * fade
      })
      it.pillar.material.opacity = (0.55 + Math.sin(now / 120) * 0.1) * fade
      it.el.style.opacity = String(fade)
      place(it.el, it.x, it.y + 2.05, it.z)
    }
  }

  const dispose = () => {
    while (items.length) remove(items[0])
    group.removeFromParent()
  }

  return { click, add, update, dispose }
}
