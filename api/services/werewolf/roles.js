// Danh mục vai Ma Sói. Luật tham khảo từ GreyWolfDev/Werewolf nhưng mô tả,
// cách cài đặt và câu chữ đều viết mới cho musicque.

const TEAM = {
  VILLAGE: 'village',
  WOLF: 'wolf',
  TANNER: 'tanner',
  KILLER: 'killer',
  LOVERS: 'lovers',
  NONE: 'none',
}

const ROLES = {
  villager: {
    name: 'Dân làng',
    emoji: '👱',
    team: TEAM.VILLAGE,
    summary: 'Không có kỹ năng đặc biệt. Vũ khí của bạn là lý lẽ và lá phiếu ban ngày.',
  },
  wolf: {
    name: 'Ma sói',
    emoji: '🐺',
    team: TEAM.WOLF,
    summary: 'Mỗi đêm cùng bầy sói chọn một người để ăn thịt. Thắng khi số sói bằng số người còn lại.',
  },
  alpha_wolf: {
    name: 'Sói đầu đàn',
    emoji: '⚡',
    team: TEAM.WOLF,
    unique: true,
    summary: 'Là sói. Khi bạn còn sống, nạn nhân của bầy có 20% bị cắn hoá sói thay vì chết (hoá vào đêm kế tiếp).',
  },
  wolf_cub: {
    name: 'Sói con',
    emoji: '🐶',
    team: TEAM.WOLF,
    unique: true,
    summary: 'Là sói. Nếu bạn chết, đêm tiếp theo bầy sói nổi giận và được giết hai người.',
  },
  seer: {
    name: 'Tiên tri',
    emoji: '👳',
    team: TEAM.VILLAGE,
    unique: true,
    summary: 'Mỗi đêm chọn một người để biết chính xác vai của họ vào sáng hôm sau.',
  },
  guardian: {
    name: 'Thiên thần hộ mệnh',
    emoji: '👼',
    team: TEAM.VILLAGE,
    unique: true,
    summary: 'Mỗi đêm bảo vệ một người khác khỏi sói và sát nhân. Canh nhầm nhà sói thì có 50% bị ăn, canh nhà sát nhân thì chắc chắn chết.',
  },
  hunter: {
    name: 'Thợ săn',
    emoji: '🎯',
    team: TEAM.VILLAGE,
    unique: true,
    summary: 'Bị sói tấn công thì có cơ hội bắn chết một con. Chết theo cách khác (bị treo cổ, bị đâm…) thì được bắn một người trước khi gục.',
  },
  gunner: {
    name: 'Xạ thủ',
    emoji: '🔫',
    team: TEAM.VILLAGE,
    unique: true,
    summary: 'Có 2 viên đạn, mỗi ngày bắn tối đa một người vào ban ngày. Nổ súng là cả làng biết bạn là xạ thủ.',
  },
  cupid: {
    name: 'Thần tình yêu',
    emoji: '🏹',
    team: TEAM.VILLAGE,
    unique: true,
    summary: 'Đêm đầu tiên ghép đôi hai người (có thể gồm chính bạn). Một người chết, người kia chết theo. Nếu chỉ còn đúng hai người yêu nhau sống sót, họ thắng.',
  },
  drunk: {
    name: 'Bợm nhậu',
    emoji: '🍻',
    team: TEAM.VILLAGE,
    unique: true,
    summary: 'Không có kỹ năng. Nhưng sói nào ăn phải bạn sẽ say mèm, cả bầy không đi săn được vào đêm kế tiếp.',
  },
  cursed: {
    name: 'Kẻ bị nguyền',
    emoji: '😾',
    team: TEAM.VILLAGE,
    unique: true,
    summary: 'Bắt đầu là dân làng. Nếu bị sói tấn công, bạn không chết mà hoá thành sói và theo phe sói.',
  },
  tanner: {
    name: 'Kẻ chán đời',
    emoji: '👺',
    team: TEAM.TANNER,
    unique: true,
    summary: 'Chỉ có một mục tiêu: bị dân làng treo cổ. Nếu làm được, bạn thắng một mình và ván kết thúc.',
  },
  serial_killer: {
    name: 'Kẻ sát nhân',
    emoji: '🔪',
    team: TEAM.KILLER,
    unique: true,
    summary: 'Mỗi đêm giết một người. Sói mò tới nhà bạn thường sẽ chết. Thắng khi là người cuối cùng (hoặc chỉ còn bạn và một người).',
  },
}

const WOLF_ROLES = ['wolf', 'alpha_wolf', 'wolf_cub']
const VILLAGE_SPECIALS = ['seer', 'guardian', 'hunter', 'gunner', 'cupid', 'drunk', 'cursed']

const TEAM_LABEL = {
  [TEAM.VILLAGE]: 'Dân làng',
  [TEAM.WOLF]: 'Bầy sói',
  [TEAM.TANNER]: 'Kẻ chán đời',
  [TEAM.KILLER]: 'Kẻ sát nhân',
  [TEAM.LOVERS]: 'Đôi tình nhân',
  [TEAM.NONE]: 'Không ai',
}

const isWolfRole = (role) => WOLF_ROLES.includes(role)

const teamOfRole = (role) => ROLES[role]?.team || TEAM.VILLAGE

// Điểm "sức mạnh" dùng để cân phe khi chia vai. Con số là tham số thiết kế game.
const strengthOf = (role, roles) => {
  const wolfCount = roles.filter(isWolfRole).length
  switch (role) {
    case 'villager': return 1
    case 'wolf': return 10
    case 'alpha_wolf': return 12
    case 'wolf_cub': return 11
    case 'seer': return 7
    case 'guardian': return 7
    case 'hunter': return 6
    case 'gunner': return 6
    case 'cupid': return 2
    case 'drunk': return 3
    case 'cursed': return 1 - Math.floor(wolfCount / 2)
    case 'tanner': return Math.floor(roles.length / 2)
    case 'serial_killer': return 15
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
  WOLF_ROLES,
  VILLAGE_SPECIALS,
  isWolfRole,
  teamOfRole,
  strengthOf,
  roleLabel,
  publicCatalog,
}
