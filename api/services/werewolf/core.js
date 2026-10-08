// Phần lõi dùng chung của engine Ma Sói: cấu hình, state, log, chết & đổi vai.
const {
  TEAM,
  ROLES,
  isPackRole,
  isWolfishRole,
  teamOfRole,
  roleLabel,
} = require('./roles')

// Mặc định là hằng số; admin chỉnh các mốc thời gian lúc chạy qua applySettings
// (service lưu vào Mongo và nạp lại khi khởi động).
const CONFIG = {
  MIN_PLAYERS: 5,
  MAX_PLAYERS: 16,
  NIGHT_MS: 20_000,
  CUPID_NIGHT_MS: 30_000,
  SLEEP_NIGHT_MS: 6_000,
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
  SNOW_FREEZES_HUNTER_CHANCE: 0.5,
  DETECTIVE_CAUGHT_CHANCE: 0.4,
  TRAITOR_SEEN_AS_WOLF_CHANCE: 0.5,
  HARLOT_SPOTS_CULT_CHANCE: 0.5,
  HUNTER_CULT_CONVERT_CHANCE: 0.5,
  GUNNER_BULLETS: 2,
  CHAT_MAX: 240,
  CHAT_COOLDOWN_MS: 600,
  LOG_LIMIT: 600,
}

// Tỉ lệ tà giáo chiêu mộ thành công theo vai; vai không có trong bảng = 100%.
const CULT_CONVERSION_CHANCE = {
  seer: 0.4,
  guardian: 0.6,
  detective: 0.7,
  cursed: 0.6,
  harlot: 0.7,
  sorcerer: 0.4,
  blacksmith: 0.75,
  oracle: 0.5,
  sandman: 0.6,
  wise_elder: 0.3,
  augur: 0.4,
  doppelganger: 0,
  thief: 0,
  arsonist: 0,
}

