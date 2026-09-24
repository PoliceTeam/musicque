// Engine Ma Sói thuần (không I/O): mọi hàm nhận state + now + rng và trả về
// events để service quyết định broadcast/persist. Luật tham khảo GreyWolfDev/Werewolf,
// phần cài đặt viết mới và rút gọn cho 13 vai.
const {
  TEAM,
  TEAM_LABEL,
  ROLES,
  VILLAGE_SPECIALS,
  isWolfRole,
  teamOfRole,
  strengthOf,
  roleLabel,
} = require('./roles')

// Mặc định là hằng số; admin chỉnh các mốc thời gian lúc chạy qua applySettings
// (service lưu vào Mongo và nạp lại khi khởi động).
const CONFIG = {
  MIN_PLAYERS: 5,
  MAX_PLAYERS: 16,
  NIGHT_MS: 20_000,
  CUPID_NIGHT_MS: 30_000,
  DAY_MS: 120_000,
  VOTE_MS: 20_000,
  HUNTER_MS: 20_000,
  AUTOSTART_MS: 60_000,
  ENDED_RESET_MS: 5 * 60_000,
  // Mặc định giấu vai người chết tới hết ván — dân làng không biết mình treo cổ trúng ai
  REVEAL_ROLE_ON_DEATH: false,
  WIN_REWARD: 30,
  ALPHA_BITE_CHANCE: 0.2,
  HUNTER_BASE_CHANCE: 0.3,
  HUNTER_PER_EXTRA_WOLF: 0.2,
  GUARD_WOLF_DEATH_CHANCE: 0.5,
  SK_BEATS_WOLF_CHANCE: 0.8,
  GUNNER_BULLETS: 2,
  CHAT_MAX: 240,
  CHAT_COOLDOWN_MS: 600,
  LOG_LIMIT: 600,
}

// Các mốc thời gian admin được chỉnh, kèm giới hạn (ms) để không ai đặt 0 giây hay 3 tiếng.
const TIMING_FIELDS = [
  { key: 'nightMs', configKey: 'NIGHT_MS', label: 'Ban đêm', min: 15_000, max: 300_000 },
  { key: 'cupidNightMs', configKey: 'CUPID_NIGHT_MS', label: 'Đêm đầu có Thần tình yêu', min: 15_000, max: 300_000 },
  { key: 'dayMs', configKey: 'DAY_MS', label: 'Thảo luận ban ngày', min: 15_000, max: 600_000 },
  { key: 'voteMs', configKey: 'VOTE_MS', label: 'Bỏ phiếu', min: 10_000, max: 300_000 },
  { key: 'hunterMs', configKey: 'HUNTER_MS', label: 'Thợ săn bắn phát cuối', min: 10_000, max: 120_000 },
  { key: 'autoStartMs', configKey: 'AUTOSTART_MS', label: 'Tự bắt đầu khi đủ người', min: 10_000, max: 600_000 },
  { key: 'endedResetMs', configKey: 'ENDED_RESET_MS', label: 'Giữ màn kết quả', min: 30_000, max: 3_600_000 },
].map((field) => ({ ...field, defaultMs: CONFIG[field.configKey] }))

const getTimings = () =>
  Object.fromEntries(TIMING_FIELDS.map((field) => [field.key, CONFIG[field.configKey]]))

// Công tắc bật/tắt (boolean) admin chỉnh được, cùng cơ chế "thiếu thì về mặc định".
const OPTION_FIELDS = [
  { key: 'revealRoleOnDeath', configKey: 'REVEAL_ROLE_ON_DEATH', label: 'Công bố vai khi có người chết' },
].map((field) => ({ ...field, defaultValue: CONFIG[field.configKey] }))

const getOptions = () =>
  Object.fromEntries(OPTION_FIELDS.map((field) => [field.key, CONFIG[field.configKey]]))

// Nhận các giá trị ghi đè { nightMs, ... }; field thiếu quay về mặc định (không giữ giá trị cũ),
// nên đổi hằng số mặc định trong code luôn có hiệu lực với field admin chưa từng chỉnh.
// Trả { ok, timings } hoặc { ok:false, message } nếu có giá trị ngoài khoảng.
const applySettings = (input = {}) => {
  const next = {}
  for (const field of TIMING_FIELDS) {
    if (input[field.key] === undefined || input[field.key] === null) {
      next[field.configKey] = field.defaultMs
      continue
    }
    const value = Math.round(Number(input[field.key]))
    if (!Number.isFinite(value) || value < field.min || value > field.max) {
      return {
        ok: false,
        message: `${field.label} phải từ ${field.min / 1000} đến ${field.max / 1000} giây`,
      }
    }
    next[field.configKey] = value
  }
  for (const field of OPTION_FIELDS) {
    const value = input[field.key]
    if (value === undefined || value === null) next[field.configKey] = field.defaultValue
    else if (typeof value === 'boolean') next[field.configKey] = value
    else return { ok: false, message: `${field.label} phải là bật hoặc tắt` }
  }
  Object.assign(CONFIG, next)
  return { ok: true, timings: getTimings(), options: getOptions() }
}

const STATUS = { LOBBY: 'lobby', PLAYING: 'playing', ENDED: 'ended' }
const PHASE = { NIGHT: 'night', DAY: 'day', VOTE: 'vote', HUNTER: 'hunter' }
const SKIP = 'skip'

const idOf = (value) => String(value)
const ok = (extra = {}) => ({ ok: true, events: ['changed'], ...extra })
const fail = (code, message) => ({ ok: false, code, message, events: [] })

const pick = (list, rng) => list[Math.floor(rng() * list.length)]
const shuffle = (list, rng) => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ── State ──────────────────────────────────────────────────────────────

const createInitialState = () => ({
  status: STATUS.LOBBY,
  gameId: null,
  hostId: null,
  autoStartAt: null,
  players: [],
  phase: null,
  day: 0,
  phaseStartedAt: null,
  phaseEndsAt: null,
  actions: {},
  votes: {},
  ready: {},
  hunter: null,
  flags: { wolvesDrunk: false, cubRage: false, gunnerShotDay: null },
  log: [],
  logSeq: 0,
  result: null,
  startedAt: null,
  endedAt: null,
  lastChatAt: {},
  revealRoleOnDeath: CONFIG.REVEAL_ROLE_ON_DEATH,
})

