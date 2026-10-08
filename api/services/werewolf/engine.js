// Engine Ma Sói thuần (không I/O): mọi hàm nhận state + now + rng và trả về
// events để service quyết định broadcast/persist. Luật tham khảo GreyWolfDev/Werewolf,
// phần cài đặt viết mới cho 36 vai. Đêm nằm ở night.js, phần dùng chung ở core.js.
const { TEAM, TEAM_LABEL, ROLES, isWolfishRole, roleLabel } = require('./roles')
const { buildRoles, isBalanced } = require('./balance')
const { resolveNightEffects } = require('./night')
const core = require('./core')

const {
  CONFIG,
  TIMING_FIELDS,
  OPTION_FIELDS,
  getTimings,
  getOptions,
  applySettings,
  STATUS,
  PHASE,
  SKIP,
  SPARK,
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
  publicCauseOf,
  announceDeaths,
  punishElderKiller,
} = core

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

const BOT_NAMES = ['Bác Ba', 'Cô Tư', 'Chú Năm', 'Anh Sáu', 'Chị Bảy', 'Ông Tám', 'Bà Chín', 'Út Mười', 'Cậu Tý', 'Mợ Sửu', 'Thím Dần', 'Dì Mão', 'Cụ Thìn', 'Chú Tỵ', 'Cô Ngọ']

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

const introduce = (state, now) => {
  state.players.forEach((player) => {
    const role = shownRoleFor(state, player)
    tell(state, player, `Bạn là ${roleLabel(role)}. ${ROLES[role].summary}`, now)
  })
  const wolfish = aliveWolfish(state)
  if (wolfish.length > 1) tellWolves(state, `🐺 Bầy sói đêm nay: ${wolfish.map((w) => `${w.displayName} (${ROLES[w.role].name})`).join(', ')}.`, now)
  const masons = state.players.filter((p) => p.role === 'mason')
  masons.forEach((m) => tell(state, m, `👷 Hội kín gồm: ${names(masons.filter((x) => x !== m))}.`, now))
  const cult = state.players.filter(isCultist)
  if (cult.length) tellCult(state, `👤 Giáo phái khởi đầu với: ${names(cult)}.`, now)
  const beholder = state.players.find((p) => p.role === 'beholder')
  if (beholder) {
    const seer = state.players.find((p) => p.role === 'seer')
    tell(state, beholder, seer ? `👁️ Tiên tri của làng là ${seer.displayName}.` : '👁️ Làng này không có Tiên tri.', now)
  }
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
    if (player.role === 'cultist') {
      state.cultSeq += 1
      player.cultJoinedAt = state.cultSeq
    }
  })
  state.status = STATUS.PLAYING
  state.gameId = gameId ? idOf(gameId) : `ww-${now}`
  state.startedAt = now
  // Chốt luật cho cả ván: admin đổi công tắc giữa chừng không lật vai người đã chết
  state.revealRoleOnDeath = CONFIG.REVEAL_ROLE_ON_DEATH
  state.autoStartAt = null
  state.day = 0
  state.augurPool = shuffle(Object.keys(ROLES), rng)

  announce(state, `🌕 Ván Ma Sói bắt đầu với ${state.players.length} người. Mỗi người đã nhận vai bí mật của mình.`, now)
  introduce(state, now)
  startNight(state, now, rng)
  return ok({ events: ['changed', 'started'] })
}

// ── Hành động khả dụng ─────────────────────────────────────────────────

const targetsExcept = (state, player, predicate = () => true) =>
  alivePlayers(state).filter((p) => p.userId !== player.userId && predicate(p)).map((p) => p.userId)

const needsCupid = (state) => state.day === 1 && !state.players.some((p) => p.loverId)
const hasFirstNightChoice = (state) => state.day === 1 && alivePlayers(state).some((p) =>
  (p.role === 'cupid' && needsCupid(state)) || (['wild_child', 'doppelganger'].includes(p.role) && !p.modelId) || (p.role === 'thief' && !p.stole))

