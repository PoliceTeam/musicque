const ANIMAL_AVATAR_IDS = [
  'cat',
  'dog',
  'panda',
  'fox',
  'rabbit',
  'tiger',
  'lion',
  'bear',
  'koala',
  'monkey',
  'owl',
  'penguin',
  'duck',
  'chicken',
  'frog',
  'turtle',
  'dolphin',
  'whale',
  'octopus',
  'hedgehog',
  'squirrel',
  'deer',
  'horse',
  'sheep',
  'cow',
  'pig',
  'elephant',
  'wolf',
  'raccoon',
  'hamster',
]

const isValidAvatarId = (avatarId) => ANIMAL_AVATAR_IDS.includes(avatarId)

const getStableAvatarId = (seed = '') => {
  const text = String(seed || '')
  let hash = 0

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 9973
  }

  return ANIMAL_AVATAR_IDS[Math.abs(hash) % ANIMAL_AVATAR_IDS.length]
}

module.exports = {
  ANIMAL_AVATAR_IDS,
  isValidAvatarId,
  getStableAvatarId,
}
