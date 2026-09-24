// Tiện ích thuần cho màn Ma Sói. Mọi luật đều do server quyết; ở đây chỉ là
// hiển thị (đếm ngược, gom phiếu, đoán kênh chat để gợi ý cho người gõ).

export const PHASE_META = {
  night: { icon: '🌙', label: 'Đêm' },
  day: { icon: '☀️', label: 'Ngày' },
  vote: { icon: '🗳️', label: 'Bỏ phiếu' },
  hunter: { icon: '🎯', label: 'Phát súng cuối' },
}

export const CHANNEL_META = {
  public: { label: 'Cả làng', className: 'is-public' },
  wolves: { label: 'Bầy sói', className: 'is-wolves' },
  dead: { label: 'Nghĩa địa', className: 'is-dead' },
  private: { label: 'Chỉ bạn thấy', className: 'is-private' },
}

export const ACTION_VERB = {
  wolf_kill: 'Cắn',
  see: 'Soi',
  guard: 'Bảo vệ',
  stab: 'Ra tay',
  pair: 'Se duyên',
  vote: 'Bầu',
  gunner_shot: 'Bắn',
  hunter_shot: 'Bắn',
}

export const WOLF_ROLES = ['wolf', 'alpha_wolf', 'wolf_cub']

export const TEAM_LABEL = {
  village: 'Phe dân làng',
  wolf: 'Phe sói',
  tanner: 'Đơn độc',
  killer: 'Đơn độc',
}

// Đồng hồ server: phaseEndsAt là mốc server, bù lệch bằng serverNow lúc nhận state.
export const getRemainingMs = (endsAt, state, receivedAt, nowMs = Date.now()) => {
  if (!endsAt || !state?.serverNow) return 0
  const serverNow = state.serverNow + (nowMs - receivedAt)
  return Math.max(0, endsAt - serverNow)
}

export const formatCountdown = (ms) => {
  const total = Math.ceil(Math.max(0, ms) / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// Kênh mà tin nhắn tiếp theo của mình sẽ rơi vào — khớp với engine.chat ở server.
export const chatChannelFor = (state) => {
  const me = state?.me
  if (!me) return { channel: null, reason: state?.status === 'playing' ? 'Bạn đang xem ván này' : 'Vào làng để trò chuyện' }
  if (state.status !== 'playing') return { channel: 'public' }
  if (!me.alive) return { channel: 'dead' }
  if (state.phase === 'night') {
    return WOLF_ROLES.includes(me.role)
      ? { channel: 'wolves' }
      : { channel: null, reason: 'Ban đêm dân làng phải ngủ…' }
  }
  return { channel: 'public' }
}

// { targetId: [voter, ...] } từ phiếu công khai trong pha bỏ phiếu
export const tallyVotes = (players = []) => {
  const byId = new Map(players.map((p) => [p.userId, p]))
  return players.reduce((acc, voter) => {
    if (!voter.vote || !voter.alive) return acc
    acc[voter.vote] = acc[voter.vote] || []
    acc[voter.vote].push(byId.get(voter.userId))
    return acc
  }, {})
}

export const roleMeta = (catalog, key) => catalog?.find((role) => role.key === key) || null

export const roleText = (catalog, key) => {
  const meta = roleMeta(catalog, key)
  return meta ? `${meta.emoji} ${meta.name}` : ''
}

export const isWolfRole = (role) => WOLF_ROLES.includes(role)
