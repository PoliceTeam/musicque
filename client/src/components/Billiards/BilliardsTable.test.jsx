import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import BilliardsTable from './BilliardsTable'

const START = 1_000_000

const makeTable = () => ({
  width: 254,
  height: 127,
  ballRadius: 2.85,
  pockets: [
    { index: 0, x: 0, y: 0, r: 5, name: 'Góc trái trên' },
    { index: 1, x: 127, y: 0, r: 5, name: 'Giữa trên' },
    { index: 2, x: 254, y: 0, r: 5, name: 'Góc phải trên' },
    { index: 3, x: 0, y: 127, r: 5, name: 'Góc trái dưới' },
    { index: 4, x: 127, y: 127, r: 5, name: 'Giữa dưới' },
    { index: 5, x: 254, y: 127, r: 5, name: 'Góc phải dưới' },
  ],
})

const makeShot = () => ({
  index: 0,
  type: 'pot',
  targetBall: 1,
  ballInHand: false,
  cue: { x: 60, y: 63, angle: 0, power: 0.5 },
  ids: [0, 1],
  frames: Array.from({ length: 26 }, (_, frame) => [60 + frame, 63, 120 + frame * 0.4, 63]),
  pots: [],
  options: [],
  waitMs: 20_000,
  aimMs: 1_000,
  rollMs: 1_000,
  settleMs: 500,
  durationMs: 22_500,
  startAt: 0,
})

const makeGame = () => ({
  _id: 'test-game',
  gameNumber: 1,
  startsAt: new Date(START).toISOString(),
  finished: false,
  table: makeTable(),
  rack: [],
  shots: [makeShot()],
})

const makeContext = () => {
  const calls = []
  const record = (name) =>
    vi.fn((...args) => {
      calls.push({ name, args })
    })
  const gradient = { addColorStop: record('addColorStop') }
  const ctx = {
    calls,
    arc: record('arc'),
    arcTo: record('arcTo'),
    beginPath: record('beginPath'),
    clearRect: record('clearRect'),
    clip: record('clip'),
    closePath: record('closePath'),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    ellipse: record('ellipse'),
    fill: record('fill'),
    fillRect: record('fillRect'),
    fillText: record('fillText'),
    lineTo: record('lineTo'),
    moveTo: record('moveTo'),
    restore: record('restore'),
    roundRect: record('roundRect'),
    save: record('save'),
    setLineDash: record('setLineDash'),
    setTransform: record('setTransform'),
    stroke: record('stroke'),
    translate: record('translate'),
  }
  return ctx
}

describe('BilliardsTable canvas renderer', () => {
  let ctx

  beforeEach(() => {
    ctx = makeContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
    vi.spyOn(Date, 'now').mockReturnValue(START)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

    globalThis.ResizeObserver = class {
      observe() {}
      disconnect() {}
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('vẽ cây cơ trong pha ngắm khi payload đã có angle và power', () => {
    Date.now.mockReturnValue(START + 20_500)

    render(<BilliardsTable game={makeGame()} />)

    const cueShaftSegments = ctx.calls.filter(
      (call) => call.name === 'lineTo' && call.args[0] < -50,
    )
    expect(cueShaftSegments.length).toBeGreaterThan(0)
  })

  it('vẽ trail và bóng đang lăn bằng dữ liệu frames', () => {
    Date.now.mockReturnValue(START + 21_500)

    render(<BilliardsTable game={makeGame()} />)

    const trailSegments = ctx.calls.filter(
      (call) =>
        call.name === 'lineTo' &&
        call.args[0] > 60 &&
        call.args[0] < 80 &&
        call.args[1] === 63,
    )
    const cueBallArcs = ctx.calls.filter(
      (call) =>
        call.name === 'arc' &&
        call.args[0] > 70 &&
        call.args[0] < 80 &&
        call.args[1] === 63,
    )

    expect(trailSegments.length).toBeGreaterThan(0)
    expect(cueBallArcs.length).toBeGreaterThan(0)
  })
})
