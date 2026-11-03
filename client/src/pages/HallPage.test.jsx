import React from 'react'
import hallCss from '../styles/hall.css?raw'
import HallBeads from '../components/Hall/HallBeads'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BEADS_PER_LAP, CUSHIONS, HALL, PING_LIMIT, allowPing, beadProgress, sectorFor, buildColliders, clampOrbit, groundHeight, insideHall,
  resolveCollisions, routeTo, sharedListening, zoneAt,
} from '../three/hall/layout'

const lifecycle = vi.hoisted(() => ({ connect: vi.fn(), init: vi.fn(), dispose: vi.fn(), construct: vi.fn() }))
vi.mock('../three/hall/net', () => ({ connectHall: lifecycle.connect }))
vi.mock('../three/hall/engine', () => ({ HallEngine: class {
  constructor() { lifecycle.construct() }
  init() { return lifecycle.init() }
  dispose() { lifecycle.dispose() }
  setBeads() {}
  bead() {}
} }))

const authState = vi.hoisted(() => ({ user: null }))
const hallAudio = vi.hoisted(() => ({ setLayer: vi.fn(), bead: vi.fn() }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('../services/api', () => ({ default: { get: () => Promise.reject(new Error('offline')) }, getStoredToken: () => null }))
vi.mock('../three/hall/audio', () => ({
  HallAudio: class {
    subscribe(fn) { fn({ unlocked: false }); return () => {} }
    setZone() {}
    dispose() {}
    setLayer(...args) { hallAudio.setLayer(...args) }
    bead() { hallAudio.bead() }
  },
}))

const HallPage = (await import('./HallPage')).default
const HallToolbar = (await import('../components/Hall/HallToolbar')).default

describe('con lăn tràng hạt', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] }))
  afterEach(() => vi.useRealTimers())

  it('hạt có hình khối, chuyển động khi dùng con lăn và tăng một hạt', () => {
    const style = document.createElement('style')
    style.textContent = hallCss
    document.head.appendChild(style)
    const onBead = vi.fn()
    try {
      render(<HallBeads initial={0} onBead={onBead} onLap={() => {}} onClose={() => {}} />)
      const strand = screen.getByRole('slider')
      const bead = strand.querySelector('.is-current')
      expect(getComputedStyle(bead).position).toBe('absolute')
      const before = bead.style.transform
      fireEvent.wheel(strand, { deltaY: 120 })
      act(() => vi.advanceTimersByTime(80))
      expect(bead.style.transform).not.toBe(before)
      act(() => vi.advanceTimersByTime(200))
      expect(onBead).toHaveBeenCalledOnce()
      expect(strand).toHaveAttribute('aria-valuenow', '1')
    } finally { style.remove() }
  })
})

