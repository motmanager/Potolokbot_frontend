import { formatNumber } from '../../utils/formatNumber.js'
import { roundLength } from '../../utils/roundLength.js'
import { GRID_STEP, MAX_LENGTH, MIN_LENGTH, buildWalls, edgeId } from './measure.js'
import { solve } from './solve.js'
import { validate } from './validate.js'

// ====== Построение по точкам ======
const toGrid = (value) => Math.round(value / GRID_STEP) * GRID_STEP

// точка на пересечении сетки
export function snapToGrid(point) {
  return { x: toGrid(point.x), y: toGrid(point.y) }
}

export function addPoint(ceiling, point) {
  const { corners } = ceiling
  const place = snapToGrid(point)
  if (corners.some((corner) => corner.x === place.x && corner.y === place.y)) return ceiling
  const id = String.fromCharCode(65 + corners.length)
  return { ...ceiling, corners: [...corners, { id, ...place }] }
}

export function closeContour(ceiling) {
  const { corners } = ceiling
  if (corners.length < 4) return { ceiling, error: 'Отметьте ещё углы. Комнате нужно минимум четыре' }
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
  const wall = walls[index]
  // после деления обе части должны быть не короче минимума
  if (wall.length < MIN_LENGTH * 2) {
    return { ceiling, error: `Стена ${wall.from}${wall.to} короткая, угол не поместится. Нужно от ${MIN_LENGTH * 2} см` }
  }
  const a = corners[index]
  const b = corners[(index + 1) % corners.length]
  const corner = { id: nextCornerId(corners), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  console.log(corner)
  const next = [...corners.slice(0, index + 1), corner, ...corners.slice(index + 1)]
  return { ceiling: { ...ceiling, corners: next, walls: buildWalls(next, walls) }, error: '' }
}

export function removeCorner(ceiling, cornerId) {
  if (ceiling.corners.length <= 4) return { ceiling, error: 'Комнате нужно минимум четыре угла' }
  const corners = ceiling.corners.filter((corner) => corner.id !== cornerId)
  const walls = buildWalls(corners, ceiling.walls)
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

// перетаскивание, диагонали этого угла больше не верны
export function moveCorner(ceiling, cornerId, point) {
  const place = snapToGrid(point)
  const { corners, walls, diagonals } = ceiling
  if (corners.some((corner) => corner.x === place.x && corner.y === place.y)) return ceiling
  const next = corners.map((corner) => (corner.id === cornerId ? { ...corner, ...place } : corner))
  console.log('moveCorner', cornerId, place)
  // стены этого угла изменились, их замеры больше не верны
  const kept = walls.filter((wall) => wall.from !== cornerId && wall.to !== cornerId)
  return {
    ...ceiling,
    corners: next,
    walls: buildWalls(next, kept),
    diagonals: diagonals.filter((diagonal) => diagonal.from !== cornerId && diagonal.to !== cornerId)
  }
}

// ====== Изменение длины стены ======
// остальные размеры сохраняем, меняются только углы
export function setWallLength(ceiling, wallId, length) {
  const { walls } = ceiling
  const index = walls.findIndex((wall) => edgeId(wall) === wallId)
  const wall = walls[index]
  const name = `${wall.from}${wall.to}`

  if (isNaN(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
    return { ceiling, error: `Стена ${name}: укажите размер от ${MIN_LENGTH} до ${MAX_LENGTH} см` }
  }

  const updated = { ...ceiling, walls: walls.map((item, i) => (i === index ? { ...item, length, fixed: true } : item)) }
  const solved = solve(updated, true)
  console.log('fixed', updated.walls.filter((item) => item.fixed))
  if (solved) return { ceiling: { ...updated, corners: solved, walls: buildWalls(solved, updated.walls) }, error: '' }
  return { ceiling, error: `Стену ${name} нельзя сделать длиной ${length} см: размеры не сходятся` }
}

// ====== Ввод диагонали ======
// стены с более короткой стороны диагонали: длиннее их суммы она быть не может
function shorterSide(ceiling, from, to) {
  const { walls } = ceiling
  const start = walls.findIndex((wall) => wall.from === from)
  const ordered = [...walls.slice(start), ...walls.slice(0, start)]
  const middle = ordered.findIndex((wall) => wall.to === to) + 1
  const sides = [ordered.slice(0, middle), ordered.slice(middle)]
  const sum = (side) => side.reduce((total, wall) => total + wall.length, 0)
  return sum(sides[0]) < sum(sides[1]) ? sides[0] : sides[1]
}

export function setDiagonal(ceiling, from, to, length) {
  const name = `${from}${to}`
  if (isNaN(length) || length < MIN_LENGTH || length > MAX_LENGTH) {
    return { ceiling, error: `Диагональ ${name}: укажите размер от ${MIN_LENGTH} до ${MAX_LENGTH} см` }
  }

  const others = ceiling.diagonals.filter((diagonal) => diagonal.from !== from || diagonal.to !== to)
  const updated = { ...ceiling, diagonals: [...others, { from, to, length }] }
  console.log('here', updated.diagonals)
  const solved = solve(updated)
  if (solved) return { ceiling: { ...updated, corners: solved, walls: buildWalls(solved, updated.walls) }, error: '' }
  const side = shorterSide(ceiling, from, to)
  const limit = side.reduce((total, wall) => total + wall.length, 0)
  console.log('limit', limit)
  if (length >= limit) {
    const names = side.map((wall) => `${wall.from}${wall.to}`).join(', ')
    return { ceiling, error: `Диагональ ${name} нельзя сделать длиной ${formatNumber(length)} см: стены ${names} вместе ${formatNumber(roundLength(limit))} см` }
  }
  return { ceiling, error: `Диагональ ${name} нельзя сделать длиной ${formatNumber(length)} см: размеры не сходятся` }
}
