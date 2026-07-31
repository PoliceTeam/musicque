import { describe, it, expect } from 'vitest';
import {
  SHOT_TYPE_LABEL,
  BALL_IN_HAND_REASON_LABEL,
  DIFFICULTY_LABEL,
  DIFFICULTY_COLOR,
  getPlaybackState,
  interpolateFrame,
  getPottedSoFar,
  getRemainingBalls,
  getCueOffset,
  getStatusLabel,
  REPLAY_FPS,
} from './billiards';

// Ván giả: 2 cú, mỗi cú ngắm 1000ms + lăn 1000ms (25 khung) + dừng 500ms
const START = 1_000_000;

const makeShot = (index, startAt, ids, pots = []) => ({
  index,
  type: index === 0 ? 'break' : 'pot',
  targetBall: index === 0 ? 1 : 2,
  ballInHand: false,
  cue: { x: 60, y: 63, angle: 0, power: 0.5 },
  ids,
  // 26 khung: bi chạy thẳng theo trục x, mỗi khung +1
  frames: Array.from({ length: 26 }, (_, f) =>
    ids.flatMap((id, k) => [k * 20 + f, 63 + k]),
  ),
  pots,
  aimMs: 1000,
  rollMs: 1000,
  settleMs: 500,
  durationMs: 2500,
  startAt,
});

const game = {
  _id: 'g1',
  totalShots: 2,
  durationMs: 5000,
  startsAt: new Date(START).toISOString(),
  endsAt: new Date(START + 5000).toISOString(),
  shots: [
    makeShot(0, 0, [0, 1, 2, 9], [{ ball: 1, pocket: 2, frame: 10 }]),
    makeShot(1, 2500, [0, 2, 9], [{ ball: 2, pocket: 4, frame: 20 }]),
  ],
};

describe('getPlaybackState', () => {
  it('đếm ngược khi ván chưa bắt đầu', () => {
    const state = getPlaybackState(game, START - 3200);
    expect(state.phase).toBe('countdown');
    expect(state.countdownMs).toBe(3200);
  });

  it('nhận ra pha ngắm của cú đầu', () => {
    const state = getPlaybackState(game, START + 400);
    expect(state.phase).toBe('playing');
    expect(state.shotIndex).toBe(0);
    expect(state.subPhase).toBe('aim');
    expect(state.aimProgress).toBeCloseTo(0.4);
    expect(state.frame).toBe(0);
  });

  it('quy đổi thời gian lăn ra khung hình theo đúng fps', () => {
    const state = getPlaybackState(game, START + 1000 + 400);
    expect(state.subPhase).toBe('roll');
    expect(state.frame).toBeCloseTo(0.4 * REPLAY_FPS);
  });

  it('giữ khung cuối trong pha dừng', () => {
    const state = getPlaybackState(game, START + 2200);
    expect(state.subPhase).toBe('settle');
    expect(state.frame).toBe(25);
  });

  it('nhảy sang cú kế tiếp đúng mốc startAt', () => {
    const state = getPlaybackState(game, START + 2600);
    expect(state.shotIndex).toBe(1);
    expect(state.subPhase).toBe('aim');
  });

  it('báo finished khi qua tổng thời lượng', () => {
    const state = getPlaybackState(game, START + 9000);
    expect(state.phase).toBe('finished');
    expect(state.overMs).toBe(4000);
    expect(state.shotIndex).toBe(1);
  });

  it('an toàn khi chưa có ván', () => {
    expect(getPlaybackState(null).phase).toBe('idle');
    expect(getPlaybackState({ shots: [] }).phase).toBe('idle');
  });
});

describe('pha chờ trước mỗi cơ', () => {
  // Cơ có waitMs: bàn đứng yên đếm ngược rồi mới tới pha ngắm
  const waitShot = { ...makeShot(0, 0, [0, 1]), waitMs: 20000, durationMs: 22500 };
  const waitGame = {
    ...game,
    totalShots: 1,
    shots: [waitShot],
  };

  it('đếm ngược trong pha chờ, chưa dựng cây cơ', () => {
    const state = getPlaybackState(waitGame, START + 6000);
    expect(state.subPhase).toBe('wait');
    expect(state.waitRemainingMs).toBe(14000);
    expect(state.aimProgress).toBe(0);
    expect(state.frame).toBe(0);
  });

  it('hết giờ chờ mới chuyển sang ngắm, và aimProgress tính lại từ đầu', () => {
    const state = getPlaybackState(waitGame, START + 20400);
    expect(state.subPhase).toBe('aim');
    expect(state.aimProgress).toBeCloseTo(0.4);
  });

  it('pha lăn bị đẩy lùi đúng bằng waitMs', () => {
    const state = getPlaybackState(waitGame, START + 20000 + 1000 + 400);
    expect(state.subPhase).toBe('roll');
    expect(state.frame).toBeCloseTo(0.4 * REPLAY_FPS);
  });

  it('ván cũ không có waitMs thì coi như 0', () => {
    expect(getPlaybackState(game, START + 400).subPhase).toBe('aim');
  });
});

