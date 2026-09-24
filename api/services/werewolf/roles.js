// Danh mục vai Ma Sói. Luật tham khảo GreyWolfDev/Werewolf nhưng mô tả,
// cách cài đặt và câu chữ đều viết mới cho musicque.

const TEAM = {
  VILLAGE: 'village',
  WOLF: 'wolf',
  TANNER: 'tanner',
  KILLER: 'killer',
  CULT: 'cult',
  ARSONIST: 'arsonist',
  // Kẻ trộm / Kẻ bắt chước chưa đổi vai: trung lập, không tự thắng được
  NEUTRAL: 'neutral',
  LOVERS: 'lovers',
  NONE: 'none',
}

const ROLES = {
  // ── Phe dân: cơ bản ──
  villager: { name: 'Dân làng', emoji: '👱', team: TEAM.VILLAGE, summary: 'Không có kỹ năng đặc biệt. Vũ khí của bạn là lý lẽ và lá phiếu ban ngày.' },
  seer: { name: 'Tiên tri', emoji: '👳', team: TEAM.VILLAGE, unique: true, summary: 'Mỗi đêm chọn một người để biết vai của họ vào sáng hôm sau. (Sói đội lốt hiện ra là dân, Kẻ phản bội lúc ra sói lúc ra dân.)' },
  guardian: { name: 'Thiên thần hộ mệnh', emoji: '👼', team: TEAM.VILLAGE, unique: true, summary: 'Mỗi đêm bảo vệ một người khác khỏi sói, sát nhân và lửa. Canh nhầm nhà sói thì có 50% bị ăn, canh nhà sát nhân thì chắc chắn chết.' },
  hunter: { name: 'Thợ săn', emoji: '🎯', team: TEAM.VILLAGE, unique: true, summary: 'Bị sói tấn công thì có cơ hội bắn chết một con. Chết theo cách khác (bị treo cổ, bị đâm…) thì được bắn một người trước khi gục.' },
  gunner: { name: 'Xạ thủ', emoji: '🔫', team: TEAM.VILLAGE, unique: true, summary: 'Có 2 viên đạn, mỗi ngày bắn tối đa một người vào ban ngày. Nổ súng là cả làng biết bạn là xạ thủ.' },
  cupid: { name: 'Thần tình yêu', emoji: '🏹', team: TEAM.VILLAGE, unique: true, summary: 'Đêm đầu tiên ghép đôi hai người (có thể gồm chính bạn). Một người chết, người kia chết theo. Nếu chỉ còn đúng hai người yêu nhau sống sót, họ thắng.' },
  drunk: { name: 'Bợm nhậu', emoji: '🍻', team: TEAM.VILLAGE, unique: true, summary: 'Không có kỹ năng. Nhưng sói nào ăn phải bạn sẽ say mèm, cả bầy không đi săn được vào đêm kế tiếp.' },
  cursed: { name: 'Kẻ bị nguyền', emoji: '😾', team: TEAM.VILLAGE, unique: true, summary: 'Bắt đầu là dân làng. Nếu bị sói tấn công, bạn không chết mà hoá thành sói và theo phe sói.' },
  // ── Phe dân: gói dễ ──
  mayor: { name: 'Trưởng làng', emoji: '🎖️', team: TEAM.VILLAGE, unique: true, summary: 'Bất cứ lúc nào (ngày hay lúc bỏ phiếu) bạn có thể công khai thân phận. Từ đó phiếu treo cổ của bạn tính gấp đôi.' },
  prince: { name: 'Hoàng tử', emoji: '👑', team: TEAM.VILLAGE, unique: true, summary: 'Lần đầu bị dân làng treo cổ, bạn lộ thân phận hoàng tử và thoát chết. Lần thứ hai thì không.' },
  wise_elder: { name: 'Già làng', emoji: '📚', team: TEAM.VILLAGE, unique: true, summary: 'Chịu được một lần bị sói tấn công. Xạ thủ hay Thợ săn nào lỡ giết bạn sẽ ân hận mà mất luôn năng lực.' },
  mason: { name: 'Hội kín', emoji: '👷', team: TEAM.VILLAGE, summary: 'Các thành viên Hội kín biết mặt nhau ngay từ đầu. Ngoài ra bạn là dân làng bình thường.' },
  apprentice_seer: { name: 'Tiên tri tập sự', emoji: '🙇', team: TEAM.VILLAGE, unique: true, summary: 'Khi Tiên tri không còn (chết, bị cắn hoá sói, theo tà giáo…), bạn lên thay và bắt đầu soi từ đêm sau.' },
  traitor: { name: 'Kẻ phản bội', emoji: '🐍', team: TEAM.VILLAGE, unique: true, summary: 'Tạm thời là dân. Khi bầy sói chết hết, bạn hoá sói và tiếp tục công việc của chúng. Tiên tri soi bạn lúc ra sói, lúc ra dân.' },
  fool: { name: 'Kẻ khờ', emoji: '🃏', team: TEAM.VILLAGE, unique: true, summary: 'Bạn tin mình là Tiên tri, nhưng mọi lần "soi" đều ra một vai ngẫu nhiên của ai đó trong làng. Chỉ khi hết ván (hoặc khi chết) bạn mới biết sự thật.' },
  // ── Phe dân: gói hành động ──
  harlot: { name: 'Người đi đêm', emoji: '💋', team: TEAM.VILLAGE, unique: true, summary: 'Mỗi đêm có thể sang ngủ nhà một người. Nhà đó không phải sói thì bạn biết vậy; sang trúng nhà sói, nhà sát nhân, hoặc nhà người bị giết đêm đó thì bạn chết theo. Sói tới nhà lúc bạn đi vắng thì bạn thoát.' },
  detective: { name: 'Thám tử', emoji: '🕵️', team: TEAM.VILLAGE, unique: true, summary: 'Mỗi ngày điều tra một người để biết vai thật của họ vào cuối ngày. Có 40% bầy sói phát hiện ra bạn.' },
  blacksmith: { name: 'Thợ rèn', emoji: '⚒️', team: TEAM.VILLAGE, unique: true, summary: 'Một lần mỗi ván, ban ngày bạn rải bột bạc khắp làng: đêm đó bầy sói (kể cả Sói tuyết) không dám ra tay.' },
  sandman: { name: 'Thần ngủ', emoji: '💤', team: TEAM.VILLAGE, unique: true, summary: 'Một lần mỗi ván, ban ngày bạn ru cả làng ngủ say: đêm đó không ai dùng được kỹ năng, kể cả sói.' },
  beholder: { name: 'Người quan sát', emoji: '👁️', team: TEAM.VILLAGE, unique: true, summary: 'Bạn biết ai là Tiên tri thật. Nếu có người lên thay Tiên tri, bạn cũng được báo.' },
  oracle: { name: 'Nhà tiên đoán', emoji: '🌀', team: TEAM.VILLAGE, unique: true, summary: 'Mỗi đêm chọn một người để biết một vai mà họ KHÔNG phải — vai đó chắc chắn đang có người sống giữ.' },
  augur: { name: 'Thầy bói chim', emoji: '🦅', team: TEAM.VILLAGE, unique: true, summary: 'Mỗi sáng nhìn chim bay để biết một vai chắc chắn KHÔNG có trong làng lúc này, không bao giờ lặp lại.' },
  // ── Phe dân: gói đổi phe ──
  wild_child: { name: 'Đứa trẻ hoang', emoji: '👶', team: TEAM.VILLAGE, unique: true, summary: 'Đêm đầu chọn một người làm hình mẫu. Hình mẫu còn sống thì bạn là dân; hình mẫu chết thì bạn hoá sói.' },
  cult_hunter: { name: 'Thợ săn tà giáo', emoji: '💂', team: TEAM.VILLAGE, unique: true, summary: 'Mỗi đêm đi săn một người: trúng tín đồ tà giáo thì hạ gục ngay. Tà giáo không thể chiêu mộ bạn, tín đồ nào mò tới là chết.' },
  // ── Phe sói ──
  wolf: { name: 'Ma sói', emoji: '🐺', team: TEAM.WOLF, summary: 'Mỗi đêm cùng bầy sói chọn một người để ăn thịt. Thắng khi số sói bằng số người còn lại.' },
  alpha_wolf: { name: 'Sói đầu đàn', emoji: '⚡', team: TEAM.WOLF, unique: true, summary: 'Là sói. Khi bạn còn sống, nạn nhân của bầy có 20% bị cắn hoá sói thay vì chết (hoá vào đêm kế tiếp).' },
  wolf_cub: { name: 'Sói con', emoji: '🐶', team: TEAM.WOLF, unique: true, summary: 'Là sói. Nếu bạn chết, đêm tiếp theo bầy sói nổi giận và được giết hai người.' },
  lycan: { name: 'Sói đội lốt', emoji: '🌝', team: TEAM.WOLF, unique: true, summary: 'Là sói, đi săn cùng bầy. Nhưng Tiên tri soi bạn sẽ chỉ thấy một dân làng bình thường.' },
  snow_wolf: { name: 'Sói tuyết', emoji: '☃️', team: TEAM.WOLF, unique: true, summary: 'Không đi săn cùng bầy mà mỗi đêm đóng băng một người: người đó mất kỹ năng đêm ấy (và được miễn đóng băng đêm sau). Khi bầy chết hết, bạn thành sói thường.' },
  sorcerer: { name: 'Pháp sư', emoji: '🔮', team: TEAM.WOLF, unique: true, summary: 'Theo phe sói nhưng bầy không biết bạn. Mỗi đêm soi một người để biết họ là sói, Tiên tri, hay không phải cả hai. Thắng khi sói thắng.' },
  // ── Đơn độc / trung lập ──
  tanner: { name: 'Kẻ chán đời', emoji: '👺', team: TEAM.TANNER, unique: true, summary: 'Chỉ có một mục tiêu: bị dân làng treo cổ. Nếu làm được, bạn thắng một mình và ván kết thúc.' },
  serial_killer: { name: 'Kẻ sát nhân', emoji: '🔪', team: TEAM.KILLER, unique: true, summary: 'Mỗi đêm giết một người. Ai mò tới nhà bạn thường sẽ chết. Thắng khi là người cuối cùng (hoặc chỉ còn bạn và một người).' },
  arsonist: { name: 'Kẻ phóng hoả', emoji: '🔥', team: TEAM.ARSONIST, unique: true, summary: 'Mỗi đêm tưới xăng một nhà, hoặc châm lửa đốt cùng lúc mọi nhà đã tưới. Ai ghé nhà đang cháy cũng chết. Thắng khi là người cuối cùng.' },
  cultist: { name: 'Tín đồ tà giáo', emoji: '👤', team: TEAM.CULT, summary: 'Mỗi đêm cả giáo phái bàn nhau chiêu mộ một người; tín đồ mới nhất đi gõ cửa. Thắng khi mọi người còn sống đều theo giáo phái.' },
  thief: { name: 'Kẻ trộm', emoji: '😈', team: TEAM.NEUTRAL, unique: true, summary: 'Đêm đầu tiên trộm vai của một người: bạn nhận vai (và phe) của họ, còn họ thành dân làng.' },
  doppelganger: { name: 'Kẻ bắt chước', emoji: '🎭', team: TEAM.NEUTRAL, unique: true, summary: 'Đêm đầu chọn một người. Khi người đó chết, bạn nhận luôn vai của họ. Chưa đổi vai thì bạn không thắng được.' },
}

