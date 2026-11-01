import { calcDistance } from '../../utils/calcDistance.js'

// размеры в см

// ====== Определение констант ======
export const GRID_STEP = 50
export const MIN_LENGTH = 5
export const MAX_LENGTH = 10000

// id стены, например A-B
export const edgeId = (edge) => `${edge.from}-${edge.to}`

// ====== Создание чертежа ======
// стены по углам, последний угол соединяем с первым
export function buildWalls(corners) {
  return corners.map((corner, i) => {
    const next = corners[(i + 1) % corners.length]
    return { from: corner.id, to: next.id, length: calcDistance(corner, next) }
  })
}

export function createEmpty() {
  return { id: 'c1', title: 'Потолок 1', corners: [], walls: [], closed: false, options: {} }
}

export function createRectangle(length, width) {
  const corners = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 0, y: width },
    { id: 'C', x: length, y: width },
    { id: 'D', x: length, y: 0 }
  ]
  return { ...createEmpty(), corners, walls: buildWalls(corners), closed: true }
}
