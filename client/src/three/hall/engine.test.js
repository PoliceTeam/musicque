import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { HallEngine } from './engine'

const setup = () => new HallEngine({ canvas: {}, labels: {}, net: { selfId: 'me', emit: vi.fn() } })

it('lư trống vẫn hiện nút dâng hương trong phạm vi 2m, kể cả đúng biên server cho phép', () => {
  const engine = setup()
  engine.state = { incense: [] }
  engine.player.x = 2
  engine.player.z = 9
  engine.syncUi()
  expect(engine.ui.nearIncense).toBe(true)
  engine.player.x = 2.01
  engine.syncUi()
  expect(engine.ui.nearIncense).toBe(false)
})

it('dâng hương trả đúng lỗi server và chỉ chạy hiệu ứng sau khi được nhận', () => {
  const engine = setup()
  engine.world = { puff: vi.fn() }
  engine.pray = vi.fn()
  const callback = vi.fn()
  engine.net.emit.mockImplementation((event, data, ack) => ack({ ok: false, code: 'too_far', error: 'Hãy tới gần lư hương hơn để dâng hương.' }))
  engine.offerIncense(callback)
  expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({ ok: false, code: 'too_far' }))
  expect(engine.world.puff).not.toHaveBeenCalled()
  expect(engine.pray).not.toHaveBeenCalled()
  engine.net.emit.mockImplementation((event, data, ack) => ack({ ok: true }))
  engine.offerIncense(callback)
  expect(callback).toHaveBeenLastCalledWith({ ok: true })
  expect(engine.world.puff).toHaveBeenCalledOnce()
  expect(engine.pray).toHaveBeenCalledOnce()
})

describe('đồng bộ tư thế từ sảnh', () => {
  it('reconnect khôi phục tư thế đứng và vị trí server dù vẫn được cấp nệm cũ', () => {
    const engine = setup()
    Object.assign(engine.player, { x: 7.2, z: 6.3, pose: 'kneeling', base: 'kneeling' })
    engine.handledCushion = 99
    engine.applySelf({ id: 'me', name: 'An', cushionId: 99, waiting: false, beads: 0, x: 0, z: 10, pose: 'standing' })
    expect(engine.player).toMatchObject({ x: 0, z: 10, pose: 'standing', base: 'standing' })
  })

  it('kết nối mới đặt lại đường đi và vị trí trước khi tự về nệm mới', () => {
    const engine = setup()
    engine.server.id = 'ket-noi-cu'
    Object.assign(engine.player, { x: 20, z: 20, route: [{ x: 25, z: 25 }], pose: 'kneeling', base: 'kneeling' })
    engine.handledCushion = 99
    engine.applySelf({ id: 'ket-noi-moi', name: 'An', cushionId: 94, waiting: false, beads: 0, x: 0, z: 10, rotation: 0, pose: 'standing' })
    expect(engine.player).toMatchObject({ x: 0, z: 10, pose: 'standing', base: 'standing' })
    expect(engine.player.route.at(-1)).toMatchObject({ x: -0.8, z: 6.3 })
    expect(engine.sent).toMatchObject({ x: 0, z: 10 })
  })

  it('server kết thúc chắp tay thì client khôi phục quỳ', () => {
    const engine = setup()
    engine.player.pose = 'praying'
    engine.player.base = 'standing'
    engine.applySelf({ id: 'me', name: 'An', cushionId: null, waiting: false, beads: 0, x: 0, z: 10, pose: 'kneeling' })
    expect(engine.player).toMatchObject({ pose: 'kneeling', base: 'kneeling' })
  })
})

it('luôn hiện tên người khác trong khung nhìn mà không cần bấm vào họ', () => {
  const engine = setup()
  engine.selfLabel = document.createElement('div')
  engine.placeLabel = vi.fn()
  const remote = {
    person: { name: 'binh', pose: 'standing' },
    monk: { root: { visible: true, position: { x: 1, y: 0, z: 2 } } },
    label: document.createElement('div'),
    labelUntil: 0,
  }
  engine.remotes.set('nguoi-khac', remote)
  engine.updateLabels(99999)
  expect(remote.label.textContent).toBe('binh')
  expect(remote.label).toHaveClass('is-shown')
  remote.monk.root.visible = false
  engine.updateLabels(100000)
  expect(remote.label).not.toHaveClass('is-shown')
})


it('dựng đủ 100 người khi phòng đứng yên và bỏ người đã rời khỏi hàng chờ dựng', () => {
  const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
  })
  const engine = new HallEngine({ canvas: {}, labels: document.createElement('div'), net: { selfId: 'me', emit() {} } })
  engine.scene = new THREE.Scene()
  engine.templates = { lod: { scene: new THREE.Group(), scale: 1, floor: 0 } }
  const people = Array.from({ length: 100 }, (_, i) => ({ id: `u${i}`, name: `người-${i}`, x: i / 10, z: 0, rotation: 0, pose: 'standing', cushionId: null }))
  try {
    engine.applyState({ people })
    for (let i = 0; i < 100; i++) engine.spawnRemotes()
    expect([...engine.remotes.keys()].sort()).toEqual(people.map((p) => p.id).sort())
    engine.applyState({ people: [...people, { ...people[0], id: 'da-roi' }] })
    engine.applyState({ people })
    engine.spawnRemotes()
    expect(engine.remotes.has('da-roi')).toBe(false)
  } finally {
    for (const r of engine.remotes.values()) r.monk.dispose()
    context.mockRestore()
  }
})