// Bầy sói đi săn chung (bỏ phiếu cắn, biết mặt nhau)
const PACK_ROLES = ['wolf', 'alpha_wolf', 'wolf_cub', 'lycan']
// Tính là "sói" khi đếm quân số và khi sói nhìn nhau (thêm Sói tuyết)
const WOLFISH_ROLES = [...PACK_ROLES, 'snow_wolf']

// Kẻ địch của dân làng khi cân phe (Kẻ bắt chước tính vào phía dân)
const NON_VILLAGE_ROLES = ['cultist', 'serial_killer', 'tanner', ...WOLFISH_ROLES, 'sorcerer', 'thief', 'arsonist']
// Vai "lộ diện" (công khai kỹ năng ban ngày) — không cho quá nhiều trong một ván
const REVEALED_VILLAGE_ROLES = ['blacksmith', 'mayor', 'gunner', 'sandman']

// Vai phe dân bốc ngẫu nhiên khi chia (mason thêm theo cặp, cult_hunter đi kèm tà giáo)
const VILLAGE_SPECIALS = [
  'seer', 'guardian', 'hunter', 'gunner', 'cupid', 'drunk', 'cursed',
  'mayor', 'prince', 'wise_elder', 'mason', 'apprentice_seer', 'traitor', 'fool',
  'harlot', 'detective', 'blacksmith', 'sandman', 'beholder', 'oracle', 'augur',
  'wild_child', 'doppelganger',
]

