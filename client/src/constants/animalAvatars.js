export const ANIMAL_AVATARS = [
  { id: 'cat', label: 'Mèo' },
  { id: 'dog', label: 'Chó' },
  { id: 'panda', label: 'Gấu trúc' },
  { id: 'fox', label: 'Cáo' },
  { id: 'rabbit', label: 'Thỏ' },
  { id: 'tiger', label: 'Hổ' },
  { id: 'lion', label: 'Sư tử' },
  { id: 'bear', label: 'Gấu' },
  { id: 'koala', label: 'Koala' },
  { id: 'monkey', label: 'Khỉ' },
  { id: 'owl', label: 'Cú' },
  { id: 'penguin', label: 'Cánh cụt' },
  { id: 'duck', label: 'Vịt' },
  { id: 'chicken', label: 'Gà' },
  { id: 'frog', label: 'Ếch' },
  { id: 'turtle', label: 'Rùa' },
  { id: 'dolphin', label: 'Cá heo' },
  { id: 'whale', label: 'Cá voi' },
  { id: 'octopus', label: 'Bạch tuộc' },
  { id: 'hedgehog', label: 'Nhím' },
  { id: 'squirrel', label: 'Sóc' },
  { id: 'deer', label: 'Hươu' },
  { id: 'horse', label: 'Ngựa' },
  { id: 'sheep', label: 'Cừu' },
  { id: 'cow', label: 'Bò' },
  { id: 'pig', label: 'Heo' },
  { id: 'elephant', label: 'Voi' },
  { id: 'wolf', label: 'Sói' },
  { id: 'raccoon', label: 'Gấu mèo' },
  { id: 'hamster', label: 'Hamster' },
]

export const ANIMAL_AVATAR_IDS = ANIMAL_AVATARS.map((avatar) => avatar.id)

export const getAvatarUrl = (avatarId) => {
  const resolved = ANIMAL_AVATAR_IDS.includes(avatarId) ? avatarId : ANIMAL_AVATAR_IDS[0]
  return `/avatars/animals/${resolved}.png`
}

export const getStableAnimalAvatarId = (seed = '') => {
  const text = String(seed || '')
  let hash = 0

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 9973
  }

  return ANIMAL_AVATAR_IDS[Math.abs(hash) % ANIMAL_AVATAR_IDS.length]
}