const createPlayer = (user, now, extras = {}) => ({
  userId: idOf(user._id || user.userId),
  displayName: user.displayName || user.username || 'Ẩn danh',
  avatarId: user.avatarId || null,
  color: user.color || null,
  isBot: Boolean(extras.isBot),
  joinedAt: now,
  role: null,
  originalRole: null,
  alive: true,
  death: null,
  loverId: null,
  bullets: 0,
  revealed: false,
  pendingBite: false,
})

const findPlayer = (state, userId) => state.players.find((p) => p.userId === idOf(userId))
const alivePlayers = (state) => state.players.filter((p) => p.alive)
const teamOf = (player) => teamOfRole(player.role)
const isWolf = (player) => Boolean(player && isWolfRole(player.role))
const aliveWolves = (state) => alivePlayers(state).filter(isWolf)
const aliveWithRole = (state, role) => alivePlayers(state).find((p) => p.role === role) || null

const pushLog = (state, entry, now) => {
  state.logSeq += 1
  state.log.push({
    id: state.logSeq,
    at: now,
    day: state.day,
    phase: state.phase,
    kind: entry.kind || 'system',
    channel: entry.channel || 'public',
    to: entry.to ? entry.to.map(idOf) : undefined,
    text: entry.text,
    author: entry.author,
  })
  if (state.log.length > CONFIG.LOG_LIMIT) state.log.splice(0, state.log.length - CONFIG.LOG_LIMIT)
}

const tell = (state, players, text, now) => {
  const to = (Array.isArray(players) ? players : [players]).filter(Boolean).map((p) => p.userId)
  if (to.length) pushLog(state, { channel: 'private', to, text }, now)
}

const tellWolves = (state, text, now) => pushLog(state, { channel: 'wolves', text }, now)

const announce = (state, text, now) => pushLog(state, { channel: 'public', text }, now)

// ── Chia vai ───────────────────────────────────────────────────────────

const wolfCountFor = (n) => (n >= 13 ? 3 : n >= 8 ? 2 : 1)

const isBalanced = (roles) => {
  const n = roles.length
  if (!roles.some(isWolfRole)) return false
  const enemies = roles.filter((role) => teamOfRole(role) !== TEAM.VILLAGE)
  const village = roles.filter((role) => teamOfRole(role) === TEAM.VILLAGE)
  if (enemies.length >= village.length) return false
  const villageStrength = village.reduce((sum, role) => sum + strengthOf(role, roles), 0)
  const enemyStrength = enemies.reduce((sum, role) => sum + strengthOf(role, roles), 0)
  return Math.abs(villageStrength - enemyStrength) <= Math.floor(n / 4) + 1
}

const buildRoles = (n, rng) => {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const roles = []
    const wolfSpecials = shuffle(['alpha_wolf', 'wolf_cub'], rng)
    for (let i = 0; i < wolfCountFor(n); i += 1) {
      roles.push(wolfSpecials.length && rng() < 0.35 ? wolfSpecials.pop() : 'wolf')
    }
    if (n >= 8 && rng() < 0.35) roles.push('serial_killer')
    if (n >= 6 && rng() < 0.3) roles.push('tanner')

    let specials = shuffle(VILLAGE_SPECIALS, rng)
    if (rng() < 0.85) specials = ['seer', ...specials.filter((role) => role !== 'seer')]
    const remaining = n - roles.length
    const specialCount = Math.min(specials.length, remaining, Math.max(1, Math.round(remaining * (0.3 + rng() * 0.45))))
    roles.push(...specials.slice(0, specialCount))
    while (roles.length < n) roles.push('villager')

    if (roles.length === n && isBalanced(roles)) return { roles: shuffle(roles, rng), attempts: attempt + 1 }
  }
  // Không cân được (rất hiếm) → bộ vai tối giản luôn hợp lệ
  const roles = ['wolf', 'seer']
  while (roles.length < n) roles.push('villager')
  return { roles: shuffle(roles, rng), attempts: -1 }
}

// ── Sảnh chờ ───────────────────────────────────────────────────────────

const resetToLobby = (state) => {
  const fresh = createInitialState()
  Object.keys(state).forEach((key) => { delete state[key] })
  Object.assign(state, fresh)
}

const refreshAutoStart = (state, now) => {
  if (state.status !== STATUS.LOBBY) return
  if (state.players.length >= CONFIG.MIN_PLAYERS) {
    if (!state.autoStartAt) state.autoStartAt = now + CONFIG.AUTOSTART_MS
  } else {
    state.autoStartAt = null
  }
}

const joinLobby = (state, user, now, extras = {}) => {
  if (state.status === STATUS.ENDED) resetToLobby(state)
  if (state.status !== STATUS.LOBBY) return fail('GAME_RUNNING', 'Ván đang diễn ra, đợi ván sau nhé')
  const userId = idOf(user._id || user.userId)
  if (findPlayer(state, userId)) return ok()
  if (state.players.length >= CONFIG.MAX_PLAYERS) return fail('LOBBY_FULL', `Làng đã đủ ${CONFIG.MAX_PLAYERS} người`)
  state.players.push(createPlayer(user, now, extras))
  if (!state.hostId && !extras.isBot) state.hostId = userId
  refreshAutoStart(state, now)
  if (!extras.isBot) announce(state, `🚪 ${user.displayName || user.username} đã vào làng.`, now)
  return ok()
}

const leaveLobby = (state, userId, now) => {
  if (state.status !== STATUS.LOBBY) return fail('NOT_IN_LOBBY', 'Ván đã bắt đầu, không thể rời sảnh')
  const index = state.players.findIndex((p) => p.userId === idOf(userId))
  if (index === -1) return fail('NOT_JOINED', 'Bạn chưa vào làng')
  const [left] = state.players.splice(index, 1)
  if (state.hostId === left.userId) state.hostId = state.players.find((p) => !p.isBot)?.userId || null
  if (!state.players.some((p) => !p.isBot)) state.players = []
  refreshAutoStart(state, now)
  announce(state, `👋 ${left.displayName} đã rời làng.`, now)
  return ok()
}

const BOT_NAMES = ['Bác Ba', 'Cô Tư', 'Chú Năm', 'Anh Sáu', 'Chị Bảy', 'Ông Tám', 'Bà Chín', 'Út Mười', 'Cậu Tý', 'Mợ Sửu', 'Thím Dần']