// Vai tà giáo không thể chiêu mộ (tính sức mạnh giáo phái)
const NON_CONVERTIBLE_ROLES = ['seer', 'guardian', 'detective', 'cursed', 'harlot', 'hunter', 'doppelganger', ...WOLFISH_ROLES, 'serial_killer', 'thief']

const TEAM_LABEL = {
  [TEAM.VILLAGE]: 'Dân làng',
  [TEAM.WOLF]: 'Bầy sói',
  [TEAM.TANNER]: 'Kẻ chán đời',
  [TEAM.KILLER]: 'Kẻ sát nhân',
  [TEAM.CULT]: 'Tà giáo',
  [TEAM.ARSONIST]: 'Kẻ phóng hoả',
  [TEAM.NEUTRAL]: 'Trung lập',
  [TEAM.LOVERS]: 'Đôi tình nhân',
  [TEAM.NONE]: 'Không ai',
}

const isPackRole = (role) => PACK_ROLES.includes(role)
const isWolfishRole = (role) => WOLFISH_ROLES.includes(role)
// Giữ tên cũ cho chỗ khác đang dùng: "sói" = cả bầy lẫn Sói tuyết
const isWolfRole = isWolfishRole

const teamOfRole = (role) => ROLES[role]?.team || TEAM.VILLAGE

