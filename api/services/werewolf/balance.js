// Chia vai cho một ván: bốc ngẫu nhiên rồi kiểm tra cân phe, không đạt thì bốc lại.
const {
  TEAM,
  VILLAGE_SPECIALS,
  NON_VILLAGE_ROLES,
  REVEALED_VILLAGE_ROLES,
  isPackRole,
  isWolfishRole,
  strengthOf,
} = require('./roles')

const shuffle = (list, rng) => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Quy tắc chia vai — dùng chung cho buildRoles và cho màn "Luật & vai" (qua /config),
// nên chỉnh ở đây là luật hiển thị cho người chơi cũng đổi theo.
const DEAL_RULES = {
  wolves: [{ from: 5, count: 1 }, { from: 8, count: 2 }, { from: 13, count: 3 }],
  specialWolfChance: 0.4,
  seerChance: 0.85,
  extras: {
    serial_killer: { minPlayers: 8, chance: 0.3 },
    arsonist: { minPlayers: 8, chance: 0.25 },
    cultist: { minPlayers: 11, chance: 0.35 },
    sorcerer: { minPlayers: 7, chance: 0.25 },
    tanner: { minPlayers: 6, chance: 0.25 },
    thief: { minPlayers: 6, chance: 0.15 },
  },
}

const wolfCountFor = (n) => DEAL_RULES.wolves.filter((tier) => n >= tier.from).at(-1)?.count || 1
const rolls = (role, n, rng) => n >= DEAL_RULES.extras[role].minPlayers && rng() < DEAL_RULES.extras[role].chance

const isEnemy = (role) => NON_VILLAGE_ROLES.includes(role)

const isBalanced = (roles) => {
  const n = roles.length
  const count = (key) => roles.filter((r) => r === key).length
  if (!roles.some(isPackRole)) return false
  // Vai đi kèm: tiên tri tập sự cần tiên tri, tà giáo cần thợ săn tà giáo và ngược lại
  if (roles.includes('apprentice_seer') && !roles.includes('seer')) return false
  if (roles.includes('cultist') !== roles.includes('cult_hunter')) return false
  if (roles.includes('serial_killer') && roles.includes('arsonist')) return false
  if (count('mason') === 1) return false
  const enemies = roles.filter(isEnemy)
  const village = roles.filter((role) => !isEnemy(role))
  if (enemies.length >= village.length) return false
  // Quá nhiều vai lộ diện hoặc vai chặn giết đêm thì ván nhạt
  if (roles.filter((r) => REVEALED_VILLAGE_ROLES.includes(r)).length * 3 > n) return false
  if ((count('sandman') + count('blacksmith')) * 4 > n) return false
  const villageStrength = village.reduce((sum, role) => sum + strengthOf(role, roles), 0)
  const enemyStrength = enemies.reduce((sum, role) => sum + strengthOf(role, roles), 0)
  return Math.abs(villageStrength - enemyStrength) <= Math.floor(n / 4) + 1
}

