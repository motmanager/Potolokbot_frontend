import { calcDistance } from '../../utils/calcDistance.js'
import { formatNumber } from '../../utils/formatNumber.js'
import { roundLength } from '../../utils/roundLength.js'
import { MAX_LENGTH, MIN_CORNERS, MIN_LENGTH, buildWalls, edgeId } from './measure.js'
import { solve } from './solve.js'
import { validate } from './validate.js'

// ====== Построение по точкам ======
// точка ставится где нажали, с точностью до 1 см
export function roundPoint(point) {
  return { x: Math.round(point.x), y: Math.round(point.y) }
}

export function addPoint(ceiling, point) {
  const { corners } = ceiling
  const place = roundPoint(point)
  if (corners.some((corner) => corner.x === place.x && corner.y === place.y)) return ceiling
  const id = String.fromCharCode(65 + corners.length)
  return { ...ceiling, corners: [...corners, { id, ...place }] }
}

export function closeContour(ceiling) {
  const { corners } = ceiling
  if (corners.length < MIN_CORNERS) return { ceiling, error: 'Отметьте ещё углы. Комнате нужно минимум три' }
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
  if (ceiling.corners.length <= MIN_CORNERS) return { ceiling, error: 'Комнате нужно минимум три угла' }
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
  const place = roundPoint(point)
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

// ====== Масштаб наброска ======
// набросок без масштаба: ещё нет ни одного замера
const isSketch = (ceiling) => !ceiling.walls.some((wall) => wall.fixed) && !ceiling.diagonals.length

// первый замер задаёт масштаб: форма та же, все размеры пропорционально
function scaleSketch(ceiling, ratio) {
  console.log('ratio', ratio)
  const corners = ceiling.corners.map((corner) => ({ ...corner, x: corner.x * ratio, y: corner.y * ratio }))
  return { ...ceiling, corners, walls: buildWalls(corners, ceiling.walls) }
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
  if (isSketch(ceiling)) return { ceiling: scaleSketch(updated, length / wall.length), error: '' }

  const solved = solve(updated)
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
  if (isSketch(ceiling)) {
    const corner = (id) => ceiling.corners.find((item) => item.id === id)
    return { ceiling: scaleSketch(updated, length / calcDistance(corner(from), corner(to))), error: '' }
  }
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