const fillBots = (state, now, target = Math.max(CONFIG.MIN_PLAYERS, 7)) => {
  if (state.status !== STATUS.LOBBY) return fail('NOT_IN_LOBBY', 'Chỉ thêm bot khi đang ở sảnh chờ')
  let index = 0
  while (state.players.length < Math.min(target, CONFIG.MAX_PLAYERS)) {
    index += 1
    const botId = `bot-${index}`
    if (findPlayer(state, botId)) continue
    state.players.push(createPlayer({ userId: botId, displayName: `🤖 ${BOT_NAMES[(index - 1) % BOT_NAMES.length]}` }, now, { isBot: true }))
  }
  refreshAutoStart(state, now)
  return ok()
}

const hasBots = (state) => state.players.some((p) => p.isBot)

// ── Bắt đầu ván ────────────────────────────────────────────────────────

const setPhase = (state, phase, durationMs, now) => {
  state.phase = phase
  state.phaseStartedAt = now
  state.phaseEndsAt = now + durationMs
}

const startGame = (state, { gameId, now, rng, byUserId = null } = {}) => {
  if (state.status !== STATUS.LOBBY) return fail('GAME_RUNNING', 'Ván đã bắt đầu')
  if (byUserId && state.hostId !== idOf(byUserId)) return fail('NOT_HOST', 'Chỉ chủ phòng mới được bắt đầu sớm')
  if (state.players.length < CONFIG.MIN_PLAYERS) {
    return fail('NOT_ENOUGH_PLAYERS', `Cần ít nhất ${CONFIG.MIN_PLAYERS} người để bắt đầu`)
  }
  const { roles } = buildRoles(state.players.length, rng)
  state.players = shuffle(state.players, rng)
  state.players.forEach((player, index) => {
    player.role = roles[index]
    player.originalRole = roles[index]
    player.bullets = player.role === 'gunner' ? CONFIG.GUNNER_BULLETS : 0
  })
  state.status = STATUS.PLAYING
  state.gameId = gameId ? idOf(gameId) : `ww-${now}`
  state.startedAt = now
  // Chốt luật cho cả ván: admin đổi công tắc giữa chừng không lật vai người đã chết
  state.revealRoleOnDeath = CONFIG.REVEAL_ROLE_ON_DEATH
  state.autoStartAt = null
  state.day = 0

  announce(state, `🌕 Ván Ma Sói bắt đầu với ${state.players.length} người. Mỗi người đã nhận vai bí mật của mình.`, now)
  state.players.forEach((player) => {
    tell(state, player, `Bạn là ${roleLabel(player.role)}. ${ROLES[player.role].summary}`, now)
  })
  const wolves = state.players.filter(isWolf)
  if (wolves.length > 1) {
    tellWolves(state, `🐺 Bầy sói đêm nay: ${wolves.map((w) => `${w.displayName} (${ROLES[w.role].name})`).join(', ')}.`, now)
  }
  startNight(state, now, rng)
  return ok({ events: ['changed', 'started'] })
}

// ── Hành động khả dụng ─────────────────────────────────────────────────

const targetsExcept = (state, player, predicate = () => true) =>
  alivePlayers(state).filter((p) => p.userId !== player.userId && predicate(p)).map((p) => p.userId)

const needsCupid = (state) => state.day === 1 && !state.players.some((p) => p.loverId)

// Mô tả lượt của một người chơi trong pha hiện tại, dùng cho cả server lẫn UI.
const availableAction = (state, player) => {
  if (!player || state.status !== STATUS.PLAYING) return null
  if (state.phase === PHASE.HUNTER) {
    if (state.hunter?.userId === player.userId) {
      return { kind: 'hunter_shot', label: 'Bắn một người trước khi gục', targets: targetsExcept(state, player) }
    }
    return null
  }
  if (!player.alive) return null

  if (state.phase === PHASE.NIGHT) {
    if (isWolf(player)) {
      if (state.flags.wolvesDrunk) return { kind: 'none', label: 'Bầy sói say mèm, đêm nay không đi săn được' }
      const targets = targetsExcept(state, player, (p) => !isWolf(p))
      const needsTwo = state.flags.cubRage && targets.length >= 2
      return {
        kind: 'wolf_kill',
        label: needsTwo ? 'Sói con đã chết — chọn HAI người để ăn thịt' : 'Chọn người để bầy sói ăn thịt',
        targets,
        needsTwo,
      }
    }
    switch (player.role) {
      case 'seer':
        return { kind: 'see', label: 'Chọn người để soi vai', targets: targetsExcept(state, player) }
      case 'guardian':
        return { kind: 'guard', label: 'Chọn người để bảo vệ đêm nay', targets: targetsExcept(state, player) }
      case 'serial_killer':
        return { kind: 'stab', label: 'Chọn người để ra tay', targets: targetsExcept(state, player) }
      case 'cupid':
        if (!needsCupid(state)) return null
        return {
          kind: 'pair',
          label: 'Chọn hai người để se duyên (có thể gồm bạn)',
          targets: alivePlayers(state).map((p) => p.userId),
          needsTwo: true,
        }
      default:
        return null
    }
  }

  if (state.phase === PHASE.DAY && player.role === 'gunner' && player.bullets > 0 && state.flags.gunnerShotDay !== state.day) {
    return { kind: 'gunner_shot', label: `Nổ súng (còn ${player.bullets} viên)`, targets: targetsExcept(state, player) }
  }

  if (state.phase === PHASE.VOTE) {
    return { kind: 'vote', label: 'Bỏ phiếu treo cổ', targets: targetsExcept(state, player), allowSkip: true }
  }
  return null
}

const NIGHT_KINDS = ['wolf_kill', 'see', 'guard', 'stab', 'pair']

const nightActionComplete = (state, player) => {
  const action = availableAction(state, player)
  if (!action || !NIGHT_KINDS.includes(action.kind)) return true
  const chosen = state.actions[player.userId]
  if (!chosen?.targetId) return false
  return !action.needsTwo || Boolean(chosen.targetId2)
}

const allNightActionsDone = (state) => alivePlayers(state).every((p) => nightActionComplete(state, p))

// ── Chết & hệ quả ──────────────────────────────────────────────────────

