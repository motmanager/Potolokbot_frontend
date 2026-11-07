import { orient, segmentsIntersect } from '../../utils/segmentsIntersect.js'
import { calcDistance } from '../../utils/calcDistance.js'
import { formatNumber } from '../../utils/formatNumber.js'
import { roundLength } from '../../utils/roundLength.js'
import { MIN_LENGTH, edgeId } from './measure.js'

// запас на погрешность подбора углов
const TOLERANCE = 0.01
// контрольная диагональ сходится с чертежом, если разница не больше, см
const CONTROL_TOLERANCE = 1

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

  // как в Easy Ceiling: такой комнаты быть не может, эти стены нарисованы без своего замера
  const mismatch = walls.filter((wall) => wall.mismatch)
  if (mismatch.length) {
    const names = mismatch.map((wall) => `${wall.from}${wall.to}`).join(' и ')
    const text = mismatch.length > 1 ? `стены ${names} нарисованы` : `стена ${names} нарисована`
    errors.push({
      message: `Размеры не сходятся, ${text} не по замеру. Проверьте замеры`,
      walls: []
    })
  }

  // контрольная диагональ: сверяем с формой, только когда форма уже точная
  const structural = ceiling.diagonals.filter((diagonal) => !diagonal.control).length
  if (walls.every((wall) => wall.fixed) && structural >= n - 3) {
    ceiling.diagonals.filter((diagonal) => diagonal.control).forEach((diagonal) => {
      const corner = (id) => corners.find((item) => item.id === id)
      const real = calcDistance(corner(diagonal.from), corner(diagonal.to))
      if (Math.abs(real - diagonal.length) <= CONTROL_TOLERANCE) return
      errors.push({
        message: `Диагональ ${diagonal.from}${diagonal.to} по замеру ${formatNumber(diagonal.length)} см, а по остальным размерам выходит ${formatNumber(roundLength(real))} см. Проверьте замеры`,
        walls: [edgeId(diagonal)]
      })
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
