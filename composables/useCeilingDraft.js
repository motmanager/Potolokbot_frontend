import * as geometry from '~/ceiling/geometry'

export function useCeilingDraft() {
  // ====== Состояние чертежа ======
  const ceiling = useState('ceiling', () => null)
  const drawn = useState('ceiling-drawn', () => false)
  const initial = useState('ceiling-initial', () => null)
  const past = useState('ceiling-past', () => [])

  // ====== Ошибки и расчёты ======
  const errors = computed(() => (ceiling.value ? geometry.validate(ceiling.value) : []))
  const summary = computed(() => {
    if (!ceiling.value) return null
    return {
      area: toSquareMeters(calcArea(ceiling.value.corners)),
      perimeter: toMeters(calcPerimeter(ceiling.value.corners))
    }
  })

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

  // ====== Построение чертежа ======
  function start(length, width) {
    begin(geometry.createRectangle(length, width))
  }

  function startEmpty() {
    begin(geometry.createEmpty())
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
    commit(geometry.addCorner(ceiling.value, wallId))
  }

  function removeCorner(cornerId) {
    const result = geometry.removeCorner(ceiling.value, cornerId)
    console.log('111111', result.error)
    commit(result.ceiling)
    return result.error
  }

  function setWallLength(wallId, length) {
    const result = geometry.setWallLength(ceiling.value, wallId, length)
    console.log(result)
    commit(result.ceiling)
    return result.error
  }

  function setDiagonal(from, to, length) {
    const result = geometry.setDiagonal(ceiling.value, from, to, length)
    commit(result.ceiling)
    return result.error
  }

  // ====== Другие действия ======
  // Кнопки (отменить, сброс, очистить)
  function undo() {
    if (!past.value.length) return
    ceiling.value = past.value[past.value.length - 1]
    past.value = past.value.slice(0, -1)
  }

  function reset() {
    commit(initial.value)
  }

  function clear() {
    ceiling.value = null
    drawn.value = false
    past.value = []
  }

  return {
    ceiling,
    drawn,
    errors,
    summary,
    canUndo: computed(() => past.value.length > 0),
    start,
    startEmpty,
    addPoint,
    close,
    addCorner,
    removeCorner,
    setWallLength,
    setDiagonal,
    undo,
    reset,
    clear
  }
}