const cameraSetup = () => {
  const engine = setup()
  engine.camera = new THREE.PerspectiveCamera(55, 1, 0.15, 140)
  engine.raycaster = new THREE.Raycaster()
  engine.world = { occluders: [], sun: new THREE.DirectionalLight() }
  engine.updateCamera(1 / 60)
  return engine
}

describe('zoom sảnh', () => {
  it('một cuộn lớn không nhảy thẳng ra giới hạn xa nhất', () => {
    const engine = setup()
    engine.zoom(5)
    expect(engine.orbit.dist).toBeGreaterThan(5.2)
    expect(engine.orbit.dist).toBeLessThan(6.6)
  })

  it('đổi chiều cuộn kéo target về phía đang nhìn, không đợi hết quán tính cũ', () => {
    const engine = setup()
    for (let i = 0; i < 15; i++) engine.zoom(0.18)
    engine.zoom(-0.18)
    expect(engine.orbit.dist).toBeLessThan(engine.view.dist)
  })

  it('camera ngoài trời theo cùng một nhịp mượt với zoom, không bị làm trễ thêm', () => {
    const engine = cameraSetup()
    engine.zoom(0.18)
    engine.updateCamera(1 / 60)
    expect(engine.view.dist).toBeGreaterThan(5.2)
    expect(engine.view.dist).toBeLessThan(engine.orbit.dist)
    expect(engine.camDist).toBeCloseTo(engine.view.dist, 8)
    for (let i = 0; i < 60; i++) engine.updateCamera(1 / 60)
    expect(engine.camDist).toBeCloseTo(engine.orbit.dist, 3)
  })

  it('wheel theo dòng và theo pixel có cùng độ nhạy, pinch trackpad được nhận', () => {
    const wheel = (deltaY, deltaMode, ctrlKey = false) => {
      const engine = new HallEngine({ canvas: document.createElement('canvas'), labels: {}, net: {} })
      engine.bind()
      try { engine.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY, deltaMode, ctrlKey, cancelable: true })) }
      finally { engine.unbind() }
      return engine.orbit.dist
    }
    expect(wheel(3, 1)).toBeCloseTo(wheel(48, 0), 8)
    expect(wheel(2, 0, true)).toBeGreaterThan(wheel(2, 0))
  })
})

it('pinch theo tỉ lệ hai ngón, không phụ thuộc khoảng cách bắt đầu', () => {
  const pinch = (start) => {
    const engine = new HallEngine({ canvas: document.createElement('canvas'), labels: {}, net: {} })
    engine.canvas.setPointerCapture = vi.fn()
    engine.bind()
    const pointer = (type, id, x) => {
      const event = new MouseEvent(type, { clientX: x, clientY: 0 })
      Object.defineProperty(event, 'pointerId', { value: id })
      engine.canvas.dispatchEvent(event)
    }
    try {
      pointer('pointerdown', 1, 0)
      pointer('pointerdown', 2, start)
      pointer('pointermove', 2, start * 1.2)
      return engine.orbit.dist
    } finally { engine.unbind() }
  }
  expect(pinch(100)).toBeCloseTo(5.2 / 1.2, 8)
  expect(pinch(200)).toBeCloseTo(pinch(100), 8)
})

it('zoom giữ biên khoảng cách và bỏ qua input không hữu hạn', () => {
  const engine = setup()
  engine.zoom(NaN)
  engine.zoom(Infinity)
  expect(engine.orbit.dist).toBe(5.2)
  for (let i = 0; i < 100; i++) engine.zoom(1)
  expect(engine.orbit.dist).toBe(14)
  for (let i = 0; i < 100; i++) engine.zoom(-1)
  expect(engine.orbit.dist).toBe(2.2)
})

it('camera không xuyên vật cản khi zoom và hồi ra từ từ sau khi hết chắn', () => {
  const engine = cameraSetup()
  const wall = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 0.3), new THREE.MeshBasicMaterial())
  wall.position.set(0, 1, 12)
  wall.updateMatrixWorld()
  try {
    engine.world.occluders = [wall]
    engine.updateCamera(1 / 60)
    expect(engine.camera.position.z).toBeLessThan(11.85)
    const blocked = engine.camDist
    engine.world.occluders = []
    engine.updateCamera(1 / 60)
    expect(engine.camDist).toBeGreaterThan(blocked)
    expect(engine.camDist).toBeLessThan(engine.view.dist)
  } finally { wall.geometry.dispose(); wall.material.dispose() }
})