describe('sảnh /hall — bố cục khớp server', () => {
  it('100 nệm theo đúng lưới của api/services/hall.service.js và đều nằm trong chánh điện', () => {
    expect(CUSHIONS).toHaveLength(100)
    expect(CUSHIONS[0]).toEqual({ id: 0, x: -7.2, z: -6.3 })
    expect(CUSHIONS[99].x).toBeCloseTo(7.2)
    expect(CUSHIONS[99].z).toBeCloseTo(6.3)
    expect(CUSHIONS.every((c) => insideHall(c.x, c.z) && zoneAt(c.x, c.z) === 'hall')).toBe(true)
  })

  it('không đi xuyên tường, vào bằng cửa giữa', () => {
    const colliders = buildColliders()
    const blocked = resolveCollisions(-6, HALL.maxZ, colliders)
    expect(Math.abs(blocked.z - HALL.maxZ)).toBeGreaterThan(0.3)
    const door = resolveCollisions(0, HALL.maxZ, colliders)
    expect(door.z).toBeCloseTo(HALL.maxZ)
    expect(groundHeight(0, 0)).toBe(HALL.floorY)
    expect(groundHeight(0, 20)).toBe(0)
  })

  it('tự về nệm: từ cửa vào qua cửa, từ sân trăng thì đi vòng hông điện', () => {
    const fromGate = routeTo({ x: 0, z: 10 }, CUSHIONS[0])
    expect(fromGate.at(-1)).toEqual(CUSHIONS[0])
    expect(fromGate.some((p) => p.z > HALL.maxZ && Math.abs(p.x) <= HALL.doorHalf)).toBe(true)
    const fromMoon = routeTo({ x: 0, z: -21 }, CUSHIONS[55])
    expect(fromMoon.some((p) => Math.abs(p.x) > 11)).toBe(true)
    // Bậc thềm ngay trước cửa: không đi vòng.
    const toSteps = routeTo(CUSHIONS[94], { x: -0.8, z: 8.1 })
    expect(toSteps.every((p) => Math.abs(p.x) < 3)).toBe(true)
  })

  it('tràng hạt đếm n/108 và sang vòng mới', () => {
    expect(beadProgress(0)).toEqual({ count: 0, lap: 1, justCompleted: false })
    expect(beadProgress(107).count).toBe(107)
    expect(beadProgress(BEADS_PER_LAP)).toEqual({ count: 0, lap: 2, justCompleted: true })
    expect(beadProgress(110)).toMatchObject({ count: 2, lap: 2 })
  })

  it('nghe chung lúc 05:00 và 18:00 giờ Việt Nam', () => {
    const vn = (h, m) => Date.UTC(2026, 10, 2, h - 7, m)
    expect(sharedListening(vn(18, 4))).toMatchObject({ active: true, hour: 18, startedAt: vn(18, 0) })
    expect(sharedListening(vn(5, 0)).active).toBe(true)
    expect(sharedListening(vn(4, 59)).active).toBe(false)
    expect(sharedListening(vn(12, 0)).active).toBe(false)
  })

  it('ping: kéo chuột chọn đúng hướng, kéo chưa đủ xa thì chưa chọn', () => {
    expect(sectorFor(3, -4)).toBeNull()
    expect(sectorFor(0, -60)).toBe('look')
    expect(sectorFor(60, 5)).toBe('here')
    expect(sectorFor(-4, 60)).toBe('wait')
    expect(sectorFor(-60, -10)).toBe('bow')
  })

  it('ping: tối đa 3 lần trong 4 giây', () => {
    let times = []
    for (const t of [0, 100, 200]) times = allowPing(times, t)
    expect(allowPing(times, 300)).toBeNull()
    expect(allowPing(times, PING_LIMIT.windowMs + 1)).toHaveLength(3)
  })

  it('camera bị kẹp góc ngẩng và khoảng cách theo SPEC', () => {
    expect(clampOrbit({ yaw: 9, pitch: 2, dist: 100 })).toEqual({ yaw: 9, pitch: 0.31, dist: 14 })
    expect(clampOrbit({ yaw: 0, pitch: -2, dist: 0 })).toEqual({ yaw: 0, pitch: -0.24, dist: 2.2 })
  })
})

describe('HallPage', () => {
  it('hiện màn vào sảnh, không bắt đăng nhập, không có điểm hay bảng xếp hạng', () => {
    render(<MemoryRouter><HallPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Sảnh thiền' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vào sảnh' })).toBeEnabled()
    expect(screen.getByLabelText(/Tên hiển thị/).value).not.toBe('')
    expect(screen.queryByText(/điểm số|xếp hạng|ủng hộ|donate/i)).toBeNull()
  })

  it('thanh công cụ đánh số phím liền 1→5, đúng thứ tự trái sang phải', () => {
    render(<HallToolbar ui={{ zone: 'hall', pose: 'kneeling', kneeling: true, cushionId: 3 }} panel={null} onAction={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.querySelector('kbd')?.textContent)).toEqual(['1', '2', '3', '4', '5'])
    expect(buttons.map((b) => b.querySelector('.hall-tool__label').textContent)).toEqual(['Lạy', 'Tràng hạt', 'Chắp tay', 'Đứng dậy', 'Mõ'])
  })
})


