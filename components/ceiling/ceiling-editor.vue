<template>
  <div class="ceiling-editor" :class="{ editing: edge, closed: ceiling.closed }">
    <header class="top center">
      <button class="icon center" @click="close"><span class="mask-icon arrow-icon back"></span></button>
      <h2 class="title">{{ ceiling.title }}</h2>
      <button class="icon help center" @click="hintsOpen = true">?</button>
    </header>

    <div class="panel">
      <div class="summary shadow">
        <p class="item"><span class="name">Площадь</span>{{ measured ? `${formatNumber(summary.area)} м²${missingDiagonals ? '*' : ''}` : '—' }}</p>
        <p class="item"><span class="name">Периметр</span>{{ measured ? `${formatNumber(summary.perimeter)} м` : '—' }}</p>
        <p class="item"><span class="name">Углы</span>{{ ceiling.corners.length }}</p>
        <p v-if="measured && missingDiagonals" class="note">* Расчёт приблизительный: не введены диагонали</p>
      </div>
      <p class="status shadow">{{ statusText }}</p>
      <p v-if="closeError" class="problem shadow">{{ closeError }}</p>
      <p v-for="error in errors" :key="error.message" class="problem shadow">{{ error.message }}</p>

      <div v-if="!edge && diagonalsOpen && diagonalList.length" class="diagonals shadow">
        <p class="text">{{ diagonalsText }}</p>
        <div class="list">
          <button
            v-for="diagonal in diagonalList"
            :key="edgeId(diagonal)"
            class="item center"
            :class="{ entered: diagonal.entered }"
            @click="selectEdge(edgeId(diagonal))"
          >
            {{ diagonal.from }}{{ diagonal.to }} {{ diagonal.entered ? `${formatNumber(roundLength(diagonal.length))} см` : '—' }}
          </button>
        </div>
      </div>

      <ceiling-wall-input
        v-if="edge"
        :title="edge.title"
        :value="edge.measured ? edge.length : 0"
        :error="inputError"
        :edges="edgeList"
        :selected="selected"
        @apply="applyLength"
        @select="selectEdge"
        @close="selectEdge('')"
      />

      <footer class="bottom">
        <button class="btn done center shadow" :disabled="!measured || errors.length > 0" @click="finish">Готово</button>
      </footer>
    </div>

    <div class="canvas shadow">
      <ceiling-drawing-stage
        ref="stage"
        :ceiling="ceiling"
        :selected="selected"
        :diagonals="visibleDiagonals"
        :error-walls="errorWalls"
        @place="onPlace"
        @close="onClose"
        @select="selectEdge"
        @move-start="onMoveStart"
        @move="draft.moveCorner"
        @move-end="onMoveEnd"
      >
        <button v-if="selectedCorner" class="btn secondary tool center shadow" @click="removeCorner">Удалить угол</button>
      </ceiling-drawing-stage>
      <button
        v-if="diagonalList.length && !selectedCorner"
        class="btn secondary action toggle center shadow"
        @click="toggleDiagonals"
      >
        {{ diagonalsOpen ? 'Скрыть диагонали' : 'Диагонали' }}
      </button>
      <div class="tools shadow">
        <button class="icon center" :disabled="ceiling.corners.length < 2" @click="stage.fit()"><span class="mask-icon fit-icon"></span></button>
        <button class="icon center" @click="stage.zoom(1.25)"><span class="mask-icon plus-icon"></span></button>
        <button class="icon center" @click="stage.zoom(0.8)"><span class="mask-icon minus-icon"></span></button>
        <button class="icon center" :disabled="!canUndo" @click="runAndFit(draft.undo)"><span class="mask-icon undo-icon"></span></button>
        <button class="icon delete center" :disabled="!ceiling.corners.length" @click="runAndFit(draft.reset)"><span class="mask-icon trash-icon"></span></button>
      </div>
    </div>

    <ceiling-hints v-if="hintsOpen" @close="closeHints" />
  </div>
</template>

<script setup>
import { MIN_CORNERS, roomDiagonals, edgeId } from '~/ceiling/geometry'

// ====== Определение данных ======
const HINTS_KEY = 'ceiling-hints-seen'

const emit = defineEmits(['close'])

const draft = useCeilingDraft()
const { ceiling, errors, summary, missingDiagonals, measured, canUndo } = draft

const stage = ref(null)
const selected = ref('')
const diagonalsOpen = ref(false)
const hintsOpen = ref(false)
const inputError = ref('')
const closeError = ref('')
const opened = ceiling.value

// ====== Вычисляемые значения ======
const diagonalList = computed(() => (ceiling.value.closed ? roomDiagonals(ceiling.value) : []))
const visibleDiagonals = computed(() => diagonalList.value.filter((diagonal) =>
  diagonalsOpen.value || diagonal.entered || edgeId(diagonal) === selected.value))

