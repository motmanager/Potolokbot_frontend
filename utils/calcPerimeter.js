import { calcDistance } from './calcDistance.js'

export function calcPerimeter(corners) {
  return corners.reduce((sum, corner, i) => sum + calcDistance(corner, corners[(i + 1) % corners.length]), 0)
}
