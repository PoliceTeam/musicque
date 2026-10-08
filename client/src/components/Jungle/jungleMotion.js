import { isWater, squareToWorld } from '../../utils/jungle'

// Mặt trên của ô đất / ô nước (tile Kenney cao 0.2 / 0.1).
export const LAND_TOP = 0.2
export const WATER_TOP = 0.1

export const WALK_MS = 460
export const JUMP_MS = 980
export const moveDuration = (event) => (event?.jump ? JUMP_MS : WALK_MS)

// Quân đang bơi chìm xuống để chỉ ló phần trên khỏi mặt nước.
const SWIM_DEPTH = 0.16
export const pieceWorld = (square) => {
  const [x, , z] = squareToWorld(square)
  return [x, isWater(square) ? WATER_TOP - SWIM_DEPTH : LAND_TOP, z]
}
