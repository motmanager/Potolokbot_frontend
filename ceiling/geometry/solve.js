import { validate } from './validate.js'

// ====== Определение констант ======
const ITERATIONS = 20000
const ACCURACY = 0.001
const ATTEMPTS = 6

// ====== Подбор углов ======
// по очереди подгоняем каждый размер, пока все не сойдутся
function relax(points, edges) {
  for (let step = 0; step < ITERATIONS; step++) {
    let worst = 0
    for (const { from, to, length } of edges) {
      const a = points[from]
      const b = points[to]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distance = Math.hypot(dx, dy) || 1e-9
      const part = (distance - length) / distance / 2
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

// ====== Построение по размерам ======
// углы по длинам стен и диагоналей, null - если размеры не сходятся
export function solve(ceiling) {
  const { corners, walls, diagonals } = ceiling
  const index = new Map(corners.map((corner, i) => [corner.id, i]))
  const edges = [...walls, ...diagonals].map((edge) => ({
    from: index.get(edge.from),
    to: index.get(edge.to),
    length: edge.length
  }))

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    // следующая попытка с небольшим сдвигом: помогает, когда углы на одной прямой
    const points = corners.map((corner, i) => ({
      x: corner.x + attempt * Math.sin(i + 1),
      y: corner.y + attempt * Math.cos(i + 1)
    }))
    if (!relax(points, edges)) continue
    const solved = align(points, corners)
    console.log('attempt', attempt, solved)
    if (!validate({ ...ceiling, corners: solved }).length) return solved
  }
  return null
}
