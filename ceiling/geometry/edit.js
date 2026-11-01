import { calcDistance } from '../../utils/calcDistance.js'
import { GRID_STEP, MAX_LENGTH, MIN_LENGTH, buildWalls, edgeId } from './measure.js'
import { validate } from './validate.js'

// ====== Построение по точкам ======
const toGrid = (value) => Math.round(value / GRID_STEP) * GRID_STEP

// точка на пересечении сетки
export function snapToGrid(point, previous) {
  if (!previous) return { x: toGrid(point.x), y: toGrid(point.y) }
  // стена по горизонтали или вертикали
  if (Math.abs(point.x - previous.x) >= Math.abs(point.y - previous.y)) {
    return { x: toGrid(point.x), y: previous.y }
  }
  return { x: previous.x, y: toGrid(point.y) }
}

export function addPoint(ceiling, point) {
  const { corners } = ceiling
  const place = snapToGrid(point, corners[corners.length - 1])
  if (corners.some((corner) => corner.x === place.x && corner.y === place.y)) return ceiling
  const id = String.fromCharCode(65 + corners.length)
  return { ...ceiling, corners: [...corners, { id, ...place }] }
}

export function closeContour(ceiling) {
  const { corners } = ceiling
  if (corners.length < 4) return { ceiling, error: 'Отметьте ещё углы. Комнате нужно минимум четыре' }
  const first = corners[0]
  const last = corners[corners.length - 1]
  // последний угол на одной линии с первым
  if (first.x !== last.x && first.y !== last.y) {
    return { ceiling, error: `Угол ${last.id} должен быть на одной линии с точкой ${first.id}` }
  }
  return { ceiling: { ...ceiling, walls: buildWalls(corners), closed: true }, error: '' }
}

// ====== Изменение длины стены ======
// сдвигаем часть контура, разницу забирает параллельная стена
export function setWallLength(ceiling, wallId, length) {
  const { corners, walls } = ceiling
  const index = walls.findIndex((wall) => edgeId(wall) === wallId)
  const wall = walls[index]
  const name = `${wall.from}${wall.to}`

  if (isNaN(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
    return { ceiling, error: `Стена ${name}: укажите размер от ${MIN_LENGTH} до ${MAX_LENGTH} см` }
  }

  const n = corners.length
  const a = corners[index]
  const b = corners[(index + 1) % n]
  const old = calcDistance(a, b)
  // сдвиг конца стены
  const dx = (b.x - a.x) / old * (length - old)
  const dy = (b.y - a.y) / old * (length - old)

  // ищем параллельную стену, k - сколько углов сдвигаем
  for (let k = 1; k < n; k++) {
    const from = corners[(index + k) % n]
    const to = corners[(index + k + 1) % n]
    // проверка на параллельность
    const parallel = Math.abs((to.x - from.x) * (b.y - a.y) - (to.y - from.y) * (b.x - a.x)) < 1e-6
    if (!parallel) continue

    // сдвигаем углы
    const moved = new Set()
    for (let m = 1; m <= k; m++) moved.add(corners[(index + m) % n].id)
    console.log('moved', k, moved)
    const shifted = corners.map((corner) =>
      moved.has(corner.id) ? { ...corner, x: corner.x + dx, y: corner.y + dy } : corner)

    const newFrom = shifted[(index + k) % n]
    const newTo = shifted[(index + k + 1) % n]
    // стена не должна вывернуться или стать слишком короткой
    const sameDirection = (newTo.x - newFrom.x) * (to.x - from.x) + (newTo.y - newFrom.y) * (to.y - from.y) > 0
    if (!sameDirection || calcDistance(newFrom, newTo) < MIN_LENGTH) continue

    // проверка на пересечения
    const candidate = { ...ceiling, corners: shifted, walls: buildWalls(shifted) }
    if (!validate(candidate).length) return { ceiling: candidate, error: '' }
  }
  return { ceiling, error: `Стену ${name} нельзя сделать длиной ${length} см: стены пересекутся` }
}
