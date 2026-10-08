// Xử lý một đêm Ma Sói. Thứ tự giống bản gốc: đóng băng → phóng hoả → bầy sói →
// sát nhân → thợ săn tà giáo → tà giáo → người đi đêm → các vai soi → thiên thần
// → đổi vai → kẻ trộm. Trả về ctx { deaths, hunterShot } để engine công bố.
const { ROLES, PACK_ROLES, isWolfishRole, roleLabel } = require('./roles')
const {
  CONFIG,
  CULT_CONVERSION_CHANCE,
  SKIP,
  SPARK,
  pick,
  shuffle,
  findPlayer,
  alivePlayers,
  isPack,
  isWolfish,
  isCultist,
  alivePack,
  aliveCult,
  aliveWithRole,
  tell,
  tellWolves,
  tellCult,
  transform,
  roleChanges,
  killPlayer,
} = require('./core')

const VISIT = { OK: 'ok', DIED: 'died', FAIL: 'fail', DEAD: 'dead' }

const tallyTop = (counts, rng) => {
  const entries = Object.entries(counts).filter(([, value]) => value > 0)
  if (!entries.length) return null
  const max = Math.max(...entries.map(([, value]) => value))
  return pick(entries.filter(([, value]) => value === max).map(([key]) => key), rng)
}