// Các mốc thời gian admin được chỉnh, kèm giới hạn (ms) để không ai đặt 0 giây hay 3 tiếng.
const TIMING_FIELDS = [
  { key: 'nightMs', configKey: 'NIGHT_MS', label: 'Ban đêm', min: 15_000, max: 300_000 },
  { key: 'cupidNightMs', configKey: 'CUPID_NIGHT_MS', label: 'Đêm đầu có vai chọn người (Thần tình yêu, Đứa trẻ hoang, Kẻ bắt chước, Kẻ trộm)', min: 15_000, max: 300_000 },
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
const applySettings = (input = {}) => {
  const next = {}
  for (const field of TIMING_FIELDS) {
    if (input[field.key] === undefined || input[field.key] === null) {
      next[field.configKey] = field.defaultMs
      continue
    }
    const value = Math.round(Number(input[field.key]))
    if (!Number.isFinite(value) || value < field.min || value > field.max) {
      return { ok: false, message: `${field.label} phải từ ${field.min / 1000} đến ${field.max / 1000} giây` }
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
const SPARK = 'spark'

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
  flags: {
    wolvesDrunk: false,
    cubRage: false,
    gunnerShotDay: null,
    silverDay: null, // ngày Thợ rèn rải bạc → có hiệu lực đêm kế tiếp
    sleepNext: false, // Thần ngủ đã ru → đêm kế tiếp cả làng ngủ
  },
  silverNight: false,
  sleeping: false,
  augurPool: [],
  augurSeen: [],
  cultSeq: 0,
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
  hasUsedAbility: false, // Hoàng tử / Già làng / Trưởng làng / Thợ rèn / Thần ngủ đã dùng
  modelId: null, // hình mẫu của Đứa trẻ hoang / Kẻ bắt chước
  frozenDay: null, // bị Sói tuyết đóng băng vào đêm nào
  doused: false,
  cultJoinedAt: null,
  stole: false,
})

const findPlayer = (state, userId) => state.players.find((p) => p.userId === idOf(userId))
const alivePlayers = (state) => state.players.filter((p) => p.alive)
const teamOf = (player) => teamOfRole(player.role)
const isPack = (player) => Boolean(player && isPackRole(player.role))
const isWolfish = (player) => Boolean(player && isWolfishRole(player.role))
const isCultist = (player) => player?.role === 'cultist'
const alivePack = (state) => alivePlayers(state).filter(isPack)
const aliveWolfish = (state) => alivePlayers(state).filter(isWolfish)
const aliveCult = (state) => alivePlayers(state).filter(isCultist)
const aliveWithRole = (state, role) => alivePlayers(state).find((p) => p.role === role) || null

// ── Log ────────────────────────────────────────────────────────────────

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
const tellCult = (state, text, now) => pushLog(state, { channel: 'cult', text }, now)
const announce = (state, text, now) => pushLog(state, { channel: 'public', text }, now)

// Kẻ khờ luôn tưởng mình là Tiên tri cho tới khi chết hoặc hết ván
const shownRoleFor = (state, player) =>
  player.role === 'fool' && player.alive && state.status === STATUS.PLAYING ? 'seer' : player.role

const names = (players) => players.map((p) => p.displayName).join(', ')

// ── Đổi vai ────────────────────────────────────────────────────────────

// Đổi vai một người và báo cho các bên liên quan (bầy sói, giáo phái, hội kín, người quan sát).
const transform = (state, player, role, now, { silent = false } = {}) => {
  if (!player || player.role === role) return
  const from = player.role
  player.role = role
  if (role === 'gunner' && !player.bullets) player.bullets = CONFIG.GUNNER_BULLETS
  if (role === 'cultist' && !player.cultJoinedAt) {
    state.cultSeq += 1
    player.cultJoinedAt = state.cultSeq
  }
  if (silent) return

  if (from === 'mason') {
    const masons = alivePlayers(state).filter((p) => p.role === 'mason' && p !== player)
    tell(state, masons, `👷 ${player.displayName} không còn là người của Hội kín nữa.`, now)
  }
  if (isWolfishRole(role) && !isWolfishRole(from)) {
    const pack = aliveWolfish(state).filter((p) => p !== player)
    tellWolves(state, `🐺 ${player.displayName} đã gia nhập bầy (${ROLES[role].name}).`, now)
    if (pack.length) tell(state, player, `🐺 Đồng bọn của bạn: ${names(pack)}.`, now)
  }
  if (role === 'cultist' && from !== 'cultist') {
    const cult = aliveCult(state).filter((p) => p !== player)
    tellCult(state, `👤 ${player.displayName} đã theo giáo phái.`, now)
    if (cult.length) tell(state, player, `👤 Các tín đồ khác: ${names(cult)}.`, now)
  }
  if (role === 'mason') {
    const masons = alivePlayers(state).filter((p) => p.role === 'mason' && p !== player)
    if (masons.length) {
      tell(state, player, `👷 Hội kín của bạn: ${names(masons)}.`, now)
      tell(state, masons, `👷 ${player.displayName} vừa gia nhập Hội kín.`, now)
    }
  }
  if (role === 'seer') {
    const beholder = aliveWithRole(state, 'beholder')
    if (beholder && beholder !== player) tell(state, beholder, `👁️ Làng có Tiên tri mới: ${player.displayName}.`, now)
  }
}

// Chuỗi đổi vai tự động: Tiên tri tập sự lên thay, Đứa trẻ hoang hoá sói,
// Kẻ bắt chước nhận vai hình mẫu. Trả true nếu có ai đổi vai.
const roleChangesOnce = (state, now) => {
  let changed = false
  const apprentice = aliveWithRole(state, 'apprentice_seer')
  if (apprentice && !aliveWithRole(state, 'seer')) {
    transform(state, apprentice, 'seer', now)
    tell(state, apprentice, '🙇 Tiên tri không còn nữa. Từ đêm nay bạn là Tiên tri của làng!', now)
    changed = true
  }
  alivePlayers(state).filter((p) => p.role === 'wild_child' && p.modelId).forEach((child) => {
    const model = findPlayer(state, child.modelId)
    if (!model || model.alive) return
    transform(state, child, 'wolf', now)
    tell(state, child, `👶 Hình mẫu ${model.displayName} đã chết. Bạn trở về với bản năng hoang dã — giờ bạn là Ma sói!`, now)
    changed = true
  })
  alivePlayers(state).filter((p) => p.role === 'doppelganger' && p.modelId).forEach((copycat) => {
    const model = findPlayer(state, copycat.modelId)
    if (!model || model.alive) return
    // Nhận vai hiện tại của hình mẫu, kỹ năng làm mới; Kẻ trộm (đã dùng) thì thành dân
    const role = model.role === 'thief' ? 'villager' : model.role
    copycat.hasUsedAbility = false
    copycat.modelId = role === 'wild_child' || role === 'doppelganger' ? model.modelId : null
    copycat.bullets = role === 'gunner' ? CONFIG.GUNNER_BULLETS : 0
    transform(state, copycat, role, now)
    tell(state, copycat, `🎭 ${model.displayName} đã chết. Bạn hoá thân thành ${roleLabel(role)}. ${ROLES[role].summary}`, now)
    changed = true
  })
  return changed
}

// Lặp tới khi ổn định (Kẻ bắt chước có thể nhận vai Đứa trẻ hoang rồi hoá sói ngay…)
const roleChanges = (state, now) => {
  for (let i = 0; i < 6 && roleChangesOnce(state, now); i += 1);
}

// ── Chết ───────────────────────────────────────────────────────────────

// Giết một người và kéo theo hệ quả (người yêu, sói con, phát súng thợ săn).
// finalShot=false khi thợ săn bị sói ăn hoặc bị thiêu — những trường hợp đó không bắn trả.
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
  visit_wolf: (name) => `🐺 ${name} gõ nhầm cửa hang sói đêm qua.`,
  harlot_victim: (name) => `💋 ${name} ngủ nhờ đúng căn nhà có án mạng đêm qua.`,
  hunted: (name) => `💂 ${name} bị Thợ săn tà giáo hạ gục.`,
  visit_burning: (name) => `🔥 ${name} ghé vào một căn nhà đang cháy và không thoát ra được.`,
  burned: (name) => `🔥 Nhà ${name} bốc cháy dữ dội trong đêm, không ai kịp cứu.`,
  heartbreak: (name) => `💔 Không chịu nổi mất mát, ${name} đã đi theo người mình yêu.`,
  lynched: (name) => `⚖️ Dân làng đã treo cổ ${name}.`,
  gunner: (name, by) => `🔫 ĐOÀNG! ${by} rút súng bắn gục ${name}.`,
  hunter_shot: (name, by) => `🎯 Trước khi gục xuống, thợ săn ${by} kịp kéo ${name} theo cùng.`,
}

// Nguyên nhân chết ban đêm tự nó lộ vai (canh nhầm nhà sói → thiên thần + sói,
// bị thợ săn tà giáo hạ → tín đồ…). Khi giấu vai, chúng được báo chung một câu.
const HIDDEN_NIGHT_CAUSES = ['eaten', 'stabbed', 'visit_killer', 'guard_wolf', 'hunter_night', 'visit_wolf', 'harlot_victim', 'hunted', 'visit_burning']
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

// Già làng chết dưới tay Xạ thủ/Thợ săn → người đó ân hận mà mất năng lực
const punishElderKiller = (state, victim, killer, now) => {
  if (victim?.role !== 'wise_elder' || !killer) return
  killer.bullets = 0
  transform(state, killer, 'villager', now, { silent: true })
  announce(state, `📚 Giết nhầm Già làng, ${killer.displayName} ân hận tột cùng và từ bỏ vũ khí — giờ chỉ còn là dân làng.`, now)
}

module.exports = {
  CONFIG,
  CULT_CONVERSION_CHANCE,
  TIMING_FIELDS,
  OPTION_FIELDS,
  getTimings,
  getOptions,
  applySettings,
  STATUS,
  PHASE,
  SKIP,
  SPARK,
  TEAM,
  idOf,
  ok,
  fail,
  pick,
  shuffle,
  createInitialState,
  createPlayer,
  findPlayer,
  alivePlayers,
  teamOf,
  isPack,
  isWolfish,
  isCultist,
  alivePack,
  aliveWolfish,
  aliveCult,
  aliveWithRole,
  pushLog,
  tell,
  tellWolves,
  tellCult,
  announce,
  shownRoleFor,
  names,
  transform,
  roleChanges,
  killPlayer,
  DEATH_TEXT,
  HIDDEN_NIGHT_CAUSES,
  publicCauseOf,
  announceDeaths,
  punishElderKiller,
}
