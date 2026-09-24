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
  cult: { label: 'Tà giáo', className: 'is-cult' },
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
  freeze: 'Đóng băng',
  visit: 'Ngủ nhờ nhà',
  hunt: 'Truy lùng',
  convert: 'Chiêu mộ',
  arson: 'Tưới xăng',
  model: 'Chọn làm hình mẫu',
  steal: 'Trộm vai',
  investigate: 'Điều tra',
  gunner_shot: 'Bắn',
  hunter_shot: 'Bắn',
}

// Phe sói nhìn thấy nhau và chat chung (Pháp sư không nằm trong đây)
export const WOLF_ROLES = ['wolf', 'alpha_wolf', 'wolf_cub', 'lycan', 'snow_wolf']

export const TEAM_LABEL = {
  village: 'Phe dân làng',
  wolf: 'Phe sói',
  tanner: 'Đơn độc',
  killer: 'Đơn độc',
  arsonist: 'Đơn độc',
  cult: 'Phe tà giáo',
  neutral: 'Trung lập',
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
    if (WOLF_ROLES.includes(me.role)) return { channel: 'wolves' }
    if (me.role === 'cultist') return { channel: 'cult' }
    return { channel: null, reason: 'Ban đêm dân làng phải ngủ…' }
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

export const DEATH_CAUSE_LABEL = {
  eaten: 'Bị sói ăn',
  stabbed: 'Bị sát nhân đâm',
  visit_killer: 'Lạc vào nhà sát nhân',
  guard_wolf: 'Canh nhầm nhà sói',
  hunter_night: 'Trúng đạn thợ săn',
  heartbreak: 'Chết theo người yêu',
  lynched: 'Bị treo cổ',
  gunner: 'Bị xạ thủ bắn',
  hunter_shot: 'Bị thợ săn bắn',
  visit_wolf: 'Gõ nhầm cửa hang sói',
  harlot_victim: 'Ngủ nhờ nhà có án mạng',
  hunted: 'Bị thợ săn tà giáo hạ',
  visit_burning: 'Vào nhà đang cháy',
  burned: 'Chết cháy',
  night: 'Chết trong đêm',
}

const DAY_CAUSES = ['lynched', 'gunner', 'hunter_shot']

// "Chết đêm 2 · Bị sói ăn" / "Sống sót". Ván cũ chưa lưu deathPhase thì đoán theo nguyên nhân.
export const describeFate = (player) => {
  if (player.alive) return 'Sống sót'
  const atNight = player.deathPhase ? player.deathPhase === 'night' : !DAY_CAUSES.includes(player.deathCause)
  const when = player.deathDay ? ` ${atNight ? 'đêm' : 'ngày'} ${player.deathDay}` : ''
  return `Chết${when} · ${DEATH_CAUSE_LABEL[player.deathCause] || 'Không rõ'}`
}

// Người thắng lên trước, trong mỗi nhóm thì người sống lên trước
export const sortHistoryPlayers = (players = []) =>
  [...players].sort((a, b) => Number(b.winner) - Number(a.winner) || Number(b.alive) - Number(a.alive))

// Gợi ý ở sảnh chờ: với số người hiện tại thì phe thứ ba nào có thể xuất hiện, còn thiếu bao nhiêu người.
export const thirdPartyHint = (count, dealing, nameOf = (key) => key) => {
  if (!dealing?.thirdParties?.length) return null
  const label = (group) => group.roles.filter((role) => role !== 'cult_hunter').map(nameOf).join(' hoặc ')
  const unlocked = dealing.thirdParties.filter((group) => count >= group.minPlayers)
  const next = dealing.thirdParties.filter((group) => count < group.minPlayers).sort((a, b) => a.minPlayers - b.minPlayers)[0]
  const parts = []
  if (unlocked.length) parts.push(`Ván này có thể có phe thứ ba: ${unlocked.map(label).join(', ')}.`)
  else parts.push('Ván này chỉ có dân làng đấu với sói.')
  if (next) parts.push(`Thêm ${next.minPlayers - count} người nữa để có thể gặp ${label(next)}.`)
  return parts.join(' ')
}
