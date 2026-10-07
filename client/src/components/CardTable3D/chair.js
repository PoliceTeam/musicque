import { BoxGeometry, Matrix4 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
export const CHAIR_HEIGHT = 0.45
export const CHAIR_RADIUS = 0.95
export function chairPlacement(relativeSeat) {
  const angle = relativeSeat * Math.PI / 2
  return { position: [-Math.sin(angle) * CHAIR_RADIUS, 0, Math.cos(angle) * CHAIR_RADIUS], yaw: Math.PI - angle }
}
export function chairGeometry() {
  const boxes = []
  const box = (size, position) => boxes.push(new BoxGeometry(...size).applyMatrix4(new Matrix4().makeTranslation(...position)))
  box([0.42, 0.03, 0.42], [0, CHAIR_HEIGHT - 0.015, 0])
  box([0.42, 0.45, 0.035], [0, CHAIR_HEIGHT + 0.225, -0.195])
  for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) box([0.03, CHAIR_HEIGHT - 0.03, 0.03], [x, (CHAIR_HEIGHT - 0.03) / 2, z])
  const geometry = mergeGeometries(boxes)
  boxes.forEach(part => part.dispose())
  return geometry
}
