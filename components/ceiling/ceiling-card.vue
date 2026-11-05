<template>
  <div class="ceiling-card shadow">
    <h2 class="title">Потолок {{ entry.number }}</h2>

    <template v-if="!data">
      <p class="text">Выберите форму комнаты</p>
      <div class="options">
        <button class="option center" :class="{ active: shape === 'rectangle' }" @click="shape = 'rectangle'">Прямоугольная</button>
        <button class="option center" :class="{ active: shape === 'other' }" @click="shape = 'other'">Другая форма</button>
      </div>
    </template>

    <div v-if="!data && shape === 'other'" class="draw">
      <p class="note">Отметьте углы комнаты на схеме, затем введите длины стен.</p>
      <button class="btn center shadow" @click="drawRoom">Нарисовать комнату</button>
    </div>

    <form v-if="showFields" class="sizes" @submit.prevent="openEditor">
      <label class="field">
        <span class="name">Длина, см</span>
        <input v-model="length" class="value" inputmode="decimal" placeholder="Например, 400" @input="onSizeInput">
      </label>
      <label class="field">
        <span class="name">Ширина, см</span>
        <input v-model="width" class="value" inputmode="decimal" placeholder="Например, 300" @input="onSizeInput">
      </label>
      <p v-if="sizeError" class="error">{{ sizeError }}</p>
      <p v-else-if="preview && !data" class="result">Площадь {{ preview.area }} м². Периметр {{ preview.perimeter }} м</p>
      <button v-if="!data" class="btn center shadow" :disabled="!!sizeError">Построить чертёж</button>
    </form>

    <div v-if="data" class="scheme">
      <svg class="shape" :viewBox="viewBox">
        <polygon v-if="data.closed" class="outline" :points="outline" vector-effect="non-scaling-stroke"></polygon>
        <polyline v-else class="outline open" :points="outline" vector-effect="non-scaling-stroke"></polyline>
      </svg>
      <p v-if="countable" class="result">Площадь {{ formatNumber(summary.area) }} м². Периметр {{ formatNumber(summary.perimeter) }} м</p>
      <p v-else class="note">Площадь посчитается, когда все замеры введены и сходятся</p>
      <p v-if="countable && missingDiagonals" class="note">Расчёт приблизительный: не введены диагонали</p>
      <div class="buttons">
        <button class="btn center shadow" @click="editDrawing">Изменить чертёж</button>
        <button class="btn secondary center shadow" @click="resetCeiling">Сбросить</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { MAX_LENGTH, MIN_LENGTH } from '~/ceiling/geometry'

// ====== Определение констант и данных ======
const DEFAULT_LENGTH = 400
const DEFAULT_WIDTH = 300

const props = defineProps({
  // { number, data }: data - сохранённый чертёж или null
  entry: { type: Object, required: true }
})
const emit = defineEmits(['edit'])

const draft = useCeilingDraft()

const length = ref('')
const width = ref('')
// прямоугольная комната по длине и ширине или другая форма по углам
const shape = ref('rectangle')

const data = computed(() => props.entry.data)
const summary = computed(() => (data.value ? draft.summaryOf(data.value) : null))
const missingDiagonals = computed(() => (data.value ? draft.missingDiagonalsOf(data.value) : 0))
// площадь только когда все стены измерены и сошлись
const countable = computed(() => draft.isMeasured(data.value) && !data.value.walls.some((wall) => wall.mismatch))

// ====== Проверка полей ======
const isValid = (value) => value >= MIN_LENGTH && value <= MAX_LENGTH

const sizeError = computed(() => {
  const filled = [length.value, width.value].filter(Boolean)
  if (filled.every((value) => isValid(parseNumber(value)))) return ''
  return `Укажите размеры от ${MIN_LENGTH} до ${MAX_LENGTH} см`
})

// ====== Расчёт площади и периметра ======
const preview = computed(() => {
  if (!length.value || !width.value || sizeError.value) return null
  const a = parseNumber(length.value)
  const b = parseNumber(width.value)
  return { area: formatNumber(toSquareMeters(a * b)), perimeter: formatNumber(toMeters(2 * (a + b))) }
})