describe('interpolateFrame', () => {
  it('nội suy tuyến tính giữa hai khung', () => {
    const balls = interpolateFrame(game.shots[0], 3.5);
    expect(balls).toHaveLength(4);
    expect(balls[0]).toMatchObject({ id: 0, y: 63 });
    expect(balls[0].x).toBeCloseTo(3.5);
    expect(balls[1].x).toBeCloseTo(23.5);
  });

  it('kẹp khung hình vào khoảng hợp lệ', () => {
    expect(interpolateFrame(game.shots[0], -5)[0].x).toBeCloseTo(0);
    expect(interpolateFrame(game.shots[0], 999)[0].x).toBeCloseTo(25);
  });

  it('đánh dấu bi chìm dần sau khi vào lỗ', () => {
    const before = interpolateFrame(game.shots[0], 9);
    expect(before.find((b) => b.id === 1).sink).toBe(0);

    const during = interpolateFrame(game.shots[0], 13);
    expect(during.find((b) => b.id === 1).sink).toBeCloseTo(0.5);

    const after = interpolateFrame(game.shots[0], 22);
    expect(after.find((b) => b.id === 1).sink).toBe(1);
  });

  it('trả mảng rỗng khi không có dữ liệu', () => {
    expect(interpolateFrame(null, 0)).toEqual([]);
    expect(interpolateFrame({ frames: [] }, 0)).toEqual([]);
  });
});

describe('getPottedSoFar / getRemainingBalls', () => {
  it('chưa tính bi của cú hiện tại nếu chưa tới khung vào lỗ', () => {
    const playback = { shotIndex: 0, frame: 5 };
    expect(getPottedSoFar(game, playback)).toEqual([]);
    expect(getRemainingBalls(game, playback)).toHaveLength(9);
  });

  it('tính bi ngay khi qua khung vào lỗ', () => {
    const playback = { shotIndex: 0, frame: 12 };
    expect(getPottedSoFar(game, playback)).toEqual([
      { ball: 1, pocket: 2, shotIndex: 0 },
    ]);
    expect(getRemainingBalls(game, playback)).not.toContain(1);
  });

  it('cộng dồn bi của các cú trước', () => {
    const playback = { shotIndex: 1, frame: 25 };
    expect(getPottedSoFar(game, playback).map((p) => p.ball)).toEqual([1, 2]);
    expect(getRemainingBalls(game, playback)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('getCueOffset', () => {
  it('kéo cơ ra xa rồi thụt về 0 lúc chạm bi', () => {
    const start = getCueOffset(0, 0.5);
    const pulled = getCueOffset(0.78, 0.5);
    const hit = getCueOffset(1, 0.5);
    expect(start).toBeCloseTo(8);
    expect(pulled).toBeGreaterThan(start);
    expect(hit).toBeCloseTo(0);
  });

  it('lực mạnh thì kéo cơ xa hơn', () => {
    expect(getCueOffset(0.78, 1)).toBeGreaterThan(getCueOffset(0.78, 0.2));
  });
});

describe('nhãn kiểu cơ / lý do đặt lại bi cái', () => {
  // Phải khớp enum `type` và `ballInHandReason` ở api/models/billiardsGame.model.js
  it('có nhãn cho mọi kiểu cơ backend sinh ra', () => {
    ['break', 'pot', 'reposition', 'safety'].forEach((type) => {
      expect(SHOT_TYPE_LABEL[type]).toBeTruthy();
    });
  });

  it('có nhãn cho mọi lý do phải đặt lại bi cái', () => {
    ['scratch', 'snookered'].forEach((reason) => {
      expect(BALL_IN_HAND_REASON_LABEL[reason]).toBeTruthy();
    });
  });

  it('có nhãn và màu cho mọi mức độ khó của cửa ăn', () => {
    ['easy', 'medium', 'hard'].forEach((level) => {
      expect(DIFFICULTY_LABEL[level]).toBeTruthy();
      expect(DIFFICULTY_COLOR[level]).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe('getStatusLabel', () => {
  it('mô tả từng giai đoạn của ván', () => {
    expect(getStatusLabel(null)).toBe('Đang tải...');
    expect(getStatusLabel(game, START - 2500)).toBe('Xếp bi · 3s');
    expect(getStatusLabel(game, START + 100)).toBe('Cơ 1/2');
    expect(getStatusLabel(game, START + 3000)).toBe('Cơ 2/2');
    expect(getStatusLabel(game, START + 99999)).toBe('Hết ván');
  });
});
