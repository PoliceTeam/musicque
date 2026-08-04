// Helper thuần cho màn xem NPC dọn bàn bi-a.
// Server gửi sẵn quỹ đạo (frames 25fps) + mốc thời gian, client chỉ việc
// tính xem "bây giờ" đang ở cú nào, khung hình nào rồi vẽ ra.

export const REPLAY_FPS = 25 // phải khớp RECORD_FPS ở api/services/billiards/engine.js

// Màu bi 9 bóng chuẩn; bi 9 là bi sọc nên có thêm cờ striped
export const BALL_STYLES = {
  0: { color: '#f6f4ef', label: '', striped: false }, // bi cái
  1: { color: '#f2c200', label: '1', striped: false },
  2: { color: '#1257a8', label: '2', striped: false },
  3: { color: '#d32f2f', label: '3', striped: false },
  4: { color: '#7b2fa0', label: '4', striped: false },
  5: { color: '#ef7215', label: '5', striped: false },
  6: { color: '#1e8449', label: '6', striped: false },
  7: { color: '#7e2d1c', label: '7', striped: false },
  8: { color: '#16181d', label: '8', striped: false },
  9: { color: '#f2c200', label: '9', striped: true },
}

export const SHOT_TYPE_LABEL = {
  break: 'Cơ phá',
  pot: 'Cơ ăn bi',
  reposition: 'Cơ dọn đường',
  safety: 'Phá cụm',
}

// Đặt lại bi cái là chuyện hiếm — luôn kèm lý do để người xem không tưởng bi tự nhảy
export const BALL_IN_HAND_REASON_LABEL = {
  scratch: 'bi cái thụt lỗ',
  snookered: 'bị che hết đường',
}

// Mỗi cơ có thể có nhiều cửa ăn với độ khó khác nhau — nền cho việc cược
// "bi số N vào lỗ nào". Màu dùng cho cả chip ở panel lẫn đường vẽ trên bàn.
export const DIFFICULTY_LABEL = { easy: 'Dễ', medium: 'Vừa', hard: 'Khó' }
export const DIFFICULTY_COLOR = { easy: '#1db954', medium: '#e8a317', hard: '#e2513d' }

/** Nhãn cửa cược: lỗ cụ thể, hoặc "NPC đánh trượt" */
export const optionLabel = (option, pocketName) =>
  option.outcome === 'miss' ? 'NPC đánh trượt' : pocketName(option.pocket)

/** Khoá định danh một cửa, dùng làm React key và để so kèo đã đặt */
export const optionKey = (option) =>
  option.outcome === 'miss' ? 'miss' : `pocket:${option.pocket}`

/**
 * Polite Coins là số nguyên nên tiền thắng LÀM TRÒN XUỐNG. Hệ quả: cửa gần
 * chắc ăn (×1.05) mà đặt ít thì floor() ăn hết phần lãi — phải đặt đủ lớn mới
 * lời nổi 1 PC. Hai hàm này phải khớp với payoutFor/minStakeFor ở
 * api/services/billiards.service.js.
 */
export const payoutFor = (amount, odds) => Math.floor(amount * odds)
export const minStakeFor = (odds) => (odds > 1 ? Math.ceil(1 / (odds - 1)) : Infinity)

/** Kèo đã đặt có trúng cửa này không (dùng để tô sáng lựa chọn của user) */
export const betMatchesOption = (bet, option) =>
  Boolean(bet) &&
  bet.outcome === option.outcome &&
  (option.outcome === 'miss' || bet.pocket === option.pocket)

/** Kết quả thật của một cơ, để đối chiếu với kèo đã đặt */
export const optionWon = (option, shot) =>
  option.outcome === 'miss'
    ? Boolean(shot.missed)
    : !shot.missed && shot.chosenPocket === option.pocket

const toMs = (value) => (value instanceof Date ? value.getTime() : new Date(value).getTime())

/**
 * Ván đang ở đâu tại thời điểm `now`.
 * Trả về đủ thứ cần để vẽ: cú thứ mấy, pha nào (ngắm/lăn/dừng), khung hình nào.
 */
export const getPlaybackState = (game, now = Date.now()) => {
  if (!game || !Array.isArray(game.shots) || game.shots.length === 0) {
    return { phase: 'idle', shotIndex: -1, shot: null, subPhase: null, frame: 0, progress: 0 }
  }

  const startsAt = toMs(game.startsAt)
  const elapsed = now - startsAt

  if (elapsed < 0) {
    return {
      phase: 'countdown',
      shotIndex: -1,
      shot: null,
      subPhase: null,
      frame: 0,
      progress: 0,
      countdownMs: -elapsed,
    }
  }

  const shots = game.shots
  const last = shots[shots.length - 1]
  const totalMs = last.startAt + last.durationMs

  if (elapsed >= totalMs) {
    return {
      phase: 'finished',
      shotIndex: shots.length - 1,
      shot: last,
      subPhase: 'settle',
      frame: Math.max(0, (last.frames?.length || 1) - 1),
      progress: 1,
      overMs: elapsed - totalMs,
    }
  }

  let shotIndex = 0
  for (let i = shots.length - 1; i >= 0; i -= 1) {
    if (elapsed >= shots[i].startAt) {
      shotIndex = i
      break
    }
  }

  const shot = shots[shotIndex]
  const local = elapsed - shot.startAt
  const lastFrame = Math.max(0, (shot.frames?.length || 1) - 1)
  const base = { phase: 'playing', shotIndex, shot, progress: elapsed / totalMs }
  const waitMs = shot.waitMs || 0 // ván cũ trong cache chưa có trường này

  // Pha chờ: bàn đứng yên, chưa dựng cây cơ. Client đếm ngược ở đây.
  if (local < waitMs) {
    return {
      ...base,
      subPhase: 'wait',
      frame: 0,
      aimProgress: 0,
      waitRemainingMs: waitMs - local,
    }
  }

  if (local < waitMs + shot.aimMs) {
    return {
      ...base,
      subPhase: 'aim',
      frame: 0,
      aimProgress: (local - waitMs) / shot.aimMs,
    }
  }

  const rollLocal = local - waitMs - shot.aimMs
  if (rollLocal < shot.rollMs) {
    return {
      ...base,
      subPhase: 'roll',
      frame: Math.min(lastFrame, (rollLocal / 1000) * REPLAY_FPS),
      aimProgress: 1,
    }
  }

  return { ...base, subPhase: 'settle', frame: lastFrame, aimProgress: 1 }
}

