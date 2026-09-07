import { describe, expect, it } from 'vitest'
import {
  createMockRedLightPreview,
  finishGateLayout,
  finishLinePolygon,
  getLobbyOccupancy,
  getPhaseAt,
  getPhaseLabel,
  getSyncedNow,
  isInLobby,
  phaseAllowsRun,
  PHASE,
  projectPawn,
  STATUS,
  trackPolygonPoints,
} from './redLight'

const schedule = [
  { type: PHASE.GREEN, startAt: 0, endAt: 1000 },
  { type: PHASE.TURNING_RED, startAt: 1000, endAt: 1400 },
  { type: PHASE.RED, startAt: 1400, endAt: 3000 },
]

describe('redLight utils', () => {
  it('picks the phase covering now', () => {
    expect(getPhaseAt(schedule, 200).type).toBe(PHASE.GREEN)
    expect(getPhaseAt(schedule, 1200).type).toBe(PHASE.TURNING_RED)
    expect(getPhaseAt(schedule, 2000).type).toBe(PHASE.RED)
  })

  it('allows running while the doll is still turning', () => {
    expect(phaseAllowsRun(getPhaseAt(schedule, 1200))).toBe(true)
    expect(phaseAllowsRun(getPhaseAt(schedule, 2000))).toBe(false)
  })

  it('labels lobby, lights, and results in Vietnamese', () => {
    expect(getPhaseLabel(null, STATUS.LOBBY)).toContain('Chờ')
    expect(getPhaseLabel({ type: PHASE.GREEN }, STATUS.PLAYING)).toBe('Đèn xanh')
    expect(getPhaseLabel({ type: PHASE.RED }, STATUS.PLAYING)).toBe('Đèn đỏ')
  })

  it('applies server clock offset', () => {
    expect(getSyncedNow(5000, 4000, 4100)).toBe(5100)
  })

  it('detects the signed-in player in the lobby', () => {
    expect(isInLobby({ lobby: [{ userId: 'abc' }] }, 'abc')).toBe(true)
    expect(isInLobby({ lobby: [{ userId: 'abc' }] }, 'zzz')).toBe(false)
  })

  it('shows current players against max seats, not the start minimum', () => {
    expect(getLobbyOccupancy({ lobbyCount: 0, minPlayers: 4, maxPlayers: 12 })).toMatchObject({
      countLabel: '0/12',
      missing: 4,
      statusLabel: 'Phòng chờ · 0/12 · còn thiếu 4',
    })
    expect(getLobbyOccupancy({ lobbyCount: 2, minPlayers: 4, maxPlayers: 12 }).statusLabel)
      .toBe('Phòng chờ · 2/12 · còn thiếu 2')
    expect(getLobbyOccupancy({ lobbyCount: 7, minPlayers: 4, maxPlayers: 12 }).statusLabel)
      .toBe('Phòng chờ · 7/12')
  })

  it('runs pawns along the screen-space track toward the finish', () => {
    const start = projectPawn(0, 0, 1)
    const finish = projectPawn(100, 0, 1)
    expect(finish.x).toBeGreaterThan(start.x)
    expect(finish.y).toBeLessThan(start.y)
    expect(trackPolygonPoints().split(' ')).toHaveLength(4)
    expect(finishLinePolygon().split(' ')).toHaveLength(4)
  })

  it('places the finish gate across the far edge of the track', () => {
    const gate = finishGateLayout()
    expect(gate.width).toBeGreaterThan(15)
    expect(gate.near.y).toBeGreaterThan(gate.far.y)
    expect(gate.mid.x).toBeGreaterThan(60)
    expect(gate.doll.x).toBeGreaterThan(gate.mid.x - 5)
  })

  it('builds a self-contained UI preview without a live round', () => {
    const preview = createMockRedLightPreview()
    expect(preview.active).toBe(true)
    expect(preview.status).toBe(STATUS.PLAYING)
    expect(preview.round.players).toHaveLength(4)
    expect(preview.round.players.every((player) => player.progress >= 0)).toBe(true)
  })
})
