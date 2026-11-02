import { calcDistance } from '../../utils/calcDistance.js'
import { GRID_STEP, MAX_LENGTH, MIN_LENGTH, buildWalls, edgeId } from './measure.js'
import { solve } from './solve.js'
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

// ====== Добавление и удаление углов ======
// первая свободная буква
function nextCornerId(corners) {
  let code = 65
  while (corners.some((corner) => corner.id === String.fromCharCode(code))) code++
  return String.fromCharCode(code)
}

// новый угол на середине стены
export function addCorner(ceiling, wallId) {
  const { corners, walls } = ceiling
  const index = walls.findIndex((wall) => edgeId(wall) === wallId)
  const a = corners[index]
  const b = corners[(index + 1) % corners.length]
  const corner = { id: nextCornerId(corners), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  console.log(corner)
  const next = [...corners.slice(0, index + 1), corner, ...corners.slice(index + 1)]
  return { ...ceiling, corners: next, walls: buildWalls(next) }
}

export function removeCorner(ceiling, cornerId) {
  if (ceiling.corners.length <= 4) return { ceiling, error: 'Комнате нужно минимум четыре угла' }
  const corners = ceiling.corners.filter((corner) => corner.id !== cornerId)
  const walls = buildWalls(corners)
  // убираем диагонали этого угла и те, что теперь совпали со стеной
  const isWall = (diagonal) => walls.some((wall) =>
    (wall.from === diagonal.from && wall.to === diagonal.to) || (wall.from === diagonal.to && wall.to === diagonal.from))
  const diagonals = ceiling.diagonals.filter((diagonal) =>
    diagonal.from !== cornerId && diagonal.to !== cornerId && !isWall(diagonal))
  const updated = { ...ceiling, corners, walls, diagonals }
  console.log('diagonals', diagonals)
  if (validate(updated).length) return { ceiling, error: `Угол ${cornerId} нельзя удалить: стены пересекутся` }
  return { ceiling: updated, error: '' }
}

// ====== Изменение длины стены ======
// сдвигаем часть контура, разницу забирает параллельная стена
export function setWallLength(ceiling, wallId, length) {
  const { corners, walls, diagonals } = ceiling
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
    // сдвиг изменил бы введённую диагональ
    if (diagonals.some((diagonal) => moved.has(diagonal.from) !== moved.has(diagonal.to))) continue
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

  // параллельной стены нет, перестраиваем по размерам
  const updated = { ...ceiling, walls: walls.map((item, i) => (i === index ? { ...item, length } : item)) }
  const solved = solve(updated)
  if (solved) return { ceiling: { ...updated, corners: solved, walls: buildWalls(solved) }, error: '' }
  return { ceiling, error: `Стену ${name} нельзя сделать длиной ${length} см: размеры не сходятся` }
}

// ====== Ввод диагонали ======
export function setDiagonal(ceiling, from, to, length) {
  const name = `${from}${to}`
  if (isNaN(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
    return { ceiling, error: `Диагональ ${name}: укажите размер от ${MIN_LENGTH} до ${MAX_LENGTH} см` }
  }

  const others = ceiling.diagonals.filter((diagonal) => diagonal.from !== from || diagonal.to !== to)
  const updated = { ...ceiling, diagonals: [...others, { from, to, length }] }
  console.log('here', updated.diagonals)
  const solved = solve(updated)
  if (solved) return { ceiling: { ...updated, corners: solved, walls: buildWalls(solved) }, error: '' }
  return { ceiling, error: `Диагональ ${name} нельзя сделать длиной ${length} см: размеры не сходятся` }
}