// Giết một người và kéo theo hệ quả (người yêu, sói con, phát súng thợ săn).
// finalShot=false khi thợ săn bị sói ăn — trường hợp đó đã có cơ hội bắn sói riêng.
const killPlayer = (state, player, cause, ctx, { finalShot = true } = {}) => {
  if (!player || !player.alive) return
  player.alive = false
  player.death = { day: state.day, phase: state.phase, cause }
  ctx.deaths.push({ player, cause, by: ctx.by })
  if (player.role === 'wolf_cub') state.flags.cubRage = true
  if (player.role === 'hunter' && finalShot && alivePlayers(state).length > 0) ctx.hunterShot = player.userId
  if (player.loverId) {
    const lover = findPlayer(state, player.loverId)
    if (lover?.alive) killPlayer(state, lover, 'heartbreak', ctx)
  }
}

const DEATH_TEXT = {
  eaten: (name) => `🐺 Sáng ra, dân làng tìm thấy thi thể ${name} bị xé nát.`,
  stabbed: (name) => `🔪 ${name} được phát hiện với vô số vết dao trên người.`,
  visit_killer: (name) => `🔪 ${name} đêm qua lạc vào nhà kẻ sát nhân và không bao giờ trở ra.`,
  guard_wolf: (name) => `👼 ${name} đứng canh nhầm cửa nhà một con sói và bị ăn thịt.`,
  hunter_night: (name) => `🎯 ${name} trúng đạn của thợ săn ngay lúc đang săn mồi.`,
  heartbreak: (name) => `💔 Không chịu nổi mất mát, ${name} đã đi theo người mình yêu.`,
  lynched: (name) => `⚖️ Dân làng đã treo cổ ${name}.`,
  gunner: (name, by) => `🔫 ĐOÀNG! ${by} rút súng bắn gục ${name}.`,
  hunter_shot: (name, by) => `🎯 Trước khi gục xuống, thợ săn ${by} kịp kéo ${name} theo cùng.`,
}

// Các nguyên nhân chết ban đêm tự nó lộ vai (canh nhầm nhà sói → thiên thần + sói,
// trúng đạn thợ săn khi săn mồi → sói…). Khi giấu vai, chúng được báo chung một câu.
const HIDDEN_NIGHT_CAUSES = ['eaten', 'stabbed', 'visit_killer', 'guard_wolf', 'hunter_night']
const HIDDEN_NIGHT_TEXT = (name) => `🪦 Sáng ra, người ta tìm thấy ${name} đã chết.`

const publicCauseOf = (cause) => (HIDDEN_NIGHT_CAUSES.includes(cause) ? 'night' : cause)

const announceDeaths = (state, deaths, now) => {
  deaths.forEach(({ player, cause, by }) => {
    if (!state.revealRoleOnDeath) {
      const text = HIDDEN_NIGHT_CAUSES.includes(cause) ? HIDDEN_NIGHT_TEXT(player.displayName) : DEATH_TEXT[cause](player.displayName, by)
      announce(state, `${text} Vai của ${player.displayName} sẽ được lật khi hết ván.`, now)
      return
    }
    const text = (DEATH_TEXT[cause] || DEATH_TEXT.eaten)(player.displayName, by)
    announce(state, `${text} ${player.displayName} là ${roleLabel(player.role)}.`, now)
  })
}

// ── Kiểm tra thắng ─────────────────────────────────────────────────────

const checkWinner = (state, rng, now) => {
  const alive = alivePlayers(state)
  if (alive.length === 0) return { team: TEAM.NONE }
  if (alive.length === 1) {
    const [last] = alive
    return { team: last.role === 'tanner' ? TEAM.NONE : teamOf(last) }
  }
  if (alive.length === 2) {
    const [a, b] = alive
    if (a.loverId === b.userId) return { team: TEAM.LOVERS }
    const hunter = alive.find((p) => p.role === 'hunter')
    if (hunter) {
      const other = alive.find((p) => p !== hunter)
      if (other.role === 'serial_killer') return { team: TEAM.KILLER }
      if (isWolf(other)) {
        const ctx = { deaths: [] }
        if (rng() < CONFIG.HUNTER_BASE_CHANCE) {
          announce(state, `🎯 Chỉ còn hai người. Thợ săn ${hunter.displayName} nhanh tay hơn và hạ gục ${other.displayName}!`, now)
          killPlayer(state, other, 'hunter_shot', ctx, { finalShot: false })
          return { team: TEAM.VILLAGE }
        }
        announce(state, `🐺 Chỉ còn hai người. ${other.displayName} vồ tới trước khi thợ săn ${hunter.displayName} kịp bóp cò!`, now)
        killPlayer(state, hunter, 'eaten', ctx, { finalShot: false })
        return { team: TEAM.WOLF }
      }
    }
    if (alive.some((p) => p.role === 'serial_killer')) return { team: TEAM.KILLER }
  }
  if (alive.some((p) => p.role === 'serial_killer')) return null

  const wolves = alive.filter(isWolf).length
  const others = alive.length - wolves
  if (wolves >= others) {
    const gunnerCanSwing = alive.some((p) => p.role === 'gunner' && p.bullets > 0) && wolves === others
    return gunnerCanSwing ? null : { team: TEAM.WOLF }
  }
  if (wolves === 0) return { team: TEAM.VILLAGE }
  return null
}

const winnersFor = (state, team) => {
  if (team === TEAM.NONE) return []
  if (team === TEAM.LOVERS) return state.players.filter((p) => p.loverId).map((p) => p.userId)
  if (team === TEAM.TANNER) return state.players.filter((p) => p.role === 'tanner').map((p) => p.userId)
  return state.players.filter((p) => teamOf(p) === team).map((p) => p.userId)
}

const WIN_TEXT = {
  [TEAM.VILLAGE]: '🎉 Dân làng đã quét sạch mối nguy. Làng lại bình yên!',
  [TEAM.WOLF]: '🐺 Bầy sói áp đảo dân làng. Ngôi làng thuộc về sói!',
  [TEAM.KILLER]: '🔪 Kẻ sát nhân là người cuối cùng đứng vững.',
  [TEAM.TANNER]: '👺 Kẻ chán đời đã toại nguyện khi bị treo cổ — và thắng một mình!',
  [TEAM.LOVERS]: '💞 Chỉ còn đôi tình nhân sống sót. Tình yêu chiến thắng tất cả!',
  [TEAM.NONE]: '🪦 Không còn ai sống sót. Không có người thắng.',
}

