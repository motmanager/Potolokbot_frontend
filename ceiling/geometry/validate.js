import { orient, segmentsIntersect } from '../../utils/segmentsIntersect.js'
import { calcDistance } from '../../utils/calcDistance.js'
import { MIN_LENGTH, edgeId } from './measure.js'

// запас на погрешность подбора углов
const TOLERANCE = 0.01

// проверка контура
export function validate(ceiling) {
  if (!ceiling.closed) return []
  const { corners, walls } = ceiling
  const n = corners.length
  const errors = []
  const add = (a, b) => errors.push({
    message: `Стены пересекаются: ${a.from}${a.to} и ${b.from}${b.to}`,
    walls: [edgeId(a), edgeId(b)]
  })

  // как в Easy Ceiling: размеры с прямыми углами не сошлись, эти стены нарисованы без своего замера
  const mismatch = walls.filter((wall) => wall.mismatch)
  if (mismatch.length) {
    const names = mismatch.map((wall) => `${wall.from}${wall.to}`).join(' и ')
    errors.push({
      message: `Размеры не сходятся, стены ${names} нарисованы не по замеру. Проверьте замеры или введите диагонали`,
      walls: []
    })
  }

  for (let i = 0; i < n; i++) {
    if (calcDistance(corners[i], corners[(i + 1) % n]) < MIN_LENGTH - TOLERANCE) {
      errors.push({
        message: `Стена ${walls[i].from}${walls[i].to} короче ${MIN_LENGTH} см`,
        walls: [edgeId(walls[i])]
      })
    }
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