const NIGHT_KINDS = ['wolf_kill', 'freeze', 'see', 'guard', 'stab', 'pair', 'model', 'steal', 'hunt', 'convert', 'arson', 'visit']

// Lượt chính của một người chơi trong pha hiện tại, dùng cho cả server lẫn UI.
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
    if (state.sleeping) return { kind: 'none', label: '💤 Thần ngủ đã ru cả làng — đêm nay không ai làm được gì' }
    if (isPack(player)) {
      if (state.silverNight) return { kind: 'none', label: '⚒️ Bột bạc khắp làng, bầy sói không dám ra tay đêm nay' }
      if (state.flags.wolvesDrunk) return { kind: 'none', label: '🍻 Bầy sói say mèm, đêm nay không đi săn được' }
      const targets = targetsExcept(state, player, (p) => !isWolfish(p))
      const needsTwo = state.flags.cubRage && targets.length >= 2
      return {
        kind: 'wolf_kill',
        label: needsTwo ? 'Sói con đã chết — chọn HAI người để ăn thịt' : 'Chọn người để bầy sói ăn thịt',
        targets,
        needsTwo,
      }
    }
    switch (player.role) {
      case 'snow_wolf':
        if (state.silverNight) return { kind: 'none', label: '⚒️ Bột bạc khắp làng, bạn không dám ra tay đêm nay' }
        return { kind: 'freeze', label: 'Chọn người để đóng băng', targets: targetsExcept(state, player, (p) => !isWolfish(p) && p.frozenDay !== state.day - 1) }
      case 'seer':
      case 'fool':
        return { kind: 'see', label: 'Chọn người để soi vai', targets: targetsExcept(state, player) }
      case 'sorcerer':
        return { kind: 'see', label: 'Chọn người để dò xem là sói hay Tiên tri', targets: targetsExcept(state, player) }
      case 'oracle':
        return { kind: 'see', label: 'Chọn người để biết một vai họ KHÔNG phải', targets: targetsExcept(state, player) }
      case 'guardian':
        return { kind: 'guard', label: 'Chọn người để bảo vệ đêm nay', targets: targetsExcept(state, player) }
      case 'harlot':
        return { kind: 'visit', label: 'Chọn nhà để ngủ nhờ (hoặc ở nhà)', targets: targetsExcept(state, player), allowSkip: true, skipLabel: '🏠 Ở nhà đêm nay' }
      case 'serial_killer':
        return { kind: 'stab', label: 'Chọn người để ra tay', targets: targetsExcept(state, player) }
      case 'cult_hunter':
        return { kind: 'hunt', label: 'Chọn người để truy lùng tín đồ tà giáo', targets: targetsExcept(state, player) }
      case 'cultist':
        return { kind: 'convert', label: 'Chọn người để giáo phái chiêu mộ', targets: targetsExcept(state, player, (p) => !isCultist(p)) }
      case 'arsonist': {
        const hasDoused = alivePlayers(state).some((p) => p.doused)
        return {
          kind: 'arson',
          label: hasDoused ? 'Tưới xăng thêm một nhà, hoặc châm lửa' : 'Chọn nhà để tưới xăng',
          targets: targetsExcept(state, player, (p) => !p.doused),
          extra: hasDoused ? { targetId: SPARK, label: '🔥 Châm lửa đốt mọi nhà đã tưới' } : null,
        }
      }
      case 'cupid':
        if (!needsCupid(state)) return null
        return { kind: 'pair', label: 'Chọn hai người để se duyên (có thể gồm bạn)', targets: alivePlayers(state).map((p) => p.userId), needsTwo: true }
      case 'wild_child':
      case 'doppelganger':
        if (player.modelId) return null
        return { kind: 'model', label: 'Chọn một người làm hình mẫu', targets: targetsExcept(state, player) }
      case 'thief':
        if (player.stole) return null
        return { kind: 'steal', label: 'Chọn người để trộm vai', targets: targetsExcept(state, player) }
      default:
        return null
    }
  }

  if (state.phase === PHASE.DAY) {
    if (player.role === 'gunner' && player.bullets > 0 && state.flags.gunnerShotDay !== state.day) {
      return { kind: 'gunner_shot', label: `Nổ súng (còn ${player.bullets} viên)`, targets: targetsExcept(state, player) }
    }
    if (player.role === 'detective') {
      return { kind: 'investigate', label: 'Chọn người để điều tra (có kết quả cuối ngày)', targets: targetsExcept(state, player) }
    }
  }

  if (state.phase === PHASE.VOTE) {
    return { kind: 'vote', label: 'Bỏ phiếu treo cổ', targets: targetsExcept(state, player), allowSkip: true, skipLabel: '🤷 Bỏ qua, không treo ai' }
  }
  return null
}

