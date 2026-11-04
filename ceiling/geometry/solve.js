import { validate } from './validate.js'

// ====== Определение констант ======
const ITERATIONS = 20000
const ACCURACY = 0.001
const ATTEMPTS = 6
// углы наброска держим мягко, почти прямой угол считаем прямым
const ANGLE_ITERATIONS = 3000
const ANGLE_WEIGHT = 0.5
const RIGHT_ANGLE_TOLERANCE = Math.sin(15 * Math.PI / 180)

// ====== Подбор углов ======
// по очереди подгоняем каждый размер, пока все не сойдутся
function relax(points, edges, iterations = ITERATIONS) {
  for (let step = 0; step < iterations; step++) {
    let worst = 0
    for (const { from, to, length, weight = 1 } of edges) {
      const a = points[from]
      const b = points[to]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distance = Math.hypot(dx, dy) || 1e-9
      const part = (distance - length) / distance / 2 * weight
      worst = Math.max(worst, Math.abs(distance - length))
      a.x += dx * part
      a.y += dy * part
      b.x -= dx * part
      b.y -= dy * part
    }
    if (worst < ACCURACY) return true
  }
  return false
}

// чертёж не должен поворачиваться: первая стена остаётся на месте
function align(points, corners) {
  const [a, b] = corners
  const [p, q] = points
  const angle = Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(q.y - p.y, q.x - p.x)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return corners.map((corner, i) => {
    const dx = points[i].x - p.x
    const dy = points[i].y - p.y
    return { ...corner, x: a.x + dx * cos - dy * sin, y: a.y + dx * sin + dy * cos }
  })
}

// ====== Углы наброска ======
// угол задаём расстоянием между соседними углами: по двум стенам и косинусу угла
function angleEdges(corners, walls) {
  const n = corners.length
  return corners.map((corner, i) => {
    const prev = corners[(i + n - 1) % n]
    const next = corners[(i + 1) % n]
    const a = walls[(i + n - 1) % n].length
    const b = walls[i].length
    const ux = prev.x - corner.x
    const uy = prev.y - corner.y
    const vx = next.x - corner.x
    const vy = next.y - corner.y
    let cos = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1)
    if (Math.abs(cos) < RIGHT_ANGLE_TOLERANCE) cos = 0
    const length = Math.sqrt(Math.max(a * a + b * b - 2 * a * b * cos, 0))
    return { from: (i + n - 1) % n, to: (i + 1) % n, length, weight: ANGLE_WEIGHT }
  })
}

// ====== Построение по размерам ======
// углы по длинам стен и диагоналей, null - если размеры не сходятся
export function solve(ceiling, canStretch = false) {
  const { corners, walls, diagonals } = ceiling
  const index = new Map(corners.map((corner, i) => [corner.id, i]))
  const toEdge = (edge) => ({ from: index.get(edge.from), to: index.get(edge.to), length: edge.length })
  const all = [...walls, ...diagonals].map(toEdge)
  // если не сошлось, невведённые стены могут изменить длину
  const entered = [...walls.filter((wall) => wall.fixed), ...diagonals].map(toEdge)
  const angles = angleEdges(corners, walls)

  for (let attempt = 0; attempt < (canStretch ? ATTEMPTS * 2 : ATTEMPTS); attempt++) {
    const edges = attempt < ATTEMPTS ? all : entered
    // следующая попытка с небольшим сдвигом: помогает, когда углы на одной прямой
    const points = corners.map((corner, i) => ({
      x: corner.x + attempt * Math.sin(i + 1),
      y: corner.y + attempt * Math.cos(i + 1)
    }))
    // сначала форма как на наброске, потом точно подгоняем размеры
    relax(points, [...edges, ...angles], ANGLE_ITERATIONS)
    if (!relax(points, edges)) continue
    const solved = align(points, corners)
    console.log('attempt', attempt, solved)
    if (!validate({ ...ceiling, corners: solved }).length) return solved
  }
  return null
}
