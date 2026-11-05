import { calcDistance } from '../../utils/calcDistance.js'
import { isPointInside } from '../../utils/isPointInside.js'
import { segmentsIntersect } from '../../utils/segmentsIntersect.js'

// размеры в см

// ====== Определение констант ======
// как в Easy Ceiling, принимаем даже несколько сантиметров
export const MIN_LENGTH = 1
export const MAX_LENGTH = 10000
// как в Easy Ceiling, комната может быть треугольной
export const MIN_CORNERS = 3

// id стены, например A-B
export const edgeId = (edge) => `${edge.from}-${edge.to}`

// ====== Создание чертежа ======
// стены по углам, последний угол соединяем с первым
// введённые стены из previous остаются как есть
// mismatch - стены из этого списка не сошлись с остальными размерами
export function buildWalls(corners, previous = [], mismatch = []) {
  return corners.map((corner, i) => {
    const next = corners[(i + 1) % corners.length]
    const known = previous.find((wall) => wall.from === corner.id && wall.to === next.id)
    const wall = known && known.fixed ? known : { from: corner.id, to: next.id, length: calcDistance(corner, next), fixed: false }
    return { ...wall, mismatch: mismatch.includes(edgeId(wall)) }
  })
}

// номер потолка на странице: Потолок 1, Потолок 2...
export function createEmpty(number = 1) {
  return { id: `c${number}`, number, title: `Потолок ${number}`, corners: [], walls: [], diagonals: [], closed: false, options: {} }
}

export function createRectangle(length, width, number = 1) {
  const corners = [
    { id: 'A', x: 0, y: 0 },
    { id: 'B', x: 0, y: width },
    { id: 'C', x: length, y: width },
    { id: 'D', x: length, y: 0 }
  ]
  // длину и ширину ввели в полях, эти стены считаются введёнными
  const walls = buildWalls(corners).map((wall) => ({ ...wall, fixed: true }))
  // по длине и ширине углы прямые, диагонали не нужны, пока форма прямоугольная
  return { ...createEmpty(number), corners, walls, closed: true, fromSizes: true }
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

// все диагонали внутри комнаты, для справки
export function innerDiagonals(ceiling) {
  const { corners } = ceiling
  const result = []
  corners.forEach((a, i) => {
    corners.slice(i + 2).forEach((b) => {
      // первый и последний углы соединены стеной
      if (a === corners[0] && b === corners[corners.length - 1]) return
      if (isInnerDiagonal(corners, a, b)) result.push({ from: a.id, to: b.id, length: calcDistance(a, b), entered: false })
    })
  })
  return result
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