const endGame = (state, team, now) => {
  state.status = STATUS.ENDED
  state.phase = null
  state.phaseEndsAt = null
  state.hunter = null
  state.endedAt = now
  const winners = winnersFor(state, team)
  state.result = { team, teamLabel: TEAM_LABEL[team], winners, rewards: {} }
  announce(state, WIN_TEXT[team] || WIN_TEXT[TEAM.NONE], now)
  announce(state, `📜 Vai của mọi người: ${state.players.map((p) => `${p.displayName} – ${roleLabel(p.role)}${p.originalRole !== p.role ? ` (vốn là ${ROLES[p.originalRole].name})` : ''}`).join('; ')}.`, now)
  return ['changed', 'ended']
}

// Kiểm tra thắng; nếu chưa ai thắng mà có thợ săn cần bắn thì mở pha thợ săn,
// ngược lại gọi next(). Trả về events.
const settleOrContinue = (state, ctx, now, rng, next) => {
  const winner = checkWinner(state, rng, now)
  if (winner) return endGame(state, winner.team, now)
  if (ctx.hunterShot) {
    const hunter = findPlayer(state, ctx.hunterShot)
    state.hunter = { userId: hunter.userId, resume: ctx.resume, remainingMs: ctx.remainingMs || 0 }
    hunter.revealed = true // nổ súng công khai thì ai cũng biết là thợ săn
    setPhase(state, PHASE.HUNTER, CONFIG.HUNTER_MS, now)
    announce(state, `🎯 Thợ săn ${hunter.displayName} gục xuống nhưng vẫn kịp giương súng… (${Math.round(CONFIG.HUNTER_MS / 1000)} giây)`, now)
    autoActBots(state, rng)
    return ['changed']
  }
  next()
  return ['changed']
}

// ── Đêm ────────────────────────────────────────────────────────────────

const startNight = (state, now, rng) => {
  state.day += 1
  state.actions = {}
  state.votes = {}
  state.ready = {}
  state.hunter = null
  // Đêm đầu dài hơn khi có Thần tình yêu để kịp se duyên
  const nightMs = needsCupid(state) && aliveWithRole(state, 'cupid') ? CONFIG.CUPID_NIGHT_MS : CONFIG.NIGHT_MS
  setPhase(state, PHASE.NIGHT, nightMs, now)

  state.players.filter((p) => p.alive && p.pendingBite).forEach((p) => {
    p.pendingBite = false
    if (isWolf(p)) return
    p.role = 'wolf'
    tell(state, p, '🌑 Vết cắn đêm trước bắt đầu phát tác… Bạn đã hoá thành Ma sói và giờ thuộc phe sói!', now)
    tellWolves(state, `⚡ ${p.displayName} đã hoá sói nhờ vết cắn của Sói đầu đàn và gia nhập bầy.`, now)
  })

  announce(state, `🌙 Đêm thứ ${state.day} buông xuống. Mọi người đi ngủ, những kẻ có việc thì thức dậy…`, now)
  autoActBots(state, rng)
}

const tallyTop = (counts, rng) => {
  const entries = Object.entries(counts).filter(([, value]) => value > 0)
  if (!entries.length) return null
  const max = Math.max(...entries.map(([, value]) => value))
  return pick(entries.filter(([, value]) => value === max).map(([key]) => key), rng)
}

const wolfTargets = (state, rng) => {
  const wolves = aliveWolves(state)
  const first = {}
  wolves.forEach((w) => {
    const target = state.actions[w.userId]?.targetId
    if (target) first[target] = (first[target] || 0) + 1
  })
  const target1 = tallyTop(first, rng)
  if (!state.flags.cubRage) return target1 ? [target1] : []
  const second = {}
  wolves.forEach((w) => {
    const chosen = state.actions[w.userId]
    const target = [chosen?.targetId2, chosen?.targetId].find((id) => id && id !== target1)
    if (target) second[target] = (second[target] || 0) + 1
  })
  const target2 = tallyTop(second, rng)
  return [target1, target2].filter(Boolean)
}


