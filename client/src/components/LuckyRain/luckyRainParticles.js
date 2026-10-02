import { REWARD_PRESENTATION } from './luckyRainPresentation'

// Random chỉ dùng cho hình ảnh; tiền thưởng luôn lấy từ server.
const between = (min, max) => min + Math.random() * (max - min)
const px = (value) => `${value.toFixed(2)}px`
const deg = (value) => `${value.toFixed(2)}deg`

function flight(duration, spread, index, firework = false) {
  const angle = between(-Math.PI, Math.PI)
  const velocityX = Math.cos(angle) * between(70, spread)
  const velocityY = Math.sin(angle) * between(90, spread) - 95
  const gravity = between(110, 340)
  const originX = between(-42, 42)
  const originY = between(-55, 30)
  const wind = between(-90, 90)
  const delay = between(.02, duration * .22)
  const spin = between(-1100, 1100)
  const style = {
    '--flight-delay': `${delay.toFixed(3)}s`,
    '--flight-duration': `${between(duration * .48, duration - delay - .08).toFixed(3)}s`,
    '--particle-size': px(firework ? between(2, 6) : between(14, 31)),
    '--start-x': px(originX), '--start-y': px(originY),
    '--start-angle': deg(between(-160, 160)),
    '--spin-mid': deg(spin * .48), '--spin-end': deg(spin),
    '--flip-mid': deg(between(-340, 340)), '--flip-end': deg(between(-780, 780)),
    '--flight-name': index % 3 === 0 ? 'lr-tumble' : 'lr-scatter',
    '--particle-hue': `${between(-16, 12).toFixed(1)}deg`,
  }
  for (const [step, time] of [[1, .24], [2, .48], [3, .74], [4, 1]]) {
    // Vận tốc, trọng lực và gió khác nhau cho từng hạt; có cả văng ngang,
    // bật lên, rơi sớm và đổi hướng, thay vì dùng chung một vòng cung.
    style[`--p${step}-x`] = px(originX + velocityX * time + wind * time * time + between(-22, 22))
    style[`--p${step}-y`] = px(originY + velocityY * time + gravity * time * time + between(-28, 28))
  }
  return style
}

export function createParticles(tier) {
  const duration = (REWARD_PRESENTATION[tier]?.duration || 1400) / 1000
  const count = { small: 14, bright: 22, grand: 36, legendary: 56 }[tier] || 14
  const spread = tier === 'legendary' ? 330 : tier === 'grand' ? 280 : 230
  return {
    coins: Array.from({ length: count }, (_, index) => flight(duration, spread, index)),
    sparks: Array.from({ length: tier === 'legendary' ? 68 : 40 }, (_, index) => flight(duration, spread + 60, index, true)),
    motes: Array.from({ length: 12 }, () => {
      const angle = between(0, Math.PI * 2)
      const radius = between(105, 160)
      return {
        '--anchor-x': px(Math.cos(angle) * radius),
        '--anchor-y': px(Math.sin(angle) * radius),
        '--wander-x': px(between(-35, 35)), '--wander-y': px(between(-45, 45)),
        '--wander-duration': `${between(3, 8).toFixed(2)}s`,
        '--wander-delay': `${between(-8, 0).toFixed(2)}s`,
        '--wander-angle': deg(between(-90, 90)),
        '--mote-size': px(between(5, 12)),
      }
    }),
  }
}