const buildRoles = (n, rng) => {
  for (let attempt = 0; attempt < 800; attempt += 1) {
    // Chọn các phe thứ ba trước; có phe thứ ba thì bớt một sói để tổng mối nguy không quá tay
    const extras = []
    // Kẻ sát nhân và Kẻ phóng hoả không bao giờ cùng một ván
    const solo = rng()
    const { serial_killer: sk, arsonist: arson } = DEAL_RULES.extras
    if (n >= sk.minPlayers && solo < sk.chance) extras.push('serial_killer')
    else if (n >= arson.minPlayers && solo < sk.chance + arson.chance) extras.push('arsonist')
    if (rolls('cultist', n, rng)) extras.push('cultist', 'cult_hunter')
    const thirdParties = extras.filter((r) => r !== 'cult_hunter').length
    const wolfCount = Math.max(1, wolfCountFor(n) - thirdParties)

    const roles = []
    const wolfSpecials = shuffle(['alpha_wolf', 'wolf_cub', 'lycan', 'snow_wolf'], rng)
    for (let i = 0; i < wolfCount; i += 1) {
      roles.push(wolfSpecials.length && rng() < DEAL_RULES.specialWolfChance ? wolfSpecials.pop() : 'wolf')
    }
    // Sói tuyết không đi một mình: phải có ít nhất một sói trong bầy
    if (!roles.some(isPackRole)) roles[roles.indexOf('snow_wolf')] = 'wolf'

    roles.push(...extras)
    if (rolls('sorcerer', n, rng)) roles.push('sorcerer')
    if (rolls('tanner', n, rng)) roles.push('tanner')
    if (rolls('thief', n, rng)) roles.push('thief')

    let specials = shuffle(VILLAGE_SPECIALS, rng)
    if (rng() < DEAL_RULES.seerChance) specials = ['seer', ...specials.filter((role) => role !== 'seer')]
    const base = roles.length
    const specialCount = Math.max(1, Math.round((n - base) * (0.35 + rng() * 0.45)))
    for (const role of specials) {
      if (roles.length >= n || roles.length - base >= specialCount) break
      if (role === 'mason') {
        if (roles.length + 2 <= n) roles.push('mason', 'mason')
        continue
      }
      roles.push(role)
    }
    while (roles.length < n) roles.push('villager')

    if (roles.length === n && isBalanced(roles)) return { roles: shuffle(roles, rng), attempts: attempt + 1 }
  }
  // Không cân được (rất hiếm) → bộ vai tối giản luôn hợp lệ
  const roles = ['wolf', 'seer']
  while (roles.length < n) roles.push('villager')
  return { roles: shuffle(roles, rng), attempts: -1 }
}

// Ghi chú "khi nào có vai này" hiện trên từng thẻ vai trong màn luật. Cố ý không ghi %:
// tỉ lệ bốc ở trên còn qua bước cân phe nên tần suất thật khác, ghi số dễ thành nói sai.
const appearanceNote = (role) => {
  const extra = DEAL_RULES.extras[role]
  switch (role) {
    case 'serial_killer':
    case 'arsonist':
      return `Phe thứ ba · chỉ có từ ${extra.minPlayers} người, không phải ván nào cũng có · Kẻ sát nhân và Kẻ phóng hoả không bao giờ cùng ván`
    case 'cultist':
    case 'cult_hunter':
      return `Phe thứ ba · chỉ có từ ${DEAL_RULES.extras.cultist.minPlayers} người, không phải ván nào cũng có · Tín đồ và Thợ săn tà giáo luôn đi cùng nhau`
    case 'sorcerer':
    case 'tanner':
    case 'thief':
      return `Chỉ có từ ${extra.minPlayers} người, không phải ván nào cũng có`
    case 'seer':
      return 'Có trong hầu hết các ván'
    case 'wolf':
      return `${DEAL_RULES.wolves.map((tier) => `${tier.count} sói từ ${tier.from} người`).join(', ')} · bớt 1 sói nếu ván có phe thứ ba`
    case 'alpha_wolf':
    case 'wolf_cub':
    case 'lycan':
      return 'Thay chỗ một con sói thường, mỗi ván tối đa một con'
    case 'snow_wolf':
      return 'Thay chỗ một con sói thường, không bao giờ là sói duy nhất'
    case 'apprentice_seer':
      return 'Chỉ có khi ván có Tiên tri'
    case 'mason':
      return 'Luôn đi theo cặp (2 người)'
    case 'villager':
      return 'Lấp các ghế còn trống'
    default:
      return 'Bốc ngẫu nhiên, mỗi ván tối đa một người'
  }
}

// Tóm tắt quy tắc chia vai cho màn luật
const dealingSummary = () => ({
  wolves: DEAL_RULES.wolves,
  seerChance: DEAL_RULES.seerChance,
  thirdParties: [
    { roles: ['serial_killer', 'arsonist'], minPlayers: DEAL_RULES.extras.serial_killer.minPlayers, note: 'một trong hai, không bao giờ cả hai' },
    { roles: ['cultist', 'cult_hunter'], minPlayers: DEAL_RULES.extras.cultist.minPlayers, note: 'một tín đồ khởi đầu, luôn kèm Thợ săn tà giáo' },
  ],
  extras: Object.entries(DEAL_RULES.extras).map(([role, rule]) => ({ role, ...rule })),
})

module.exports = { buildRoles, isBalanced, wolfCountFor, shuffle, TEAM, isWolfishRole, DEAL_RULES, appearanceNote, dealingSummary }
