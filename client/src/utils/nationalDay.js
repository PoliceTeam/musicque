/**
 * Mốc thời gian cho banner Quốc khánh 2/9.
 * Tách riêng khỏi component để test được bằng vitest (chỉ client mới có test harness).
 */

export const NATIONAL_DAY_YEAR = 2026;
export const INDEPENDENCE_YEAR = 1945;

/** 2/9/2026 00:00 giờ địa phương. */
export const getNationalDayDate = () => new Date(NATIONAL_DAY_YEAR, 8, 2, 0, 0, 0, 0);

/** Banner bắt đầu xuất hiện: 20/8. */
export const getShowFromDate = () => new Date(NATIONAL_DAY_YEAR, 7, 20, 0, 0, 0, 0);

/** Banner tự ẩn hẳn: 00:00 ngày 4/9 (tức hiển thị hết ngày 3/9). */
export const getHideAfterDate = () => new Date(NATIONAL_DAY_YEAR, 8, 4, 0, 0, 0, 0);

/** Số năm kỷ niệm: 2026 - 1945 = 81. */
export const getAnniversary = () => NATIONAL_DAY_YEAR - INDEPENDENCE_YEAR;

export const pad2 = (value) => (value < 10 ? `0${value}` : `${value}`);

export const splitDuration = (ms) => {
  const safe = ms > 0 ? ms : 0;
  return {
    days: Math.floor(safe / 86400000),
    hours: Math.floor((safe % 86400000) / 3600000),
    minutes: Math.floor((safe % 3600000) / 60000),
    seconds: Math.floor((safe % 60000) / 1000),
  };
};

/**
 * Trạng thái banner tại một thời điểm.
 * - `visible: false` → không render gì cả, bố cục HomePage về nguyên trạng.
 * - `phase: 'countdown'` → đang đếm ngược tới 2/9.
 * - `phase: 'day'` → đã tới 2/9, chuyển sang chế độ chúc mừng.
 */
export const getNationalDayState = (now = new Date()) => {
  const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const target = getNationalDayDate().getTime();

  if (current < getShowFromDate().getTime() || current >= getHideAfterDate().getTime()) {
    return { visible: false, phase: null, timeLeft: splitDuration(0) };
  }

  if (current >= target) {
    return { visible: true, phase: 'day', timeLeft: splitDuration(0) };
  }

  return { visible: true, phase: 'countdown', timeLeft: splitDuration(target - current) };
};
