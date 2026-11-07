import * as geometry from '~/ceiling/geometry'

// ====== Расчёты по чертежу ======
function summaryOf(ceiling) {
  return {
    area: toSquareMeters(calcArea(ceiling.corners)),
    perimeter: toMeters(calcPerimeter(ceiling.corners))
  }
}

// форме с n углами нужно n - 3 диагонали, иначе расчёт приблизительный
function missingDiagonalsOf(ceiling) {
  if (!ceiling.closed) return 0
  if (ceiling.fromSizes && isRectangle(ceiling.corners)) return 0
  const structural = ceiling.diagonals.filter((diagonal) => !diagonal.control).length
  return Math.max(ceiling.corners.length - 3 - structural, 0)
}

// все стены измерены: до этого размеры по наброску условные, площадь не показываем
const isMeasured = (ceiling) => Boolean(ceiling?.closed && ceiling.walls.every((wall) => wall.fixed))

export function useCeilingDraft() {
  // ====== Состояние ======
  // потолки на странице: data - сохранённый чертёж, null - ещё не построен
  const ceilings = useState('ceilings', () => [{ number: 1, data: null }])
  // чертёж, который сейчас открыт в редакторе
  const ceiling = useState('ceiling', () => null)
  const initial = useState('ceiling-initial', () => null)
  const past = useState('ceiling-past', () => [])
  let beforeMove = null

  // ====== Ошибки и расчёты ======
  const errors = computed(() => (ceiling.value ? geometry.validate(ceiling.value) : []))
  const summary = computed(() => (ceiling.value ? summaryOf(ceiling.value) : null))
  const missingDiagonals = computed(() => (ceiling.value ? missingDiagonalsOf(ceiling.value) : 0))
  const measured = computed(() => isMeasured(ceiling.value))

  // ====== История изменений ======
  function begin(next) {
    ceiling.value = next
    initial.value = next
    past.value = []
  }

  function commit(next) {
    if (next === ceiling.value) return
    past.value = [...past.value, ceiling.value]
    ceiling.value = next
  }

  // ====== Потолки на странице ======
  function setData(number, data) {
    ceilings.value = ceilings.value.map((item) => (item.number === number ? { ...item, data } : item))
  }

  // новый потолок со следующим номером
  function addCeiling() {
    const number = Math.max(...ceilings.value.map((item) => item.number)) + 1
    console.log('add ceiling', number)
    ceilings.value = [...ceilings.value, { number, data: null }]
  }

  // открыть сохранённый чертёж в редакторе
  function open(number) {
    begin(ceilings.value.find((item) => item.number === number).data)
  }

  // сохранить открытый чертёж: пустой холст считаем непостроенным
  function save() {
    console.log('save', ceiling.value.number, ceiling.value)
    setData(ceiling.value.number, ceiling.value.corners.length ? ceiling.value : null)
  }

  // ====== Построение чертежа ======
  function start(number, length, width) {
    begin(geometry.createRectangle(length, width, number))
  }

  function startEmpty(number) {
    begin(geometry.createEmpty(number))
  }

  // прямоугольник по полям на странице сразу сохраняем
  function resize(number, length, width) {
    setData(number, geometry.createRectangle(length, width, number))
  }

  function addPoint(point) {
    commit(geometry.addPoint(ceiling.value, point))
  }

  function close() {
    const result = geometry.closeContour(ceiling.value)
    commit(result.ceiling)
    return result.error
  }

  function addCorner(wallId) {
    const result = geometry.addCorner(ceiling.value, wallId)
    commit(result.ceiling)
    return result.error
  }

  function removeCorner(cornerId) {
    const result = geometry.removeCorner(ceiling.value, cornerId)
    console.log('111111', result.error)
    commit(result.ceiling)
    return result.error
  }

  // перетаскивание: в истории одна запись на всё движение
  function startMove() {
    beforeMove = ceiling.value
  }

  function moveCorner(cornerId, point) {
    ceiling.value = geometry.moveCorner(ceiling.value, cornerId, point)
  }

  function endMove() {
    console.log('here', ceiling.value.corners)
    if (ceiling.value !== beforeMove) past.value = [...past.value, beforeMove]
  }

  function setWallLength(wallId, length) {
    const result = geometry.setWallLength(ceiling.value, wallId, length)
    console.log(result)
    commit(result.ceiling)
    return result.error
  }

  function setControlDiagonal(from, to, length) {
    const result = geometry.setControlDiagonal(ceiling.value, from, to, length)
    commit(result.ceiling)
    return result.error
  }

  function setDiagonal(from, to, length) {
    const result = geometry.setDiagonal(ceiling.value, from, to, length)
    commit(result.ceiling)
    return result.error
  }

  // ====== Другие действия ======
  // Кнопки (отменить, очистить экран, сбросить потолок)
  function undo() {
    if (!past.value.length) return
    ceiling.value = past.value[past.value.length - 1]
    past.value = past.value.slice(0, -1)
  }

  // пустой холст того же потолка, можно отменить
  function clearScreen() {
    commit(geometry.createEmpty(ceiling.value.number))
  }

  function reset(number) {
    setData(number, null)
  }

  return {
    ceilings,
    ceiling,
    errors,
    summary,
    missingDiagonals,
    measured,
    summaryOf,
    missingDiagonalsOf,
    isMeasured,
    canUndo: computed(() => past.value.length > 0),
    addCeiling,
    open,
    save,
    start,
    startEmpty,
    resize,
    addPoint,
    close,
    addCorner,
    removeCorner,
    startMove,
    moveCorner,
    endMove,
    setWallLength,
    setDiagonal,
    setControlDiagonal,
    undo,
    clearScreen,
    reset
  }
}