// Kỹ năng bấm một lần (không cần chọn người), hiện thành nút riêng.
const abilityButtons = (state, player) => {
  if (!player?.alive || state.status !== STATUS.PLAYING || player.hasUsedAbility) return []
  const buttons = []
  if (player.role === 'mayor' && [PHASE.DAY, PHASE.VOTE].includes(state.phase)) {
    buttons.push({ kind: 'mayor_reveal', label: '🎖️ Công khai là Trưởng làng (phiếu x2)', confirm: 'Công khai thân phận Trưởng làng?' })
  }
  if (player.role === 'blacksmith' && state.phase === PHASE.DAY && state.flags.silverDay !== state.day) {
    buttons.push({ kind: 'spread_silver', label: '⚒️ Rải bột bạc (chặn sói đêm nay)', confirm: 'Rải bạc? Chỉ dùng được một lần mỗi ván.' })
  }
  if (player.role === 'sandman' && state.phase === PHASE.DAY && !state.flags.sleepNext) {
    buttons.push({ kind: 'sandman_sleep', label: '💤 Ru cả làng ngủ say đêm nay', confirm: 'Ru cả làng ngủ? Chỉ dùng được một lần mỗi ván.' })
  }
  return buttons
}

const nightActionComplete = (state, player) => {
  const action = availableAction(state, player)
  if (!action || !NIGHT_KINDS.includes(action.kind)) return true
  const chosen = state.actions[player.userId]
  if (!chosen?.targetId) return false
  return !action.needsTwo || Boolean(chosen.targetId2)
}

const allNightActionsDone = (state) => alivePlayers(state).every((p) => nightActionComplete(state, p))

// ── Kiểm tra thắng ─────────────────────────────────────────────────────

const PASSIVE_SOLO = ['sorcerer', 'tanner', 'thief', 'doppelganger']

// Hết bầy sói: Sói tuyết thành sói thường, không có thì Kẻ phản bội hoá sói.
const promoteLastWolves = (state, now) => {
  if (alivePack(state).length || alivePlayers(state).some((p) => p.pendingBite)) return
  const snow = aliveWithRole(state, 'snow_wolf')
  if (snow) {
    snow.role = 'wolf'
    tell(state, snow, '☃️ Cả bầy đã chết. Bạn gác lại băng giá và trở thành Ma sói đi săn như bao con khác.', now)
    return
  }
  const traitor = aliveWithRole(state, 'traitor')
  if (traitor) {
    traitor.role = 'wolf'
    tell(state, traitor, '🐍 Bầy sói đã chết hết. Giờ là lúc bạn lột mặt nạ — bạn là Ma sói!', now)
  }
}

