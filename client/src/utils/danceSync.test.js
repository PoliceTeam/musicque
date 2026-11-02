import { describe, it, expect } from 'vitest'
import { beatsAt, clipTimeAt, loopTempo, pickTargetBpm, syncRatio } from './danceSync'

const track = { bpm: 168, offset: 0.2, halfOffset: 0.55 }

describe('danceSync', () => {
  it('rounds a clip to a whole number of beats so loops stay on beat', () => {
    const t = loopTempo({ bpm: 98, dur: 13.8 }) // 22.54 beats -> 23
    expect(t.beats).toBe(23)
    expect(t.bpm).toBeCloseTo(100, 0)
    expect((t.beats * 60) / t.bpm).toBeCloseTo(13.8, 6)
  })

  it('picks the closest octave of the music tempo', () => {
    expect(pickTargetBpm(98, 168)).toBe(84)
    expect(pickTargetBpm(135, 168)).toBe(168)
    expect(pickTargetBpm(189, 168)).toBe(168)
    expect(pickTargetBpm(45, 168)).toBe(42)
  })

  it('counts beats from the half-time downbeat when dancing slower than the song', () => {
    expect(beatsAt(0.2, track, 168)).toBeCloseTo(0)
    expect(beatsAt(0.55, track, 84)).toBeCloseTo(0)
    expect(beatsAt(0.55 + 60 / 84, track, 84)).toBeCloseTo(1)
  })

  it('lands every music beat on a clip beat', () => {
    const tempo = { bpm: 120, beatOffset: 0.25, dur: 4 } // 8 phách, mỗi phách 0.5s
    const t168 = { bpm: 120, offset: 1 }
    expect(clipTimeAt(1, t168, tempo)).toBeCloseTo(0.25)
    expect(clipTimeAt(1.5, t168, tempo)).toBeCloseTo(0.75)
    // sau đúng một vòng clip quay lại cùng vị trí
    expect(clipTimeAt(5, t168, tempo)).toBeCloseTo(0.25)
    // trước phách đầu cũng không âm
    expect(clipTimeAt(0, t168, tempo)).toBeGreaterThanOrEqual(0)
  })

  it('clamps one-shot clips instead of looping', () => {
    const tempo = { bpm: 120, beatOffset: 0, dur: 2 }
    expect(clipTimeAt(10, { bpm: 120, offset: 0 }, tempo, { loop: false })).toBe(2)
  })

  it('reports the playback ratio', () => {
    const r = syncRatio(track, { bpm: 98, dur: 13.8 })
    expect(r.target).toBe(84)
    expect(r.ratio).toBeCloseTo(84 / r.clipBpm)
  })
})