// Размеры прямоугольной комнаты: только для неё поля длины и ширины описывают весь чертёж
const rectangleSize = computed(() => {
  const corners = data.value?.corners
  if (!data.value?.closed || corners.length !== 4) return null
  const aligned = corners.every((corner, i) => {
    const next = corners[(i + 1) % 4]
    return corner.x === next.x || corner.y === next.y
  })
  if (!aligned) return null
  const { minX, maxX, minY, maxY } = calcBounds(corners)
  return { length: maxX - minX, width: maxY - minY }
})

const showFields = computed(() => (data.value ? rectangleSize.value : shape.value === 'rectangle'))

// при возврате на страницу поля показывают размеры сохранённого прямоугольника
watch(rectangleSize, (size) => {
  console.log('size', size)
  if (!size) return
  if (parseNumber(length.value) !== size.length) length.value = String(size.length)
  if (parseNumber(width.value) !== size.width) width.value = String(size.width)
}, { immediate: true })

// ====== Построение схемы ======
function openEditor() {
  console.log('testttt', length.value, width.value)
  if (sizeError.value) return
  draft.start(props.entry.number, parseNumber(length.value) || DEFAULT_LENGTH, parseNumber(width.value) || DEFAULT_WIDTH)
  emit('edit')
}

// другая форма: пустая схема, углы ставим сами
function drawRoom() {
  console.log('shape', shape.value)
  draft.startEmpty(props.entry.number)
  emit('edit')
}

function editDrawing() {
  draft.open(props.entry.number)
  emit('edit')
}

function onSizeInput() {
  console.log(length.value, width.value)
  if (!data.value || sizeError.value || !length.value || !width.value) return
  draft.resize(props.entry.number, parseNumber(length.value), parseNumber(width.value))
}

// ====== Другие действия ======
// Кнопки (сбросить потолок)
function resetCeiling() {
  draft.reset(props.entry.number)
  length.value = ''
  width.value = ''
}

// ====== Мини-схема ======
const viewBox = computed(() => {
  const { minX, maxX, minY, maxY } = calcBounds(data.value.corners)
  const sizeX = maxX - minX
  const sizeY = maxY - minY
  const pad = Math.max(sizeX, sizeY, 1) * 0.03
  return `${minX - pad} ${minY - pad} ${sizeX + pad * 2} ${sizeY + pad * 2}`
})

const outline = computed(() => data.value.corners.map((corner) => `${corner.x},${corner.y}`).join(' '))
</script>

<style lang="sass">
.ceiling-card
    display: flex
    flex-direction: column
    gap: 16px
    padding: 24px
    border-radius: 12px
    background: var(--card-color)
    .title
        font-size: 1.25rem
        color: var(--main-color)
    .result
        font-weight: 600
        color: var(--main-color)
    .options
        display: grid
        grid-template-columns: 1fr 1fr
        gap: 8px
        .option
            min-height: 48px
            padding: 0 12px
            border: 1px solid var(--border-color)
            border-radius: 8px
            color: var(--main-color)
            background: var(--card-color)
            &.active
                font-weight: 600
                border-color: var(--main-color)
                background: var(--secondary-color)
    .draw
        display: flex
        flex-direction: column
        gap: 12px
    .sizes
        display: flex
        flex-direction: column
        gap: 12px
        .field
            display: flex
            flex-direction: column
            gap: 4px
        .value
            height: 48px
            padding: 0 12px
            border: 1px solid var(--border-color)
            border-radius: 8px
        .error
            color: var(--error-color)
    .scheme
        display: flex
        flex-direction: column
        gap: 12px
    .shape
        width: 100%
        height: 240px
        padding: 8px
        border-radius: 8px
        background: var(--scheme-bg-color)
    .outline
        fill: var(--secondary-color)
        stroke: var(--main-color)
        stroke-width: 2
        &.open
            fill: none
    .buttons
        display: flex
        flex-wrap: wrap
        gap: 8px
</style>