const errorWalls = computed(() => errors.value.flatMap((error) => error.walls))
const selectedCorner = computed(() => ceiling.value.closed && ceiling.value.corners.some((item) => item.id === selected.value))

// выбранная стена или диагональ
const edge = computed(() => {
  const wall = ceiling.value.walls.find((item) => edgeId(item) === selected.value)
  if (wall) return { ...wall, title: `Стена ${wall.from}${wall.to}`, measured: wall.fixed }
  const diagonal = diagonalList.value.find((item) => edgeId(item) === selected.value)
  if (diagonal) return { ...diagonal, title: `Диагональ ${diagonal.from}${diagonal.to}`, measured: diagonal.entered }
  return null
})

// стены по порядку, потом диагонали: в таком порядке вводим замеры
const edgeList = computed(() => [
  ...ceiling.value.walls.map((wall) => ({ ...wall, entered: wall.fixed })),
  ...diagonalList.value
].map((item) => ({ id: edgeId(item), name: `${item.from}${item.to}`, length: item.length, entered: item.entered })))

// форме с n углами нужно n - 3 диагонали
const diagonalsText = computed(() => {
  if (!missingDiagonals.value) return 'Нажмите на диагональ, чтобы изменить замер'
  return `Нажмите на диагональ, чтобы ввести замер. Для точной формы осталось ввести: ${missingDiagonals.value}`
})

// текст подсказки
const statusText = computed(() => {
  const { closed, corners } = ceiling.value
  if (closed) {
    if (!measured.value) return 'Введите замеры всех стен. Стены без замера нарисованы пунктиром'
    return 'Нажмите на стену или угол. Угол можно перетащить'
  }
  if (!corners.length) return 'Нажимайте на поле, чтобы отметить углы комнаты'
  if (corners.length < MIN_CORNERS) return 'Отметьте ещё углы. Комнате нужно минимум три'
  return 'Нажмите на точку «A», чтобы замкнуть контур'
})

// ====== Действия на чертеже ======
function selectEdge(id) {
  selected.value = id
  inputError.value = ''
  closeError.value = ''
}

function toggleDiagonals() {
  diagonalsOpen.value = !diagonalsOpen.value
  selectEdge('')
}

function runAndFit(action) {
  action()
  selectEdge('')
  closeError.value = ''
  nextTick(() => stage.value.fit())
}

function onPlace(point) {
  console.log(point)
  closeError.value = ''
  draft.addPoint(point)
}

function onClose() {
  const error = draft.close()
  console.log('close error', error)
  // мало углов: подсказка над чертежом уже об этом говорит, второй раз не пишем
  if (error) return
  // сразу вводим длину первой стены
  selectEdge(edgeId(ceiling.value.walls[0]))
  nextTick(() => stage.value.fit())
}

// поле закрываем после перетаскивания, иначе холст меняет размер под пальцем
function onMoveStart() {
  draft.startMove()
}

function onMoveEnd() {
  selectEdge('')
  draft.endMove()
  nextTick(() => stage.value.fit())
}

function removeCorner() {
  const error = draft.removeCorner(selected.value)
  if (error) {
    closeError.value = error
    return
  }
  runAndFit(() => {})
}

function applyLength(length) {
  console.log('testttt', length)
  const { from, to } = edge.value
  console.log('edge', edge.value)
  const isDiagonal = diagonalList.value.some((item) => edgeId(item) === selected.value)
  inputError.value = isDiagonal ? draft.setDiagonal(from, to, length) : draft.setWallLength(selected.value, length)
  if (inputError.value) return
  // после стрелки переходим к следующей стене, после последней закрываем поле
  const current = selected.value
  const ids = edgeList.value.map((item) => item.id)
  const index = ids.indexOf(current)
  const next = index === -1 ? '' : ids[index + 1] || ''
  console.log('next', next)
  runAndFit(() => {})
  selectEdge(next)
}

// ====== Кнопки редактора ======
// Кнопки (закрыть, готово)
function close() {
  if (ceiling.value !== opened && !window.confirm('Закрыть схему без сохранения изменений?')) return
  ceiling.value = opened
  emit('close')
}

// подсказки показываем при первом открытии
function closeHints() {
  hintsOpen.value = false
  try {
    localStorage.setItem(HINTS_KEY, '1')
  } catch (error) {
    console.log(error)
  }
}

function finish() {
  console.log('measured', measured.value)
  draft.drawn.value = true
  emit('close')
}

