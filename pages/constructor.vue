<template>
  <section class="constructor-page">
    <div class="content">
      <div class="card shadow">
        <h1 class="h1">Схема комнаты</h1>

        <form v-if="showFields" class="sizes" @submit.prevent="openEditor">
          <p v-if="!drawn" class="text">Укажите размеры комнаты или постройте чертёж</p>
          <label class="field">
            <span class="name">Длина, см</span>
            <input v-model="length" class="value" inputmode="decimal" placeholder="Например, 400" @input="onSizeInput">
          </label>
          <label class="field">
            <span class="name">Ширина, см</span>
            <input v-model="width" class="value" inputmode="decimal" placeholder="Например, 300" @input="onSizeInput">
          </label>
          <p v-if="sizeError" class="error">{{ sizeError }}</p>
          <p v-else-if="preview && !drawn" class="result">Площадь {{ preview.area }} м². Периметр {{ preview.perimeter }} м</p>
          <template v-if="!drawn">
            <p class="note">Для сложной формы и неровных стен укажите размеры на схеме.</p>
            <button class="btn center shadow" :disabled="!!sizeError">Построить чертёж</button>
          </template>
        </form>

        <div v-if="drawn" class="scheme">
          <svg class="shape" :viewBox="viewBox">
            <polygon class="outline" :points="outline" vector-effect="non-scaling-stroke"></polygon>
          </svg>
          <p class="result">Площадь {{ formatNumber(summary.area) }} м². Периметр {{ formatNumber(summary.perimeter) }} м</p>
          <div class="buttons">
            <button class="btn center shadow" @click="editorOpen = true">Изменить чертёж</button>
            <button class="btn secondary center shadow" @click="clearScheme">Сбросить</button>
          </div>
        </div>
      </div>
    </div>

    <lazy-ceiling-editor v-if="editorOpen" @close="editorOpen = false" />
  </section>
</template>

<script setup>
import { MAX_LENGTH, MIN_LENGTH } from '~/ceiling/geometry'

// ====== Определение констант ======
const DEFAULT_LENGTH = 400
const DEFAULT_WIDTH = 300

const draft = useCeilingDraft()
const { ceiling, drawn, summary } = draft

const length = ref('')
const width = ref('')
const editorOpen = ref(false)

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
  const corners = ceiling.value?.corners
  if (!drawn.value || corners?.length !== 4) return null
  const aligned = corners.every((corner, i) => {
    const next = corners[(i + 1) % 4]
    return corner.x === next.x || corner.y === next.y
  })
  if (!aligned) return null
  const { minX, maxX, minY, maxY } = calcBounds(corners)
  return { length: maxX - minX, width: maxY - minY }
})

const showFields = computed(() => !drawn.value || rectangleSize.value)

watch(rectangleSize, (size) => {
  console.log('size', size)
  if (!size) return
  if (parseNumber(length.value) !== size.length) length.value = String(size.length)
  if (parseNumber(width.value) !== size.width) width.value = String(size.width)
})

// ====== Построение схемы ======
function openEditor() {
  console.log('testttt', length.value, width.value)
  if (sizeError.value) return
  if (!length.value && !width.value) draft.startEmpty()
  else draft.start(parseNumber(length.value) || DEFAULT_LENGTH, parseNumber(width.value) || DEFAULT_WIDTH)
  editorOpen.value = true
}

function onSizeInput() {
  console.log(length.value, width.value)
  if (!drawn.value || sizeError.value || !length.value || !width.value) return
  draft.start(parseNumber(length.value), parseNumber(width.value))
}

// ====== Другие действия ======
// Кнопки (очистить схему)
function clearScheme() {
  draft.clear()
  length.value = ''
  width.value = ''
}

// ====== Мини-схема ======
const viewBox = computed(() => {
  const { minX, maxX, minY, maxY } = calcBounds(ceiling.value.corners)
  const sizeX = maxX - minX
  const sizeY = maxY - minY
  const pad = Math.max(sizeX, sizeY) * 0.03
  return `${minX - pad} ${minY - pad} ${sizeX + pad * 2} ${sizeY + pad * 2}`
})

const outline = computed(() => ceiling.value.corners.map((corner) => `${corner.x},${corner.y}`).join(' '))
</script>

<style lang="sass">
.constructor-page
    padding: 24px 0
    .card
        display: flex
        flex-direction: column
        gap: 16px
        max-width: 600px
        margin: 0 auto
        padding: 24px
        border-radius: 12px
        background: var(--card-color)
    .h1
        font-size: 1.5rem
    .result
        font-weight: 600
        color: var(--main-color)
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
    .buttons
        display: flex
        flex-wrap: wrap
        gap: 8px
</style>