const resolveNight = (state, now, rng) => {
  const ctx = { deaths: [], resume: 'day' }
  const saved = new Set()

  // 1. Thần tình yêu (đêm đầu). Không chọn thì số phận tự se duyên ngẫu nhiên.
  const cupid = aliveWithRole(state, 'cupid')
  if (cupid && needsCupid(state)) {
    const chosen = state.actions[cupid.userId]
    let pair = [chosen?.targetId, chosen?.targetId2].map((id) => id && findPlayer(state, id)).filter((p) => p?.alive)
    if (pair.length !== 2 || pair[0] === pair[1]) pair = shuffle(alivePlayers(state), rng).slice(0, 2)
    if (pair.length === 2) {
      pair[0].loverId = pair[1].userId
      pair[1].loverId = pair[0].userId
      tell(state, cupid, `🏹 Mũi tên đã trúng: ${pair[0].displayName} và ${pair[1].displayName} giờ là một cặp.`, now)
      pair.forEach((lover, index) => {
        const partner = pair[1 - index]
        tell(state, lover, `💘 Thần tình yêu đã chọn bạn! Bạn đang yêu ${partner.displayName} (${roleLabel(partner.role)}). Người này chết thì bạn cũng chết theo.`, now)
      })
    }
  }

  const guardian = aliveWithRole(state, 'guardian')
  const guarded = guardian ? findPlayer(state, state.actions[guardian.userId]?.targetId) : null
  const serialKiller = aliveWithRole(state, 'serial_killer')
  const skTarget = serialKiller ? findPlayer(state, state.actions[serialKiller.userId]?.targetId) : null

  // 2. Bầy sói
  if (state.flags.wolvesDrunk) {
    state.flags.wolvesDrunk = false
    tellWolves(state, '🍻 Bầy sói vẫn còn say, cả đêm nằm ngủ vật vờ.', now)
  } else {
    const targets = wolfTargets(state, rng)
    if (state.flags.cubRage && targets.length) state.flags.cubRage = false
    for (const targetId of targets) {
      const wolves = aliveWolves(state)
      if (!wolves.length) break
      const target = findPlayer(state, targetId)
      if (!target?.alive || isWolf(target)) continue
      const visitor = pick(wolves, rng)
      ctx.by = null

      // Sói mò vào nhà kẻ sát nhân: thường là sói chết. Sát nhân ngồi không thì chắc chắn sói chết.
      if (target.role === 'serial_killer' && (!skTarget || rng() < CONFIG.SK_BEATS_WOLF_CHANCE)) {
        killPlayer(state, visitor, 'visit_killer', ctx)
        tellWolves(state, `🩸 ${visitor.displayName} đi săn đêm qua và không bao giờ trở về…`, now)
        continue
      }
      if (guarded && guarded.userId === target.userId) {
        saved.add(target.userId)
        tellWolves(state, `👼 Một thiên thần đã chắn trước cửa nhà ${target.displayName}. Bầy sói ra về tay trắng.`, now)
        continue
      }
      if (target.role === 'cursed') {
        target.role = 'wolf'
        tell(state, target, '😾 Sói tấn công bạn đêm qua… nhưng lời nguyền trỗi dậy. Bạn đã hoá thành Ma sói!', now)
        tellWolves(state, `😾 ${target.displayName} là Kẻ bị nguyền và đã hoá sói. Chào mừng thành viên mới!`, now)
        continue
      }
      if (target.role === 'hunter') {
        const chance = CONFIG.HUNTER_BASE_CHANCE + (wolves.length - 1) * CONFIG.HUNTER_PER_EXTRA_WOLF
        if (rng() < chance) {
          const shot = pick(wolves, rng)
          ctx.by = target.displayName
          killPlayer(state, shot, 'hunter_night', ctx)
          if (wolves.length > 1) killPlayer(state, target, 'eaten', ctx, { finalShot: false })
          else tell(state, target, `🎯 Sói mò tới nhà bạn và bạn đã bắn hạ ${shot.displayName}!`, now)
          continue
        }
      }
      const alpha = wolves.find((w) => w.role === 'alpha_wolf')
      if (alpha && rng() < CONFIG.ALPHA_BITE_CHANCE) {
        target.pendingBite = true
        tellWolves(state, `⚡ Sói đầu đàn đã cắn ${target.displayName}. Người này sẽ hoá sói vào đêm mai.`, now)
        continue
      }
      killPlayer(state, target, 'eaten', ctx, { finalShot: false })
      if (target.role === 'drunk') {
        state.flags.wolvesDrunk = true
        tellWolves(state, `🍻 ${target.displayName} là bợm nhậu! Bầy sói say mèm và phải nghỉ săn đêm mai.`, now)
      }
    }
  }

  // 3. Kẻ sát nhân (đã chết dưới tay sói thì không ra tay được nữa)
  if (serialKiller?.alive && skTarget?.alive) {
    if (guarded && guarded.userId === skTarget.userId) {
      saved.add(skTarget.userId)
      tell(state, serialKiller, `👼 Có ai đó đứng canh nhà ${skTarget.displayName}. Bạn đành bỏ đi.`, now)
    } else {
      ctx.by = null
      killPlayer(state, skTarget, 'stabbed', ctx)
    }
  }

  // 4. Số phận thiên thần: canh nhà sát nhân thì chết, canh nhà sói (không bị ai tấn công) thì 50%
  if (guardian?.alive && guarded) {
    if (guarded.role === 'serial_killer') {
      killPlayer(state, guardian, 'visit_killer', ctx)
    } else if (isWolf(guarded) && !saved.has(guarded.userId) && rng() < CONFIG.GUARD_WOLF_DEATH_CHANCE) {
      killPlayer(state, guardian, 'guard_wolf', ctx)
    } else if (saved.has(guarded.userId)) {
      tell(state, guardian, `👼 Đêm qua có kẻ tấn công ${guarded.displayName}, nhưng bạn đã bảo vệ thành công!`, now)
    }
  }

  // 5. Tiên tri nhận kết quả nếu còn sống tới sáng
  const seer = aliveWithRole(state, 'seer')
  const seen = seer ? findPlayer(state, state.actions[seer.userId]?.targetId) : null
  if (seer && seen) tell(state, seer, `🔮 Quả cầu pha lê cho thấy: ${seen.displayName} là ${roleLabel(seen.role)}.`, now)

  state.phase = PHASE.DAY
  if (!ctx.deaths.length) announce(state, '☀️ Trời sáng. Một đêm yên bình — không ai chết.', now)
  else {
    announce(state, `☀️ Trời sáng. Đêm qua có ${ctx.deaths.length} người không qua khỏi…`, now)
    announceDeaths(state, ctx.deaths, now)
  }
  return settleOrContinue(state, ctx, now, rng, () => startDay(state, now, rng))
}

// ── Ngày & bỏ phiếu ────────────────────────────────────────────────────

const startDay = (state, now, rng, durationMs = CONFIG.DAY_MS) => {
  state.actions = {}
  state.votes = {}
  state.ready = {}
  setPhase(state, PHASE.DAY, durationMs, now)
  if (durationMs === CONFIG.DAY_MS) {
    announce(state, `🗣️ Ngày thứ ${state.day}: cả làng tụ họp bàn xem ai là sói. Bấm "Sẵn sàng" nếu muốn bỏ phiếu sớm.`, now)
  }
  autoActBots(state, rng)
}

const startVote = (state, now, rng) => {
  state.votes = {}
  setPhase(state, PHASE.VOTE, CONFIG.VOTE_MS, now)
  announce(state, '🗳️ Đến giờ bỏ phiếu! Chọn người bạn muốn treo cổ, hoặc bỏ qua.', now)
  autoActBots(state, rng)
}

const resolveVote = (state, now, rng) => {
  const counts = {}
  alivePlayers(state).forEach((p) => {
    const vote = state.votes[p.userId]
    if (vote) counts[vote] = (counts[vote] || 0) + 1
  })
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  const summary = entries
    .map(([id, value]) => `${id === SKIP ? 'Bỏ qua' : findPlayer(state, id)?.displayName} (${value})`)
    .join(', ')
  if (summary) announce(state, `📊 Kết quả phiếu: ${summary}.`, now)

  const top = entries[0]
  const tied = entries.length > 1 && entries[1][1] === top[1]
  if (!top || tied || top[0] === SKIP) {
    announce(state, tied ? '🤷 Số phiếu hoà nhau. Hôm nay không ai bị treo cổ.' : '🤷 Dân làng quyết định không treo cổ ai hôm nay.', now)
    startNight(state, now, rng)
    return ['changed']
  }

  const target = findPlayer(state, top[0])
  const ctx = { deaths: [], resume: 'night', by: null }
  killPlayer(state, target, 'lynched', ctx)
  announceDeaths(state, ctx.deaths, now)
  if (target.role === 'tanner') return endGame(state, TEAM.TANNER, now)
  return settleOrContinue(state, ctx, now, rng, () => startNight(state, now, rng))
}