// ====== Запрет прокрутки страницы под редактором ======
onMounted(() => {
  document.body.style.overflow = 'hidden'
  try {
    hintsOpen.value = !localStorage.getItem(HINTS_KEY)
  } catch (error) {
    hintsOpen.value = true
  }
  console.log('hints', hintsOpen.value)
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<style lang="sass">
@use '@/assets/styles/adaptive' as *

.ceiling-editor
    position: fixed
    top: 0
    left: 0
    z-index: 10
    display: flex
    flex-direction: column
    gap: 8px
    width: 100%
    height: 100dvh
    background: var(--bg-color)
    .top
        position: relative
        min-height: 52px
        color: var(--btn-text-color)
        background: var(--main-color)
        .icon
            position: absolute
            left: 8px
            color: inherit
            background: none
        // стрелка назад
        .back
            transform: rotate(180deg)
        .help
            right: 8px
            left: auto
            font-size: 1.125rem
            font-weight: 600
    .title
        font-size: 1.125rem
        color: inherit
    .icon
        width: 44px
        height: 44px
        border: none
        border-radius: 8px
        color: var(--main-color)
        background: var(--card-color)
        &:disabled
            color: var(--border-color)
            box-shadow: none
    // на телефоне панель раскладывается вокруг холста: поле и кнопки под ним
    .panel
        display: contents
    .wall-input, .bottom
        order: 1
    // колонки по центру, сноска под ними
    .summary
        display: grid
        grid-template-columns: repeat(3, 1fr)
        gap: 4px 8px
        padding: 8px 12px
        text-align: center
        .name
            display: block
            font-size: 0.875rem
            color: var(--disabled-color)
        .item
            font-weight: 600
        .note
            grid-column: 1 / -1
            font-size: 0.8125rem
            color: var(--disabled-color)
    .summary, .status, .problem, .diagonals, .canvas
        margin: 0 8px
        border-radius: 8px
        background: var(--card-color)
    .status, .problem
        padding: 8px 12px
    .problem
        color: var(--error-color)
    .diagonals
        padding: 10px 12px
        .text
            margin-bottom: 8px
        .list
            display: flex
            flex-wrap: wrap
            gap: 8px
        .item
            min-height: 40px
            padding: 0 10px
            border: 1px solid var(--border-color)
            border-radius: 8px
            color: var(--main-color)
            background: var(--card-color)
            &.entered
                font-weight: 600
                border-color: var(--main-color)
                background: var(--secondary-color)
    .action
        position: absolute
        bottom: 8px
        left: 8px
        padding: 0 12px
    // кнопка у выбранного угла или стены
    .tool
        min-height: 36px
        padding: 0 14px
        font-size: 0.875rem
        white-space: nowrap
        border: 1px solid var(--main-color)
    .canvas
        position: relative
        flex: 1
        min-height: 0
        overflow: hidden
    // инструменты столбиком справа, как в Easy Ceiling
    .tools
        position: absolute
        top: 50%
        right: 8px
        display: flex
        flex-direction: column
        gap: 4px
        padding: 4px
        border-radius: 26px
        background: var(--card-color)
        transform: translateY(-50%)
        .icon
            border-radius: 50%
            background: none
        .delete
            color: var(--error-color)
    .bottom
        display: flex
        align-items: center
        gap: 8px
        padding: 0 8px 8px
    .done
        flex: 1

// на ПК чертёж слева, всё остальное в колонке справа
@media (min-width: $bp-pc)
    .ceiling-editor
        display: grid
        grid-template-columns: 1fr 400px
        grid-template-rows: auto minmax(0, 1fr)
        gap: 0
        .top
            grid-column: 1 / -1
        .panel
            display: flex
            flex-direction: column
            gap: 8px
            grid-column: 2
            grid-row: 2
            min-height: 0
            padding: 8px 8px 8px 0
            overflow-y: auto
        .summary, .status, .problem, .diagonals, .wall-input
            margin: 0
        .bottom
            margin-top: auto
            padding: 0
        .canvas
            grid-column: 1
            grid-row: 2
            margin: 8px

@media (max-width: $bp-pc)
    .ceiling-editor
        // на две строки, чтобы холст не прыгал
        .status
            min-height: 60px
        // на готовом чертеже место отдаём холсту, подсказки остаются под «?»
        &.closed .status
            display: none
        // кнопки на холсте меньше, чтобы не закрывать чертёж
        .action
            min-height: 36px
            padding: 0 10px
            font-size: 0.875rem
        // при вводе чертёж сверху, поле снизу
        &.editing
            .tools, .toggle, .summary, .status, .bottom
                display: none
            .wall-input
                margin-bottom: 8px

// открытая клавиатура
@media (max-height: 500px)
    .ceiling-editor
        &.editing
            .bottom
                display: none
</style>