describe('vòng đời vào sảnh', () => {
  it('rời trang trong lúc chờ join phải nhả net vừa nhận, không tạo cảnh', async () => {
    vi.clearAllMocks()
    let complete
    lifecycle.connect.mockReturnValue(new Promise((resolve) => { complete = resolve }))
    const net = { dispose: vi.fn(), onState: vi.fn() }
    const page = render(<MemoryRouter><HallPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Vào sảnh' }))
    await waitFor(() => expect(lifecycle.connect).toHaveBeenCalledOnce())
    page.unmount()
    await act(async () => complete(net))
    expect(net.dispose).toHaveBeenCalledOnce()
    expect(lifecycle.construct).not.toHaveBeenCalled()
  })

  it('tải cảnh thất bại phải nhả nệm và dọn engine trước khi cho thử lại', async () => {
    vi.clearAllMocks()
    const net = { dispose: vi.fn(), onState: vi.fn() }
    lifecycle.connect.mockResolvedValue(net)
    lifecycle.init.mockRejectedValue(new Error('Không tải được mô hình'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<MemoryRouter><HallPage /></MemoryRouter>)
      fireEvent.click(screen.getByRole('button', { name: 'Vào sảnh' }))
      await screen.findByText('Chưa mở được sảnh. Kiểm tra kết nối rồi bấm Vào sảnh để thử lại.')
      expect(net.dispose).toHaveBeenCalledOnce()
      expect(lifecycle.dispose).toHaveBeenCalledOnce()
    } finally { log.mockRestore() }
  })
})


it('tên trong sảnh dùng username Musicque khi đã đăng nhập', async () => {
  vi.clearAllMocks()
  authState.user = { username: 'tien', displayName: 'Tên hiển thị khác' }
  lifecycle.connect.mockResolvedValue({ dispose: vi.fn(), onState: vi.fn() })
  lifecycle.init.mockResolvedValue()
  try {
    localStorage.setItem('musicque_hall_name', 'Sen Mềm 81')
    render(<MemoryRouter><HallPage /></MemoryRouter>)
    // Đã đăng nhập: không có ô nhập tên, chỉ hiện tên tài khoản.
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('tien')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Vào sảnh' }))
    await waitFor(() => expect(lifecycle.connect).toHaveBeenCalledWith(expect.objectContaining({ name: 'tien' })))
    // Biệt danh khách đã lưu không bị ghi đè bằng tên tài khoản.
    expect(localStorage.getItem('musicque_hall_name')).toBe('Sen Mềm 81')
  } finally { authState.user = null }
})

it('đang kiểm tra đăng nhập thì chưa cho vào, để không lỡ vào bằng tên khách', () => {
  authState.loading = true
  try {
    render(<MemoryRouter><HallPage /></MemoryRouter>)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Đang kiểm tra tài khoản…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vào sảnh' })).toBeDisabled()
  } finally { authState.loading = false }
})


it('kết nối thất bại hiện lỗi và bấm Vào sảnh lần nữa kết nối được', async () => {
  vi.clearAllMocks()
  lifecycle.connect.mockReset()
  lifecycle.connect.mockRejectedValueOnce(new Error('Không kết nối được sảnh'))
    .mockResolvedValueOnce({ mode: 'live', dispose: vi.fn(), onState: vi.fn() })
  lifecycle.init.mockResolvedValue()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(<MemoryRouter><HallPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Vào sảnh' }))
    await screen.findByText('Chưa mở được sảnh. Kiểm tra kết nối rồi bấm Vào sảnh để thử lại.')
    expect(lifecycle.construct).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Vào sảnh' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Vào sảnh' }))
    await screen.findByRole('navigation', { name: 'Hành động' })
    expect(lifecycle.connect).toHaveBeenCalledTimes(2)
  } finally { log.mockRestore() }
})


it('mở tràng hạt bật hiệu ứng ngay trong thao tác click, sau đó cuộn phát tiếng hạt', async () => {
  vi.clearAllMocks()
  lifecycle.connect.mockResolvedValue({ mode: 'live', dispose: vi.fn(), onState: vi.fn() })
  lifecycle.init.mockResolvedValue()
  render(<MemoryRouter><HallPage /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Vào sảnh' }))
  await screen.findByRole('navigation', { name: 'Hành động' })
  fireEvent.click(screen.getByRole('button', { name: /Tràng hạt/ }))
  expect(hallAudio.setLayer).toHaveBeenCalledWith('fx', true)
  fireEvent.wheel(screen.getByRole('slider'), { deltaY: 120 })
  expect(hallAudio.bead).toHaveBeenCalledOnce()
})