const resumeAfterHunter = (state, info, now, rng) => {
  state.hunter = null
  if (info?.resume === 'night') return startNight(state, now, rng)
  if (info?.resume === 'day_continue') return startDay(state, now, rng, Math.max(15_000, info.remainingMs || 0))
  return startDay(state, now, rng)
}

// ── Hành động của người chơi ───────────────────────────────────────────

const submitAction = (state, userId, payload = {}, now, rng) => {
  if (state.status !== STATUS.PLAYING) return fail('NOT_PLAYING', 'Ván chưa bắt đầu')
  const player = findPlayer(state, userId)
  if (!player) return fail('NOT_PLAYER', 'Bạn không tham gia ván này')
  const action = availableAction(state, player)
  if (!action || action.kind === 'none') return fail('NO_ACTION', 'Bạn không có lượt lúc này')
  if (payload.kind && payload.kind !== action.kind) return fail('STALE_ACTION', 'Pha đã đổi, hãy thử lại')

  const targetId = payload.targetId ? idOf(payload.targetId) : null
  const targetId2 = payload.targetId2 ? idOf(payload.targetId2) : null

  if (action.kind === 'vote') {
    if (targetId !== SKIP && !action.targets.includes(targetId)) return fail('BAD_TARGET', 'Không thể bầu người này')
    state.votes[player.userId] = targetId
    return ok()
  }
  if (!targetId || !action.targets.includes(targetId)) return fail('BAD_TARGET', 'Mục tiêu không hợp lệ')

  if (action.kind === 'gunner_shot') {
    const target = findPlayer(state, targetId)
    player.bullets -= 1
    player.revealed = true
    state.flags.gunnerShotDay = state.day
    const ctx = { deaths: [], by: player.displayName, resume: 'day_continue', remainingMs: Math.max(0, state.phaseEndsAt - now) }
    killPlayer(state, target, 'gunner', ctx)
    announceDeaths(state, ctx.deaths, now)
    return { ok: true, events: settleOrContinue(state, ctx, now, rng, () => {}) }
  }

  if (action.kind === 'hunter_shot') {
    const target = findPlayer(state, targetId)
    const info = state.hunter
    const ctx = { deaths: [], by: player.displayName, resume: info.resume, remainingMs: info.remainingMs }
    killPlayer(state, target, 'hunter_shot', ctx)
    announceDeaths(state, ctx.deaths, now)
    state.hunter = null
    return { ok: true, events: settleOrContinue(state, ctx, now, rng, () => resumeAfterHunter(state, info, now, rng)) }
  }

  if (action.needsTwo) {
    if (!targetId2 || targetId2 === targetId || !action.targets.includes(targetId2)) {
      return fail('NEED_TWO', 'Hãy chọn hai người khác nhau')
    }
  }
  state.actions[player.userId] = { targetId, targetId2: action.needsTwo ? targetId2 : null }
  return ok()
}

const setReady = (state, userId, ready = true) => {
  if (state.status !== STATUS.PLAYING || state.phase !== PHASE.DAY) return fail('NOT_DAY', 'Chỉ dùng được vào ban ngày')
  const player = findPlayer(state, userId)
  if (!player?.alive) return fail('NOT_ALIVE', 'Người đã khuất không bỏ phiếu')
  if (ready) state.ready[player.userId] = true
  else delete state.ready[player.userId]
  return ok()
}

const CHAT_DENIED = {
  night: 'Ban đêm dân làng phải ngủ — chỉ bầy sói được thì thầm',
  spectator: 'Bạn đang xem, không tham gia ván này',
}

const chat = (state, userId, text, now) => {
  const content = String(text || '').replace(/\s+/g, ' ').trim().slice(0, CONFIG.CHAT_MAX)
  if (!content) return fail('EMPTY', 'Tin nhắn trống')
  const player = findPlayer(state, userId)
  if (!player) return fail('SPECTATOR', CHAT_DENIED.spectator)
  const last = state.lastChatAt[player.userId] || 0
  if (now - last < CONFIG.CHAT_COOLDOWN_MS) return fail('TOO_FAST', 'Gõ chậm thôi nào')

  let channel = 'public'
  if (state.status === STATUS.PLAYING) {
    if (!player.alive) channel = 'dead'
    else if (state.phase === PHASE.NIGHT) {
      if (!isWolf(player)) return fail('NIGHT_SILENT', CHAT_DENIED.night)
      channel = 'wolves'
    }
  }
  state.lastChatAt[player.userId] = now
  pushLog(state, {
    kind: 'chat',
    channel,
    text: content,
    author: { userId: player.userId, displayName: player.displayName, avatarId: player.avatarId, color: player.color },
  }, now)
  return ok({ channel })
}

// ── Bot (chỉ để admin test / bù người) ─────────────────────────────────

const autoActBots = (state, rng) => {
  state.players.filter((p) => p.isBot).forEach((bot) => {
    if (state.phase === PHASE.DAY && bot.alive) state.ready[bot.userId] = true
    const action = availableAction(state, bot)
    if (!action?.targets?.length) return
    if (action.kind === 'vote') {
      state.votes[bot.userId] = rng() < 0.15 ? SKIP : pick(action.targets, rng)
      return
    }
    if (action.kind === 'gunner_shot') return
    if (action.kind === 'hunter_shot') {
      state.hunter.botTarget = pick(action.targets, rng)
      return
    }
    // Sói bot đi theo lựa chọn của đồng bọn nếu đã có
    const packChoice = action.kind === 'wolf_kill'
      ? aliveWolves(state).map((w) => state.actions[w.userId]?.targetId).find(Boolean)
      : null
    const targetId = packChoice || pick(action.targets, rng)
    const rest = action.targets.filter((id) => id !== targetId)
    state.actions[bot.userId] = { targetId, targetId2: action.needsTwo && rest.length ? pick(rest, rng) : null }
  })
}

// ── Nhịp đồng hồ ───────────────────────────────────────────────────────

const EARLY_MIN_MS = 5_000

const allVoted = (state) => alivePlayers(state).every((p) => state.votes[p.userId])
const allReady = (state) => alivePlayers(state).every((p) => state.ready[p.userId])

const shouldAutoStart = (state, now) =>
  state.status === STATUS.LOBBY && Boolean(state.autoStartAt) && now >= state.autoStartAt && state.players.length >= CONFIG.MIN_PLAYERS

