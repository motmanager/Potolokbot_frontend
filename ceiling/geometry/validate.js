import { orient, segmentsIntersect } from '../../utils/segmentsIntersect.js'

// проверка контура
export function validate(ceiling) {
  if (!ceiling.closed) return []
  const { corners, walls } = ceiling
  const n = corners.length
  const errors = []
  const add = (a, b) => errors.push({ message: `Стены пересекаются: ${a.from}${a.to} и ${b.from}${b.to}` })

  for (let i = 0; i < n; i++) {
    // несоседние стены
    for (let j = i + 2; j < n; j++) {
      // первая и последняя стены соседние
      if (i === 0 && j === n - 1) continue
      if (segmentsIntersect(corners[i], corners[(i + 1) % n], corners[j], corners[(j + 1) % n])) add(walls[i], walls[j])
    }
    // стена легла на соседнюю стену
    const prev = corners[(i + n - 1) % n]
    const next = corners[(i + 1) % n]
    const corner = corners[i]
    const dot = (prev.x - corner.x) * (next.x - corner.x) + (prev.y - corner.y) * (next.y - corner.y)
    if (orient(prev, corner, next) === 0 && dot > 0) add(walls[(i + n - 1) % n], walls[i])
  }
  return errors
}
