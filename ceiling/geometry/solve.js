// ====== Определение констант ======
const ITERATIONS = 100
const ACCURACY = 0.01
// поворот стены дороже, чем изменение длины неизмеренной стены: сначала меняются они
const ANGLE_WEIGHT = 20
// почти прямой угол считаем прямым, как Easy Ceiling
const RIGHT_ANGLE_TOLERANCE = 25 * Math.PI / 180
// стена короче этого на наброске не задаёт направление: её углы почти в одной точке
const SHORT_WALL = 30

// ====== Углы наброска ======
const normalize = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle))

function direction(corners, i) {
  const a = corners[i]
  const b = corners[(i + 1) % corners.length]
  return Math.atan2(b.y - a.y, b.x - a.x)
}

// направления стен как на наброске, почти прямые углы становятся прямыми
function sketchDirections(corners, walls) {
  const n = corners.length
  // поворот на каждом углу: от предыдущей стены к следующей
  const turns = corners.map((_, i) => normalize(direction(corners, i) - direction(corners, (i + n - 1) % n)))
  const right = turns.map((turn) => Math.abs(Math.abs(turn) - Math.PI / 2) < RIGHT_ANGLE_TOLERANCE)
  const snapped = turns.map((turn, i) => (right[i] ? Math.sign(turn) * Math.PI / 2 : turn))

  // короткая стена на наброске повёрнута случайно (её углы почти в одной точке),
  // поэтому смотрим на её соседей: ниша или ступенька, как в Easy Ceiling стена встаёт под прямым углом
  walls.forEach((wall, i) => {
    if (wall.length >= SHORT_WALL) return
    const next = (i + 1) % n
    const both = turns[i] + turns[next]
    const quarter = Math.PI / 2
    // соседи смотрят в разные стороны - ниша, оба угла поворачивают в одну сторону
    if (Math.abs(Math.abs(both) - Math.PI) < RIGHT_ANGLE_TOLERANCE) {
      snapped[i] = snapped[next] = Math.sign(both) * quarter
    // соседи параллельны - ступенька, углы поворачивают в разные стороны
    } else if (Math.abs(both) < RIGHT_ANGLE_TOLERANCE) {
      snapped[i] = Math.sign(turns[i]) * quarter
      snapped[next] = -snapped[i]
    } else return
    console.log('short wall', wall.from + wall.to, snapped[i])
    right[i] = right[next] = true
  })

  // контур замыкается, только если повороты в сумме дают полный оборот:
  // остаток делим между углами, которые не выпрямляли
  const full = Math.round(turns.reduce((sum, turn) => sum + turn, 0) / (2 * Math.PI)) * 2 * Math.PI
  const rest = full - snapped.reduce((sum, turn) => sum + turn, 0)
  const free = right.filter((item) => !item).length
  const fixed = snapped.map((turn, i) => turn + (free ? (right[i] ? 0 : rest / free) : rest / n))

  // направление берём от самой длинной стены: у короткой оно случайное
  const relative = [0]
  for (let i = 1; i < n; i++) relative.push(relative[i - 1] + fixed[i])
  const longest = walls.reduce((best, wall, i) => (wall.length > walls[best].length ? i : best), 0)
  const shift = direction(corners, longest) - relative[longest]
  return relative.map((value) => value + shift)
}

