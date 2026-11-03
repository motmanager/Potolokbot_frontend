import { calcDistance } from '../../utils/calcDistance.js'
import { isPointInside } from '../../utils/isPointInside.js'
import { segmentsIntersect } from '../../utils/segmentsIntersect.js'

// размеры в см

// ====== Определение констант ======
export const GRID_STEP = 50
export const MIN_LENGTH = 5
export const MAX_LENGTH = 10000

// id стены, например A-B
export const edgeId = (edge) => `${edge.from}-${edge.to}`

// ====== Создание чертежа ======
// стены по углам, последний угол соединяем с первым
// введённые стены из previous остаются как есть
export function buildWalls(corners, previous = []) {
  return corners.map((corner, i) => {
    const next = corners[(i + 1) % corners.length]
    const known = previous.find((wall) => wall.from === corner.id && wall.to === next.id)
    if (known && known.fixed) return known
    return { from: corner.id, to: next.id, length: calcDistance(corner, next), fixed: false }
  })
}

export function createEmpty() {
  return { id: 'c1', title: 'Потолок 1', corners: [], walls: [], diagonals: [], closed: false, options: {} }
}

export function createRectangle(length, width) {
  const corners = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 0, y: width },
    { id: 'C', x: length, y: width },
    { id: 'D', x: length, y: 0 }
  ]
  // длину и ширину ввели в полях, эти стены считаются введёнными
  const walls = buildWalls(corners).map((wall) => ({ ...wall, fixed: true }))
  return { ...createEmpty(), corners, walls, closed: true }
}

// ====== Диагонали ======
// диагональ идёт внутри комнаты и не задевает стены и другие углы
function isInnerDiagonal(corners, a, b) {
  const isEnd = (corner) => corner === a || corner === b
  for (let i = 0; i < corners.length; i++) {
    const p = corners[i]
    const q = corners[(i + 1) % corners.length]
    if (!isEnd(p) && segmentsIntersect(a, b, p, p)) return false
    if (!isEnd(p) && !isEnd(q) && segmentsIntersect(a, b, p, q)) return false
  }
  return isPointInside({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, corners)
}

// нужные диагонали: введённые и самые короткие, которые их не пересекают, всего n - 3
export function roomDiagonals(ceiling) {
  const { corners, diagonals } = ceiling
  const position = new Map(corners.map((corner) => [corner.id, corner]))
  const result = diagonals.map((diagonal) => ({ ...diagonal, entered: true }))

  const crosses = (a, b, diagonal) => {
    const c = position.get(diagonal.from)
    const d = position.get(diagonal.to)
    if (a === c || a === d || b === c || b === d) return false
    return segmentsIntersect(a, b, c, d)
  }

  const candidates = []
  corners.forEach((a, i) => {
    corners.slice(i + 2).forEach((b) => {
      // первый и последний углы соединены стеной
      if (a === corners[0] && b === corners[corners.length - 1]) return
      candidates.push({ from: a.id, to: b.id, length: calcDistance(a, b), entered: false })
    })
  })
  candidates.sort((x, y) => x.length - y.length)

  for (const candidate of candidates) {
    const a = position.get(candidate.from)
    const b = position.get(candidate.to)
    const taken = result.some((item) => item.from === candidate.from && item.to === candidate.to)
    if (taken || !isInnerDiagonal(corners, a, b) || result.some((item) => crosses(a, b, item))) continue
    result.push(candidate)
  }
  return result.sort((x, y) => edgeId(x).localeCompare(edgeId(y)))
}