// Điểm "sức mạnh" dùng để cân phe khi chia vai. Con số là tham số thiết kế game.
const strengthOf = (role, roles) => {
  const count = (key) => roles.filter((r) => r === key).length
  switch (role) {
    case 'villager': return 1
    case 'wolf': return 10
    case 'alpha_wolf': return 12
    case 'wolf_cub': return 11
    case 'lycan': return 10
    case 'snow_wolf': return 15
    case 'sorcerer': return 2
    case 'seer': return 7 - count('lycan')
    case 'guardian': return 7 + (roles.includes('arsonist') ? 1 : 0)
    case 'hunter': return 6
    case 'gunner': return 6
    case 'cupid': return 2
    case 'drunk': return 3
    case 'cursed': return 1 - Math.floor(roles.filter(isWolfishRole).length / 2)
    case 'mayor': return 4
    case 'prince': return 3
    case 'wise_elder': return 3
    case 'mason': return count('mason') <= 1 ? 1 : count('mason') + 3
    case 'apprentice_seer': return 6
    case 'traitor': return 0
    case 'fool': return 3
    case 'harlot': return 6
    case 'detective': return 6
    case 'blacksmith': return 5
    case 'sandman': return 3
    case 'beholder': return 1 + (roles.includes('seer') ? 4 : 0) + (roles.includes('fool') ? 1 : 0)
    case 'oracle': return 4
    case 'augur': return 5
    case 'wild_child': return 1
    case 'doppelganger': return 2
    case 'cult_hunter': return roles.includes('cultist') ? 7 : 1
    case 'tanner': return Math.floor(roles.length / 2)
    case 'serial_killer': return 15
    case 'arsonist': return 8
    case 'cultist': return 10 + roles.filter((r) => !NON_CONVERTIBLE_ROLES.includes(r)).length
    case 'thief': return 0
    default: return 1
  }
}

const roleLabel = (role) => {
  const def = ROLES[role]
  return def ? `${def.emoji} ${def.name}` : role
}

const publicCatalog = () =>
  Object.entries(ROLES).map(([key, def]) => ({
    key,
    name: def.name,
    emoji: def.emoji,
    team: def.team,
    summary: def.summary,
  }))

module.exports = {
  TEAM,
  TEAM_LABEL,
  ROLES,
  PACK_ROLES,
  WOLFISH_ROLES,
  NON_VILLAGE_ROLES,
  REVEALED_VILLAGE_ROLES,
  VILLAGE_SPECIALS,
  NON_CONVERTIBLE_ROLES,
  isPackRole,
  isWolfishRole,
  isWolfRole,
  teamOfRole,
  strengthOf,
  roleLabel,
  publicCatalog,
}
