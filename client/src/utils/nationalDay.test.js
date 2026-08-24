import { describe, it, expect } from 'vitest';
import {
  getAnniversary,
  getNationalDayState,
  pad2,
  splitDuration,
} from './nationalDay';

describe('nationalDay utils', () => {
  it('ẩn banner trước ngày 20/8', () => {
    const state = getNationalDayState(new Date(2026, 7, 19, 23, 59, 59));
    expect(state.visible).toBe(false);
    expect(state.phase).toBeNull();
  });

  it('hiện banner đếm ngược từ 20/8', () => {
    const state = getNationalDayState(new Date(2026, 7, 20, 0, 0, 0));
    expect(state.visible).toBe(true);
    expect(state.phase).toBe('countdown');
    expect(state.timeLeft.days).toBe(13);
  });

  it('đếm ngược đúng số ngày/giờ/phút/giây còn lại', () => {
    const state = getNationalDayState(new Date(2026, 8, 1, 21, 45, 30));
    expect(state.timeLeft).toEqual({ days: 0, hours: 2, minutes: 14, seconds: 30 });
  });

  it('chuyển sang chế độ chúc mừng đúng 2/9', () => {
    const state = getNationalDayState(new Date(2026, 8, 2, 0, 0, 0));
    expect(state.phase).toBe('day');
    expect(state.timeLeft.days).toBe(0);
  });

  it('vẫn chúc mừng hết ngày 3/9', () => {
    expect(getNationalDayState(new Date(2026, 8, 3, 23, 59, 59)).phase).toBe('day');
  });

  it('ẩn hẳn từ 4/9', () => {
    expect(getNationalDayState(new Date(2026, 8, 4, 0, 0, 0)).visible).toBe(false);
  });

  it('tính số năm kỷ niệm', () => {
    expect(getAnniversary()).toBe(81);
  });

  it('không trả về thời lượng âm', () => {
    expect(splitDuration(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('đệm số về hai chữ số', () => {
    expect(pad2(7)).toBe('07');
    expect(pad2(12)).toBe('12');
  });
});