/**
 * Nội suy vị trí các bi ở khung hình `frame` (số thực) của một cú đánh.
 * `sink` 0→1 là tiến trình bi tụt xuống lỗ, để vẽ hiệu ứng biến mất.
 */
export const interpolateFrame = (shot, frame) => {
  if (!shot || !shot.frames || shot.frames.length === 0) return []

  const lastIndex = shot.frames.length - 1
  const clamped = Math.max(0, Math.min(frame, lastIndex))
  const i0 = Math.floor(clamped)
  const i1 = Math.min(i0 + 1, lastIndex)
  const t = clamped - i0
  const a = shot.frames[i0]
  const b = shot.frames[i1]

  const potFrames = new Map()
  ;(shot.pots || []).forEach((pot) => potFrames.set(pot.ball, pot.frame))

  return shot.ids.map((id, k) => {
    const potFrame = potFrames.get(id)
    // Bi rơi lỗ mất khoảng 6 khung (~0.24s) để chìm hẳn
    const sink =
      potFrame === undefined || clamped < potFrame
        ? 0
        : Math.min(1, (clamped - potFrame) / 6)
    return {
      id,
      x: a[k * 2] + (b[k * 2] - a[k * 2]) * t,
      y: a[k * 2 + 1] + (b[k * 2 + 1] - a[k * 2 + 1]) * t,
      sink,
    }
  })
}

/** Danh sách bi đã vào lỗ tính tới thời điểm phát lại hiện tại */
export const getPottedSoFar = (game, playback) => {
  if (!game || !game.shots || playback.shotIndex < 0) return []
  const out = []
  game.shots.forEach((shot) => {
    if (shot.index > playback.shotIndex) return
    ;(shot.pots || []).forEach((pot) => {
      if (pot.ball === 0) return
      if (shot.index === playback.shotIndex && pot.frame > playback.frame) return
      out.push({ ball: pot.ball, pocket: pot.pocket, shotIndex: shot.index })
    })
  })
  return out
}

/** Bi mục tiêu đang được nhắm — bi số nhỏ nhất chưa vào lỗ */
export const getRemainingBalls = (game, playback) => {
  const potted = new Set(getPottedSoFar(game, playback).map((p) => p.ball))
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((id) => !potted.has(id))
}

/** Nhãn ngắn cho badge ở cột phải */
export const getStatusLabel = (game, now = Date.now()) => {
  if (!game) return 'Đang tải...'
  const playback = getPlaybackState(game, now)
  if (playback.phase === 'countdown') {
    return `Xếp bi · ${Math.ceil(playback.countdownMs / 1000)}s`
  }
  if (playback.phase === 'finished') return 'Hết ván'
  if (playback.phase === 'idle') return 'Đang chờ'
  return `Cơ ${playback.shotIndex + 1}/${game.totalShots}`
}

/** Nhãn cho nút ở cột phải — chỉ cần startsAt/endsAt, không cần tải cả frames */
export const getSummaryLabel = (summary, now = Date.now()) => {
  if (!summary) return 'Đang tải...'
  const startsAt = toMs(summary.startsAt)
  const endsAt = toMs(summary.endsAt)
  if (now < startsAt) return `Xếp bi · ${Math.ceil((startsAt - now) / 1000)}s`
  if (now < endsAt) return `Đang dọn bàn · còn ${Math.ceil((endsAt - now) / 1000)}s`
  return 'Ván mới'
}

/**
 * Độ lùi của cây cơ trong pha ngắm (đơn vị cm trên mặt bàn).
 * Vào vị trí → kéo cơ về sau → thụt mạnh về trước.
 */
export const getCueOffset = (aimProgress, power = 0.5) => {
  const pull = 8 + 26 * Math.min(1, power + 0.25)
  if (aimProgress < 0.35) return 8 + (pull - 8) * (aimProgress / 0.35) * 0.35
  if (aimProgress < 0.78) {
    const t = (aimProgress - 0.35) / 0.43
    return 8 + (pull - 8) * (0.35 + 0.65 * t)
  }
  const t = (aimProgress - 0.78) / 0.22
  return pull * (1 - t * t) // thụt cơ: nhanh dần đều
}