// ====== Линейная алгебра ======
// система m x m методом Гаусса, null - если решения нет
function solveLinear(matrix, values) {
  const m = values.length
  const a = matrix.map((row, i) => [...row, values[i]])
  for (let col = 0; col < m; col++) {
    let pivot = col
    for (let row = col + 1; row < m; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    if (Math.abs(a[pivot][col]) < 1e-12) return null
    ;[a[col], a[pivot]] = [a[pivot], a[col]]
    for (let row = 0; row < m; row++) {
      if (row === col) continue
      const factor = a[row][col] / a[col][col]
      for (let k = col; k <= m; k++) a[row][k] -= factor * a[col][k]
    }
  }
  return a.map((row, i) => row[m] / row[i])
}

// ====== Построение по размерам ======
// форма, которая меньше всего отличается от наброска:
// введённые стены и диагонали точно, углы наброска по возможности, неизмеренные стены уступают первыми
// null - если размеры не сходятся. Пересечение стен не мешает, как в Easy Ceiling: ошибка видна на чертеже
export function solve(ceiling) {
  const { corners, walls, diagonals } = ceiling
  const n = corners.length
  const index = new Map(corners.map((corner, i) => [corner.id, i]))

  // неизвестные: направление каждой стены и длина каждой неизмеренной стены (в долях от наброска)
  const free = walls.map((wall, i) => (wall.fixed ? -1 : i)).filter((i) => i !== -1)
  const slot = new Map(free.map((wall, k) => [wall, n + k]))
  const target = [...sketchDirections(corners, walls), ...free.map(() => 1)]
  const weight = target.map((_, k) => (k < n ? ANGLE_WEIGHT : 1))
  const x = [...target]
  const length = (i) => (slot.has(i) ? walls[i].length * x[slot.get(i)] : walls[i].length)

  // ограничения: контур замкнут и введённые диагонали нужной длины
  const spans = [[0, n, 0], ...diagonals.map((diagonal) => {
    const [from, to] = [index.get(diagonal.from), index.get(diagonal.to)].sort((p, q) => p - q)
    return [from, to, diagonal.length]
  })]

  function constraints() {
    const values = []
    const rows = []
    for (const [from, to, size] of spans) {
      let sx = 0
      let sy = 0
      for (let i = from; i < to; i++) {
        sx += length(i) * Math.cos(x[i])
        sy += length(i) * Math.sin(x[i])
      }
      // для замыкания две строки (x и y), для диагонали одна - её длина
      const parts = size ? [[sx, sy].map((s) => s / (Math.hypot(sx, sy) || 1))] : [[1, 0], [0, 1]]
      for (const [ex, ey] of parts) {
        const row = new Array(x.length).fill(0)
        for (let i = from; i < to; i++) {
          row[i] = length(i) * (-Math.sin(x[i]) * ex + Math.cos(x[i]) * ey)
          if (slot.has(i)) row[slot.get(i)] = walls[i].length * (Math.cos(x[i]) * ex + Math.sin(x[i]) * ey)
        }
        rows.push(row)
        values.push(size ? Math.hypot(sx, sy) - size : sx * ex + sy * ey)
      }
    }
    return { values, rows }
  }
  const error = () => Math.max(...constraints().values.map(Math.abs))

  for (let step = 0; step < ITERATIONS; step++) {
    const { values, rows } = constraints()
    const before = Math.max(...values.map(Math.abs))
    if (before < ACCURACY) break
    // ближайшая к наброску точка, где ограничения выполнены (в линейном приближении)
    const scaled = rows.map((row) => row.map((value, k) => value / weight[k]))
    const matrix = rows.map((row) => scaled.map((other) => other.reduce((sum, value, k) => sum + value * row[k], 0)))
    const right = rows.map((row, r) => -values[r] - row.reduce((sum, value, k) => sum + value * (target[k] - x[k]), 0))
    const mu = solveLinear(matrix, right)
    if (!mu) return null
    const start = [...x]
    const next = x.map((value, k) => target[k] + scaled.reduce((sum, row, r) => sum + row[k] * mu[r], 0))
    // шаг не уменьшил ошибку - идём осторожнее, вдвое короче
    for (let part = 1; part > 1e-3; part /= 2) {
      for (let k = 0; k < x.length; k++) x[k] = start[k] + (next[k] - start[k]) * part
      if (error() < before) break
    }
  }

  console.log('solve', error())
  // отрицательная длина - стены перекрестились, это покажет проверка чертежа
  if (error() >= ACCURACY) return null

  // углы по порядку от первого
  const solved = [{ ...corners[0] }]
  for (let i = 0; i < n - 1; i++) {
    const last = solved[i]
    solved.push({ ...corners[i + 1], x: last.x + length(i) * Math.cos(x[i]), y: last.y + length(i) * Math.sin(x[i]) })
  }
  return solved
}