const checkWinner = (state, rng, now) => {
  promoteLastWolves(state, now)
  const alive = alivePlayers(state)
  if (alive.length === 0) return { team: TEAM.NONE }
  if (alive.length === 1) {
    const [last] = alive
    return { team: PASSIVE_SOLO.includes(last.role) ? TEAM.NONE : teamOf(last) }
  }
  if (alive.length === 2) {
    const [a, b] = alive
    if (a.loverId === b.userId) return { team: TEAM.LOVERS }
    if (alive.every((p) => PASSIVE_SOLO.includes(p.role))) return { team: TEAM.NONE }
    const hunter = alive.find((p) => p.role === 'hunter')
    if (hunter) {
      const other = alive.find((p) => p !== hunter)
      if (other.role === 'serial_killer') return { team: TEAM.KILLER }
      if (isWolfish(other)) {
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
    if (alive.some((p) => p.role === 'arsonist') && !alive.some((p) => p.role === 'gunner' && p.bullets > 0)) return { team: TEAM.ARSONIST }
    const cultist = alive.find(isCultist)
    if (cultist) {
      const other = alive.find((p) => p !== cultist)
      if (isCultist(other)) return { team: TEAM.CULT }
      if (isWolfish(other)) return { team: TEAM.WOLF }
      if (other.role === 'cult_hunter') {
        announce(state, `💂 Chỉ còn hai người. Thợ săn tà giáo ${other.displayName} lật mặt và hạ gục tín đồ ${cultist.displayName}!`, now)
        killPlayer(state, cultist, 'hunted', { deaths: [] })
        return { team: TEAM.VILLAGE }
      }
      if (!['thief', 'doppelganger'].includes(other.role)) transform(state, other, 'cultist', now, { silent: true })
      return { team: TEAM.CULT }
    }
  }
  if (alive.length === 3 && alive.every((p) => ['sorcerer', 'thief', 'doppelganger'].includes(p.role))) return { team: TEAM.NONE }

  if (alive.some((p) => p.role === 'serial_killer' || p.role === 'arsonist')) return null
  if (alive.every(isCultist)) return { team: TEAM.CULT }

  const wolves = alive.filter(isWolfish).length
  const others = alive.length - wolves
  if (wolves >= others) {
    const gunnerCanSwing = alive.some((p) => p.role === 'gunner' && p.bullets > 0) && wolves === others
    return gunnerCanSwing ? null : { team: TEAM.WOLF }
  }
  if (wolves === 0 && !alive.some(isCultist) && !alive.some((p) => p.pendingBite)) return { team: TEAM.VILLAGE }
  return null
}

const winnersFor = (state, team) => {
  if (team === TEAM.NONE) return []
  if (team === TEAM.LOVERS) return state.players.filter((p) => p.loverId).map((p) => p.userId)
  return state.players.filter((p) => teamOf(p) === team).map((p) => p.userId)
}

const WIN_TEXT = {
  [TEAM.VILLAGE]: '🎉 Dân làng đã quét sạch mối nguy. Làng lại bình yên!',
  [TEAM.WOLF]: '🐺 Bầy sói áp đảo dân làng. Ngôi làng thuộc về sói!',
  [TEAM.KILLER]: '🔪 Kẻ sát nhân là người cuối cùng đứng vững.',
  [TEAM.ARSONIST]: '🔥 Cả làng chìm trong biển lửa. Kẻ phóng hoả đứng nhìn tro tàn mà mỉm cười.',
  [TEAM.CULT]: '👤 Cả làng đã quy phục giáo phái. Tà giáo chiến thắng!',
  [TEAM.TANNER]: '👺 Kẻ chán đời đã toại nguyện khi bị treo cổ — và thắng một mình!',
  [TEAM.LOVERS]: '💞 Chỉ còn đôi tình nhân sống sót. Tình yêu chiến thắng tất cả!',
  [TEAM.NONE]: '🪦 Không phe nào trụ lại tới cuối. Không có người thắng.',
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

  state.players.filter((p) => p.alive && p.pendingBite).forEach((p) => {
    p.pendingBite = false
    if (isWolfish(p)) return
    transform(state, p, 'wolf', now)
    tell(state, p, '🌑 Vết cắn đêm trước bắt đầu phát tác… Bạn đã hoá thành Ma sói và giờ thuộc phe sói!', now)
  })
  roleChanges(state, now)

  // Bạc rải hôm qua có hiệu lực đêm nay; Thần ngủ thì xoá luôn bạc, cơn giận sói con và cơn say
  state.silverNight = state.flags.silverDay === state.day - 1
  state.sleeping = state.flags.sleepNext
  state.flags.sleepNext = false
  if (state.sleeping) {
    state.silverNight = false
    state.flags.cubRage = false
    state.flags.wolvesDrunk = false
  }

  const duration = state.sleeping
    ? Math.min(CONFIG.SLEEP_NIGHT_MS, CONFIG.NIGHT_MS)
    : hasFirstNightChoice(state) ? CONFIG.CUPID_NIGHT_MS : CONFIG.NIGHT_MS
  setPhase(state, PHASE.NIGHT, duration, now)
  announce(state, state.sleeping
    ? `💤 Đêm thứ ${state.day}: cả làng chìm vào giấc ngủ say như chết. Không ai thức dậy nổi.`
    : `🌙 Đêm thứ ${state.day} buông xuống. Mọi người đi ngủ, những kẻ có việc thì thức dậy…`, now)
  autoActBots(state, rng)
}

const resolveNight = (state, now, rng) => {
  state.phase = PHASE.DAY
  if (state.sleeping) {
    state.sleeping = false
    announce(state, '☀️ Trời sáng. Cả làng tỉnh dậy sau một giấc ngủ dài — không ai chết.', now)
    return settleOrContinue(state, { deaths: [], resume: 'day' }, now, rng, () => startDay(state, now, rng))
  }
  const ctx = resolveNightEffects(state, now, rng)
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

// Cuối ngày: Thám tử nhận kết quả (và có thể bị sói phát hiện), rồi vào bỏ phiếu.
const endDay = (state, now, rng) => {
  const detective = aliveWithRole(state, 'detective')
  const target = detective && findPlayer(state, state.actions[detective.userId]?.targetId)
  if (detective && target) {
    if (rng() < CONFIG.DETECTIVE_CAUGHT_CHANCE) tellWolves(state, `🕵️ Bầy sói đánh hơi thấy kẻ rình mò: ${detective.displayName} là Thám tử!`, now)
    tell(state, detective, `🕵️ Điều tra xong: ${target.displayName} là ${roleLabel(target.role)}.`, now)
  }
  roleChanges(state, now)
  startVote(state, now, rng)
}

const startVote = (state, now, rng) => {
  state.votes = {}
  setPhase(state, PHASE.VOTE, CONFIG.VOTE_MS, now)
  announce(state, '🗳️ Đến giờ bỏ phiếu! Chọn người bạn muốn treo cổ, hoặc bỏ qua.', now)
  autoActBots(state, rng)
}

const voteWeight = (player) => (player.role === 'mayor' && player.revealed ? 2 : 1)

const resolveVote = (state, now, rng) => {
  const counts = {}
  alivePlayers(state).forEach((p) => {
    const vote = state.votes[p.userId]
    if (vote) counts[vote] = (counts[vote] || 0) + voteWeight(p)
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
  if (target.role === 'prince' && !target.hasUsedAbility) {
    target.hasUsedAbility = true
    target.revealed = true
    announce(state, `👑 Khi dây thòng lọng vừa chạm cổ, ${target.displayName} rút ra ấn tín hoàng gia — đây là Hoàng tử! Dân làng vội tha, hôm nay không ai bị treo cổ.`, now)
    startNight(state, now, rng)
    return ['changed']
  }
  const ctx = { deaths: [], resume: 'night', by: null }
  killPlayer(state, target, 'lynched', ctx)
  announceDeaths(state, ctx.deaths, now)
  if (target.role === 'tanner') return endGame(state, TEAM.TANNER, now)
  roleChanges(state, now)
  return settleOrContinue(state, ctx, now, rng, () => startNight(state, now, rng))
}

const resumeAfterHunter = (state, info, now, rng) => {
  state.hunter = null
  if (info?.resume === 'night') return startNight(state, now, rng)
  if (info?.resume === 'day_continue') return startDay(state, now, rng, Math.max(15_000, info.remainingMs || 0))
  return startDay(state, now, rng)
}

// ── Hành động của người chơi ───────────────────────────────────────────

const useAbility = (state, player, kind, now) => {
  const button = abilityButtons(state, player).find((b) => b.kind === kind)
  if (!button) return fail('NO_ACTION', 'Kỹ năng này không dùng được lúc này')
  player.hasUsedAbility = true
  if (kind === 'mayor_reveal') {
    player.revealed = true
    announce(state, `🎖️ ${player.displayName} công khai là Trưởng làng! Từ giờ phiếu của ${player.displayName} tính gấp đôi.`, now)
  } else if (kind === 'spread_silver') {
    player.revealed = true
    state.flags.silverDay = state.day
    announce(state, `⚒️ ${player.displayName} là Thợ rèn và đã rải bột bạc khắp làng. Đêm nay bầy sói sẽ không dám bén mảng!`, now)
  } else if (kind === 'sandman_sleep') {
    player.revealed = true
    state.flags.sleepNext = true
    announce(state, `💤 ${player.displayName} là Thần ngủ và đã rắc bụi mơ khắp làng. Đêm nay mọi người sẽ ngủ say như chết.`, now)
  }
  return ok()
}

const submitAction = (state, userId, payload = {}, now, rng) => {
  if (state.status !== STATUS.PLAYING) return fail('NOT_PLAYING', 'Ván chưa bắt đầu')
  const player = findPlayer(state, userId)
  if (!player) return fail('NOT_PLAYER', 'Bạn không tham gia ván này')
  if (['mayor_reveal', 'spread_silver', 'sandman_sleep'].includes(payload.kind)) return useAbility(state, player, payload.kind, now)

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
  const special = (action.allowSkip && targetId === SKIP) || (action.extra && targetId === action.extra.targetId)
  if (!targetId || (!special && !action.targets.includes(targetId))) return fail('BAD_TARGET', 'Mục tiêu không hợp lệ')

  if (action.kind === 'gunner_shot') {
    const target = findPlayer(state, targetId)
    player.bullets -= 1
    player.revealed = true
    state.flags.gunnerShotDay = state.day
    const ctx = { deaths: [], by: player.displayName, resume: 'day_continue', remainingMs: Math.max(0, state.phaseEndsAt - now) }
    killPlayer(state, target, 'gunner', ctx)
    announceDeaths(state, ctx.deaths, now)
    punishElderKiller(state, target, player, now)
    roleChanges(state, now)
    return { ok: true, events: settleOrContinue(state, ctx, now, rng, () => {}) }
  }

  if (action.kind === 'hunter_shot') {
    const target = findPlayer(state, targetId)
    const info = state.hunter
    const ctx = { deaths: [], by: player.displayName, resume: info.resume, remainingMs: info.remainingMs }
    killPlayer(state, target, 'hunter_shot', ctx)
    announceDeaths(state, ctx.deaths, now)
    punishElderKiller(state, target, player, now)
    roleChanges(state, now)
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
  night: 'Ban đêm dân làng phải ngủ — chỉ bầy sói và giáo phái được thì thầm',
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
      if (isWolfish(player)) channel = 'wolves'
      else if (isCultist(player)) channel = 'cult'
      else return fail('NIGHT_SILENT', CHAT_DENIED.night)
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
    if (state.phase === PHASE.DAY && bot.alive) {
      state.ready[bot.userId] = true
      const ability = abilityButtons(state, bot)[0]
      if (ability && rng() < (ability.kind === 'mayor_reveal' ? 0.4 : 0.1)) useAbility(state, bot, ability.kind, state.phaseStartedAt)
    }
    const action = availableAction(state, bot)
    if (!action?.targets?.length && !action?.extra) return
    if (action.kind === 'vote') {
      state.votes[bot.userId] = rng() < 0.15 ? SKIP : pick(action.targets, rng)
      return
    }
    if (action.kind === 'gunner_shot') return
    if (action.kind === 'hunter_shot') {
      state.hunter.botTarget = pick(action.targets, rng)
      return
    }
    if (action.kind === 'arson' && action.extra && (rng() < 0.35 || !action.targets.length)) {
      state.actions[bot.userId] = { targetId: SPARK, targetId2: null }
      return
    }
    if (action.kind === 'visit' && rng() < 0.3) {
      state.actions[bot.userId] = { targetId: SKIP, targetId2: null }
      return
    }
    // Sói/tín đồ bot đi theo lựa chọn của đồng bọn nếu đã có
    const teamChoice = action.kind === 'wolf_kill'
      ? alivePack(state).map((w) => state.actions[w.userId]?.targetId).find(Boolean)
      : action.kind === 'convert' ? aliveCult(state).map((c) => state.actions[c.userId]?.targetId).find(Boolean) : null
    const targetId = teamChoice || pick(action.targets, rng)
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
      if (timeUp || (early && !state.sleeping && allNightActionsDone(state))) return { events: resolveNight(state, now, rng) }
      break
    case PHASE.DAY:
      if (timeUp || (early && allReady(state))) {
        endDay(state, now, rng)
        return { events: state.status === STATUS.ENDED ? ['changed', 'ended'] : ['changed'] }
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
  const viewerIsWolf = isWolfish(viewer)
  const viewerIsCult = isCultist(viewer)
  return (entry) => {
    switch (entry.channel) {
      case 'public': return true
      case 'wolves': return viewerIsWolf
      case 'cult': return viewerIsCult
      case 'dead': return Boolean(viewer && !viewer.alive)
      case 'private': return Boolean(viewer && entry.to?.includes(viewer.userId))
      default: return false
    }
  }
}

const serializeFor = (state, viewerId, now) => {
  const viewer = viewerId ? findPlayer(state, viewerId) : null
  const ended = state.status === STATUS.ENDED
  const viewerIsWolf = isWolfish(viewer)
  const viewerIsCupid = viewer?.originalRole === 'cupid'

  // Người trong cùng hội nhóm bí mật nhìn thấy nhau: bầy sói, giáo phái, Hội kín
  const sameCircle = (p) =>
    Boolean(viewer?.alive) && ((viewerIsWolf && isWolfish(p)) || (isCultist(viewer) && isCultist(p)) || (viewer.role === 'mason' && p.role === 'mason'))
  const roleVisible = (p) =>
    ended || (!p.alive && state.revealRoleOnDeath) || p.revealed || viewer?.userId === p.userId || sameCircle(p)
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
    role: roleVisible(p) ? shownRoleFor(state, p) : null,
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
    const shownRole = shownRoleFor(state, viewer)
    const teamVotes = (members) => members.map((m) => ({ userId: m.userId, ...(state.actions[m.userId] || {}) }))
    me = {
      userId: viewer.userId,
      role: shownRole,
      team: shownRole ? ROLES[shownRole].team : null,
      alive: viewer.alive,
      loverId: viewer.loverId,
      bullets: viewer.bullets,
      modelId: ['wild_child', 'doppelganger'].includes(viewer.role) ? viewer.modelId : null,
      doused: viewer.role === 'arsonist' ? alivePlayers(state).filter((p) => p.doused).map((p) => p.userId) : null,
      action: action ? { ...action } : null,
      abilities: abilityButtons(state, viewer),
      choice: state.actions[viewer.userId] || null,
      vote: state.votes[viewer.userId] || null,
      ready: Boolean(state.ready[viewer.userId]),
      wolfVotes: isPack(viewer) && state.phase === PHASE.NIGHT ? teamVotes(alivePack(state)) : null,
      cultVotes: isCultist(viewer) && state.phase === PHASE.NIGHT ? teamVotes(aliveCult(state)) : null,
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
    sleeping: state.phase === PHASE.NIGHT && state.sleeping,
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
  SPARK,
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
  abilityButtons,
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
  isWolfishRole,
}