const tick = (state, now, rng) => {
  if (state.status === STATUS.ENDED) {
    if (now - state.endedAt >= CONFIG.ENDED_RESET_MS) {
      resetToLobby(state)
      return { events: ['changed'] }
    }
    return { events: [] }
  }
  if (state.status !== STATUS.PLAYING) return { events: [] }

  const timeUp = now >= state.phaseEndsAt
  const early = now - state.phaseStartedAt >= EARLY_MIN_MS

  switch (state.phase) {
    case PHASE.NIGHT:
      if (timeUp || (early && allNightActionsDone(state))) return { events: resolveNight(state, now, rng) }
      break
    case PHASE.DAY:
      if (timeUp || (early && allReady(state))) {
        startVote(state, now, rng)
        return { events: ['changed'] }
      }
      break
    case PHASE.VOTE:
      if (timeUp || (early && allVoted(state))) return { events: resolveVote(state, now, rng) }
      break
    case PHASE.HUNTER: {
      const botTarget = state.hunter?.botTarget
      if (botTarget && early) {
        const result = submitAction(state, state.hunter.userId, { targetId: botTarget }, now, rng)
        return { events: result.events }
      }
      if (timeUp) {
        const hunter = findPlayer(state, state.hunter?.userId)
        announce(state, `🎯 Thợ săn ${hunter?.displayName || ''} không kịp bóp cò.`, now)
        resumeAfterHunter(state, state.hunter, now, rng)
        return { events: ['changed'] }
      }
      break
    }
    default:
      break
  }
  return { events: [] }
}

// ── Serialize theo góc nhìn từng người (không bao giờ lộ vai/hành động của người khác) ──

const logVisibleTo = (state, viewer) => {
  if (state.status === STATUS.ENDED) return () => true
  const viewerIsWolf = isWolf(viewer)
  return (entry) => {
    switch (entry.channel) {
      case 'public': return true
      case 'wolves': return viewerIsWolf
      case 'dead': return Boolean(viewer && !viewer.alive)
      case 'private': return Boolean(viewer && entry.to?.includes(viewer.userId))
      default: return false
    }
  }
}

const serializeFor = (state, viewerId, now) => {
  const viewer = viewerId ? findPlayer(state, viewerId) : null
  const ended = state.status === STATUS.ENDED
  const viewerIsWolf = isWolf(viewer)
  const viewerIsCupid = viewer?.originalRole === 'cupid'

  const roleVisible = (p) =>
    ended || (!p.alive && state.revealRoleOnDeath) || p.revealed || viewer?.userId === p.userId || (viewerIsWolf && isWolf(p))
  const loverVisible = (p) =>
    Boolean(p.loverId) && (ended || viewerIsCupid || viewer?.userId === p.userId || viewer?.userId === p.loverId)

  const players = state.players.map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    avatarId: p.avatarId,
    color: p.color,
    isBot: p.isBot,
    isHost: p.userId === state.hostId,
    alive: p.alive,
    death: p.death && { ...p.death, cause: roleVisible(p) ? p.death.cause : publicCauseOf(p.death.cause) },
    role: roleVisible(p) ? p.role : null,
    originalRole: ended ? p.originalRole : null,
    lover: loverVisible(p),
    revealed: p.revealed,
    vote: state.phase === PHASE.VOTE ? state.votes[p.userId] || null : null,
    ready: state.phase === PHASE.DAY ? Boolean(state.ready[p.userId]) : false,
    winner: ended ? state.result.winners.includes(p.userId) : false,
  }))

  let me = null
  if (viewer) {
    const action = availableAction(state, viewer)
    me = {
      userId: viewer.userId,
      role: viewer.role,
      team: viewer.role ? teamOf(viewer) : null,
      alive: viewer.alive,
      loverId: viewer.loverId,
      bullets: viewer.bullets,
      action: action ? { ...action } : null,
      choice: state.actions[viewer.userId] || null,
      vote: state.votes[viewer.userId] || null,
      ready: Boolean(state.ready[viewer.userId]),
      wolfVotes: viewerIsWolf && state.phase === PHASE.NIGHT
        ? aliveWolves(state).map((w) => ({ userId: w.userId, ...(state.actions[w.userId] || {}) }))
        : null,
      reward: ended ? state.result.rewards?.[viewer.userId] || 0 : 0,
    }
  }

  const visible = logVisibleTo(state, viewer)
  return {
    status: state.status,
    gameId: state.gameId,
    phase: state.phase,
    day: state.day,
    phaseStartedAt: state.phaseStartedAt,
    phaseEndsAt: state.phaseEndsAt,
    autoStartAt: state.autoStartAt,
    hostId: state.hostId,
    hunterId: state.phase === PHASE.HUNTER ? state.hunter?.userId || null : null,
    serverNow: now,
    config: { ...publicConfig(), revealRoleOnDeath: state.status === STATUS.LOBBY ? CONFIG.REVEAL_ROLE_ON_DEATH : state.revealRoleOnDeath },
    hasBots: hasBots(state),
    players,
    me,
    result: ended ? { team: state.result.team, teamLabel: state.result.teamLabel, winners: state.result.winners } : null,
    log: state.log.filter(visible).slice(-250),
  }
}

const publicConfig = () => ({
  minPlayers: CONFIG.MIN_PLAYERS,
  maxPlayers: CONFIG.MAX_PLAYERS,
  nightMs: CONFIG.NIGHT_MS,
  cupidNightMs: CONFIG.CUPID_NIGHT_MS,
  dayMs: CONFIG.DAY_MS,
  voteMs: CONFIG.VOTE_MS,
  hunterMs: CONFIG.HUNTER_MS,
  autoStartMs: CONFIG.AUTOSTART_MS,
  endedResetMs: CONFIG.ENDED_RESET_MS,
  revealRoleOnDeath: CONFIG.REVEAL_ROLE_ON_DEATH,
  winReward: CONFIG.WIN_REWARD,
})

module.exports = {
  CONFIG,
  TIMING_FIELDS,
  OPTION_FIELDS,
  getTimings,
  getOptions,
  applySettings,
  STATUS,
  PHASE,
  SKIP,
  idOf,
  createInitialState,
  createPlayer,
  buildRoles,
  isBalanced,
  joinLobby,
  leaveLobby,
  fillBots,
  hasBots,
  startGame,
  shouldAutoStart,
  availableAction,
  submitAction,
  setReady,
  chat,
  tick,
  checkWinner,
  resolveNight,
  resolveVote,
  serializeFor,
  publicConfig,
  findPlayer,
  resetToLobby,
}