const wolfTargets = (state, rng) => {
  const wolves = alivePack(state)
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

// Cách mỗi vai soi hiện ra với Tiên tri / Pháp sư
const seerView = (target, rng) => {
  if (target.role === 'lycan') return 'villager'
  if (target.role === 'traitor') return rng() < CONFIG.TRAITOR_SEEN_AS_WOLF_CHANCE ? 'wolf' : 'villager'
  if (['alpha_wolf', 'wolf_cub'].includes(target.role)) return 'wolf'
  return target.role
}

const resolveNightEffects = (state, now, rng) => {
  const ctx = { deaths: [], resume: 'day', by: null }
  const saved = new Set()
  const burning = new Set()
  const killedTonight = new Map() // userId → nguyên nhân (để Người đi đêm biết mình vào nhà có án mạng)
  const actionOf = (p) => state.actions[p?.userId]
  const frozen = (p) => p?.frozenDay === state.day
  const acting = (p) => Boolean(p?.alive && actionOf(p)?.targetId && !frozen(p))
  const away = (p) => p?.role === 'harlot' && acting(p) && actionOf(p).targetId !== SKIP
  const guardianAway = (p) => p?.role === 'guardian' && acting(p)
  const kill = (player, cause, opts) => {
    if (!player?.alive) return
    killPlayer(state, player, cause, ctx, opts)
    killedTonight.set(player.userId, cause)
  }

  // Luật đi thăm chung: ai vào nhà ai thì chuyện gì xảy ra với người đi.
  const visit = (visitor, target) => {
    if (!target) return VISIT.FAIL
    if (!target.alive && !burning.has(target.userId)) return VISIT.DEAD
    if (visitor.role === 'serial_killer') return VISIT.OK
    if (burning.has(target.userId)) {
      kill(visitor, 'visit_burning', { finalShot: false })
      return VISIT.DIED
    }
    if (target.role === 'serial_killer') {
      const wolfLucky = isWolfish(visitor) && acting(target) && rng() >= CONFIG.SK_BEATS_WOLF_CHANCE
      if (!wolfLucky) {
        kill(visitor, 'visit_killer')
        return VISIT.DIED
      }
      return VISIT.OK
    }
    if (visitor.role === 'snow_wolf') return VISIT.OK
    if (isWolfish(target)) {
      if (visitor.role === 'harlot') {
        kill(visitor, 'visit_wolf')
        return VISIT.DIED
      }
      if (visitor.role === 'guardian' && !saved.has(target.userId) && rng() < CONFIG.GUARD_WOLF_DEATH_CHANCE) {
        kill(visitor, 'guard_wolf')
        return VISIT.DIED
      }
    }
    if (visitor.role === 'arsonist') return VISIT.OK
    if (away(target) || (guardianAway(target) && !isPack(visitor))) return VISIT.FAIL
    return VISIT.OK
  }

  // 0. Lựa chọn đêm đầu: se duyên, chọn hình mẫu (không chọn thì số phận chọn giúp)
  const cupid = aliveWithRole(state, 'cupid')
  if (cupid && state.day === 1 && !state.players.some((p) => p.loverId)) {
    const chosen = actionOf(cupid)
    let pair = [chosen?.targetId, chosen?.targetId2].map((id) => id && findPlayer(state, id)).filter((p) => p?.alive)
    if (pair.length !== 2 || pair[0] === pair[1]) pair = shuffle(alivePlayers(state), rng).slice(0, 2)
    if (pair.length === 2) {
      pair[0].loverId = pair[1].userId
      pair[1].loverId = pair[0].userId
      tell(state, cupid, `🏹 Mũi tên đã trúng: ${pair[0].displayName} và ${pair[1].displayName} giờ là một cặp.`, now)
      pair.forEach((lover, index) => {
        const partner = pair[1 - index]
        tell(state, lover, `💘 Thần tình yêu đã chọn bạn! Bạn đang yêu ${partner.displayName} (${roleLabel(partner.role === 'fool' ? 'seer' : partner.role)}). Người này chết thì bạn cũng chết theo.`, now)
      })
    }
  }
  alivePlayers(state).filter((p) => ['wild_child', 'doppelganger'].includes(p.role) && !p.modelId).forEach((p) => {
    const chosen = findPlayer(state, actionOf(p)?.targetId)
    const model = chosen && chosen !== p ? chosen : pick(alivePlayers(state).filter((x) => x !== p), rng)
    if (!model) return
    p.modelId = model.userId
    tell(state, p, `${ROLES[p.role].emoji} Hình mẫu của bạn là ${model.displayName}.${chosen ? '' : ' (Bạn chưa chọn nên số phận đã chọn giúp.)'}`, now)
  })

  const guardian = aliveWithRole(state, 'guardian')
  const guardPlan = guardian ? findPlayer(state, actionOf(guardian)?.targetId) : null

  // 1. Sói tuyết đóng băng (bị bạc chặn)
  const snow = aliveWithRole(state, 'snow_wolf')
  if (snow && !state.silverNight && acting(snow)) {
    const target = findPlayer(state, actionOf(snow).targetId)
    if (target?.alive) {
      const sk = target.role === 'serial_killer'
      if (sk && (!acting(target) || rng() < CONFIG.SK_BEATS_WOLF_CHANCE)) {
        kill(snow, 'visit_killer')
      } else if (!sk && guardPlan?.userId === target.userId) {
        tell(state, snow, `👼 Có ai đó canh nhà ${target.displayName}, băng giá không lọt vào được.`, now)
      } else if (target.role === 'hunter' && rng() >= CONFIG.SNOW_FREEZES_HUNTER_CHANCE) {
        ctx.by = target.displayName
        kill(snow, 'hunter_night')
        ctx.by = null
      } else {
        target.frozenDay = state.day
        tell(state, target, '❄️ Một luồng khí lạnh buốt tràn vào nhà… Bạn bị đóng băng, đêm nay không làm được gì.', now)
        tell(state, snow, `❄️ Bạn đã đóng băng ${target.displayName}.`, now)
      }
    }
  }
  const guarded = acting(guardian) ? guardPlan : null

  // 2. Kẻ phóng hoả: tưới xăng hoặc châm lửa
  const arsonist = aliveWithRole(state, 'arsonist')
  if (arsonist && actionOf(arsonist)?.targetId) {
    if (actionOf(arsonist).targetId === SPARK) {
      const doused = alivePlayers(state).filter((p) => p.doused)
      doused.forEach((p) => {
        if (guarded?.userId === p.userId) {
          saved.add(p.userId)
          return
        }
        burning.add(p.userId)
        kill(p, 'burned', { finalShot: false })
      })
      tell(state, arsonist, `🔥 Bạn châm lửa! ${burning.size} căn nhà bốc cháy.`, now)
    } else {
      const target = findPlayer(state, actionOf(arsonist).targetId)
      if (visit(arsonist, target) === VISIT.OK) {
        target.doused = true
        tell(state, arsonist, `⛽ Bạn đã lén tưới xăng quanh nhà ${target.displayName}.`, now)
      }
    }
  }

  // 3. Bầy sói (bạc chặn, say rượu chặn)
  if (state.silverNight) {
    tellWolves(state, '⚒️ Mùi bạc nồng nặc khắp làng. Bầy sói không dám ra khỏi hang đêm nay.', now)
  } else if (state.flags.wolvesDrunk) {
    state.flags.wolvesDrunk = false
    tellWolves(state, '🍻 Bầy sói vẫn còn say, cả đêm nằm ngủ vật vờ.', now)
  } else {
    const targets = wolfTargets(state, rng)
    if (state.flags.cubRage && targets.length) state.flags.cubRage = false
    for (const targetId of targets) {
      const wolves = alivePack(state)
      if (!wolves.length) break
      const target = findPlayer(state, targetId)
      if (!target?.alive || isWolfish(target)) continue
      const visitor = pick(wolves, rng)
      const result = visit(visitor, target)
      if (result === VISIT.DIED) {
        tellWolves(state, `🩸 ${visitor.displayName} đi săn đêm qua và không bao giờ trở về…`, now)
        continue
      }
      if (result === VISIT.FAIL) {
        tellWolves(state, `🏚️ Nhà ${target.displayName} trống không — con mồi đã đi vắng.`, now)
        continue
      }
      if (result !== VISIT.OK) continue
      if (guarded?.userId === target.userId) {
        saved.add(target.userId)
        tellWolves(state, `👼 Một thiên thần đã chắn trước cửa nhà ${target.displayName}. Bầy sói ra về tay trắng.`, now)
        continue
      }
      if (target.role === 'cursed') {
        transform(state, target, 'wolf', now)
        tell(state, target, '😾 Sói tấn công bạn đêm qua… nhưng lời nguyền trỗi dậy. Bạn đã hoá thành Ma sói!', now)
        continue
      }
      if (target.role === 'hunter') {
        const chance = CONFIG.HUNTER_BASE_CHANCE + (wolves.length - 1) * CONFIG.HUNTER_PER_EXTRA_WOLF
        if (rng() < chance) {
          const shot = pick(wolves, rng)
          ctx.by = target.displayName
          kill(shot, 'hunter_night')
          ctx.by = null
          if (wolves.length > 1) kill(target, 'eaten', { finalShot: false })
          else tell(state, target, `🎯 Sói mò tới nhà bạn và bạn đã bắn hạ ${shot.displayName}!`, now)
          continue
        }
      }
      const alpha = wolves.find((w) => w.role === 'alpha_wolf')
      const bitten = Boolean(alpha) && rng() < CONFIG.ALPHA_BITE_CHANCE
      if (target.role === 'wise_elder' && !bitten && !target.hasUsedAbility) {
        target.hasUsedAbility = true
        tellWolves(state, `📚 ${target.displayName} là Già làng từng trải — bầy sói bị đuổi đi. Lần sau thì không may vậy đâu.`, now)
        tell(state, target, '📚 Sói mò tới nhà nhưng bạn đã xua được chúng đi. Lần sau bạn sẽ không may mắn vậy nữa.', now)
        continue
      }
      if (bitten) {
        target.pendingBite = true
        tellWolves(state, `⚡ Sói đầu đàn đã cắn ${target.displayName}. Người này sẽ hoá sói vào đêm mai.`, now)
        continue
      }
      kill(target, 'eaten', { finalShot: false })
      if (target.role === 'drunk') {
        state.flags.wolvesDrunk = true
        tellWolves(state, `🍻 ${target.displayName} là bợm nhậu! Bầy sói say mèm và phải nghỉ săn đêm mai.`, now)
      }
    }
  }

  // 4. Kẻ sát nhân (bị đóng băng thì ngồi yên; Thiên thần không cứu được Người đi đêm khỏi hắn)
  const sk = aliveWithRole(state, 'serial_killer')
  if (acting(sk)) {
    const target = findPlayer(state, actionOf(sk).targetId)
    if (visit(sk, target) === VISIT.OK) {
      if (guarded?.userId === target.userId && target.role !== 'harlot') {
        saved.add(target.userId)
        tell(state, sk, `👼 Có ai đó đứng canh nhà ${target.displayName}. Bạn đành bỏ đi.`, now)
      } else {
        kill(target, 'stabbed')
      }
    }
  }

  // 5. Thợ săn tà giáo
  const cultHunter = aliveWithRole(state, 'cult_hunter')
  if (acting(cultHunter)) {
    const target = findPlayer(state, actionOf(cultHunter).targetId)
    const result = visit(cultHunter, target)
    if (result === VISIT.OK) {
      if (isCultist(target)) {
        kill(target, 'hunted')
        tell(state, cultHunter, `💂 Bắt được rồi! ${target.displayName} là tín đồ tà giáo và đã bị bạn hạ gục.`, now)
        tellCult(state, `💂 ${target.displayName} đã bị Thợ săn tà giáo hạ gục.`, now)
      } else {
        tell(state, cultHunter, `💂 ${target.displayName} không phải tín đồ tà giáo.`, now)
      }
    } else if (result === VISIT.DEAD) {
      tell(state, cultHunter, `💂 Tới nơi thì ${target.displayName} đã chết.`, now)
    } else if (result === VISIT.FAIL) {
      tell(state, cultHunter, `💂 ${target.displayName} không có nhà.`, now)
    }
  }

  // 6. Tà giáo chiêu mộ: tín đồ mới nhất đi gõ cửa
  const voters = aliveCult(state).filter(acting)
  if (voters.length) {
    const counts = {}
    voters.forEach((c) => { counts[actionOf(c).targetId] = (counts[actionOf(c).targetId] || 0) + 1 })
    const target = findPlayer(state, tallyTop(counts, rng))
    const newest = voters.reduce((a, b) => ((b.cultJoinedAt || 0) > (a.cultJoinedAt || 0) ? b : a))
    const failConvert = (why) => {
      tellCult(state, `👤 Không chiêu mộ được ${target.displayName}${why ? ` — ${why}` : ''}.`, now)
    }
    if (target && !isCultist(target)) {
      let result
      if (target.role === 'cult_hunter' && target.alive) {
        kill(newest, 'hunted')
        tell(state, target, `💂 Tín đồ ${newest.displayName} mò tới nhà bạn và đã bị bạn hạ gục.`, now)
        result = VISIT.DIED
      } else {
        result = visit(newest, target)
      }
      if (result === VISIT.DIED) {
        tellCult(state, `🩸 ${newest.displayName} đi gõ cửa nhà ${target.displayName} và không trở về.`, now)
      } else if (result === VISIT.FAIL) {
        failConvert('nhà không có ai')
      } else if (result === VISIT.OK) {
        const wolvesOut = isPack(target) && !state.silverNight && alivePack(state).some((w) => actionOf(w)?.targetId)
        if (isWolfish(target)) {
          const out = target.role === 'snow_wolf' ? acting(target) : wolvesOut
          if (out) failConvert('nhà không có ai')
          else {
            kill(newest, 'visit_wolf')
            tellCult(state, `🩸 ${newest.displayName} gõ nhầm cửa hang sói.`, now)
          }
        } else if (target.role === 'hunter') {
          if (rng() < CONFIG.HUNTER_CULT_CONVERT_CHANCE) {
            transform(state, target, 'cultist', now)
            tell(state, target, '👤 Đêm qua có người gõ cửa rủ bạn theo giáo phái… và bạn đã gật đầu.', now)
          } else if (rng() < 0.5) {
            ctx.by = target.displayName
            kill(newest, 'hunter_night')
            ctx.by = null
            tellCult(state, `🩸 ${newest.displayName} bị thợ săn ${target.displayName} bắn hạ.`, now)
          } else {
            failConvert()
          }
        } else if (rng() < (CULT_CONVERSION_CHANCE[target.role] ?? 1)) {
          transform(state, target, 'cultist', now)
          tell(state, target, '👤 Đêm qua có người gõ cửa rủ bạn theo giáo phái… và bạn đã gật đầu. Giờ bạn là tín đồ tà giáo!', now)
        } else {
          failConvert()
          tell(state, target, '👤 Đêm qua có kẻ lạ gõ cửa rủ bạn theo một giáo phái kỳ quặc. Bạn đã từ chối.', now)
        }
      }
    }
  }

  // 7. Người đi đêm
  const harlot = aliveWithRole(state, 'harlot')
  if (away(harlot)) {
    const target = findPlayer(state, actionOf(harlot).targetId)
    const victimCause = killedTonight.get(target?.userId)
    if (victimCause === 'eaten' || victimCause === 'stabbed') {
      kill(harlot, 'harlot_victim')
    } else {
      const result = visit(harlot, target)
      if (result === VISIT.OK) {
        const spotsCult = isCultist(target) && rng() < CONFIG.HARLOT_SPOTS_CULT_CHANCE
        tell(state, harlot, spotsCult
          ? `💋 Bạn ngủ nhờ nhà ${target.displayName} và phát hiện người này là tín đồ tà giáo!`
          : `💋 Bạn ngủ nhờ nhà ${target.displayName} — người này không phải sói.`, now)
        tell(state, target, '💋 Đêm qua có người ghé nhà bạn ngủ nhờ.', now)
      }
    }
  }

  // 8. Các vai soi (chỉ khi còn sống tới sáng và không bị đóng băng)
  const alive = (p) => p?.alive && !frozen(p)
  alivePlayers(state).filter((p) => p.role === 'seer' && alive(p) && actionOf(p)?.targetId).forEach((seer) => {
    const target = findPlayer(state, actionOf(seer).targetId)
    if (target) tell(state, seer, `🔮 Quả cầu pha lê cho thấy: ${target.displayName} là ${roleLabel(seerView(target, rng))}.`, now)
  })
  const sorcerer = aliveWithRole(state, 'sorcerer')
  if (alive(sorcerer) && actionOf(sorcerer)?.targetId) {
    const target = findPlayer(state, actionOf(sorcerer).targetId)
    const view = ['wolf', 'alpha_wolf', 'wolf_cub'].includes(target.role) ? 'wolf' : ['seer', 'snow_wolf'].includes(target.role) ? target.role : null
    tell(state, sorcerer, view
      ? `🔮 ${target.displayName} là ${roleLabel(view)}.`
      : `🔮 ${target.displayName} không phải sói, cũng không phải Tiên tri.`, now)
  }
  const fool = aliveWithRole(state, 'fool')
  if (alive(fool) && actionOf(fool)?.targetId) {
    const target = findPlayer(state, actionOf(fool).targetId)
    const pool = alivePlayers(state).filter((p) => p !== fool && p.role !== 'seer')
    const random = pick(pool, rng)
    if (target && random) {
      const role = PACK_ROLES.includes(random.role) ? 'wolf' : random.role
      tell(state, fool, `🔮 Quả cầu pha lê cho thấy: ${target.displayName} là ${roleLabel(role)}.`, now)
    }
  }
  const oracle = aliveWithRole(state, 'oracle')
  if (alive(oracle) && actionOf(oracle)?.targetId) {
    const target = findPlayer(state, actionOf(oracle).targetId)
    const pool = alivePlayers(state).filter((p) => p !== oracle && p.role !== target?.role)
    const other = pick(pool, rng)
    if (target && other) tell(state, oracle, `🌀 ${target.displayName} KHÔNG phải là ${roleLabel(other.role)}.`, now)
  }
  const augur = aliveWithRole(state, 'augur')
  if (alive(augur)) {
    const present = new Set(state.players.filter((p) => p.alive || killedTonight.has(p.userId)).map((p) => p.role))
    let role = state.augurPool.find((r) => !state.augurSeen.includes(r) && !present.has(r))
    if (role) {
      state.augurSeen.push(role)
      if (role === 'seer' && aliveWithRole(state, 'apprentice_seer')) role = 'apprentice_seer'
      tell(state, augur, `🦅 Đàn chim bay qua cho bạn biết: trong làng không có ${roleLabel(role)}.`, now)
    } else {
      tell(state, augur, '🦅 Đêm nay chim không bay, bạn chẳng đoán được gì thêm.', now)
    }
  }

  // 9. Số phận thiên thần: canh nhà sát nhân thì chết, canh nhà sói (không bị ai tấn công) thì 50%;
  //    canh nhà bị tưới xăng mà chưa cháy thì lau sạch xăng.
  if (guardian?.alive && guarded) {
    const result = visit(guardian, guarded)
    if (result === VISIT.OK) {
      if (guarded.doused && !burning.has(guarded.userId)) {
        guarded.doused = false
        tell(state, guardian, `👼 Bạn ngửi thấy mùi xăng quanh nhà ${guarded.displayName} và đã lau sạch.`, now)
      }
      if (saved.has(guarded.userId)) tell(state, guardian, `👼 Đêm qua có kẻ tấn công ${guarded.displayName}, nhưng bạn đã bảo vệ thành công!`, now)
    }
  }

  // 10. Đổi vai (tập sự lên thay, trẻ hoang/bắt chước) rồi 11. Kẻ trộm ra tay cuối cùng
  roleChanges(state, now)
  const thief = aliveWithRole(state, 'thief')
  if (thief && !thief.stole) {
    thief.stole = true
    let target = findPlayer(state, actionOf(thief)?.targetId)
    if (!target?.alive || target === thief) target = pick(alivePlayers(state).filter((p) => p !== thief), rng)
    if (target && burning.has(target.userId)) kill(thief, 'visit_burning', { finalShot: false })
    else if (target?.role === 'serial_killer') kill(thief, 'visit_killer')
    else if (target) {
      const role = target.role
      thief.bullets = target.bullets
      thief.hasUsedAbility = target.hasUsedAbility
      thief.modelId = target.modelId
      thief.cultJoinedAt = target.cultJoinedAt
      target.bullets = 0
      target.modelId = null
      target.cultJoinedAt = null
      transform(state, target, 'villager', now, { silent: true })
      transform(state, thief, role, now)
      tell(state, thief, `😈 Bạn đã trộm vai của ${target.displayName}. Giờ bạn là ${roleLabel(role)}. ${ROLES[role].summary}`, now)
      tell(state, target, '😈 Sáng dậy bạn thấy người nhẹ bẫng… Ai đó đã trộm mất vai của bạn. Giờ bạn chỉ là Dân làng.', now)
      if (role === 'seer') {
        const beholder = aliveWithRole(state, 'beholder')
        if (beholder) tell(state, beholder, `👁️ Vai Tiên tri đã bị trộm — Tiên tri giờ là ${thief.displayName}.`, now)
      }
      roleChanges(state, now)
    }
  }

  return ctx
}

module.exports = { resolveNightEffects, wolfTargets, tallyTop, seerView, VISIT, isWolfishRole }
