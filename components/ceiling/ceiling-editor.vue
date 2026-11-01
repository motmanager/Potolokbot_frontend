<template>
  <div class="ceiling-editor" :class="{ editing: selectedWall }">
    <header class="top center">
      <button class="icon center" @click="close"><span class="mask-icon close-icon"></span></button>
      <h2 class="title">Схема комнаты</h2>
    </header>

    <p class="status shadow">{{ statusText }}</p>
    <p v-if="closeError" class="problem shadow">{{ closeError }}</p>
    <p v-for="error in errors" :key="error.message" class="problem shadow">{{ error.message }}</p>

    <ceiling-wall-input
      v-if="wall"
      :title="`Стена ${wall.from}${wall.to}`"
      :value="wall.length"
      :error="inputError"
      @apply="applyLength"
      @close="selectWall('')"
    />

    <div class="canvas shadow">
      <ceiling-drawing-stage
        ref="stage"
        :ceiling="ceiling"
        :selected-wall="selectedWall"
        @place="onPlace"
        @close="onClose"
        @select="selectWall"
      />
      <div class="zoom">
        <button class="icon center shadow" @click="stage.zoom(1.25)"><span class="mask-icon plus-icon"></span></button>
        <button class="icon center shadow" @click="stage.zoom(0.8)"><span class="mask-icon minus-icon"></span></button>
      </div>
    </div>

    <footer class="bottom">
      <button class="icon center shadow" :disabled="!canUndo" @click="runAndFit(draft.undo)"><span class="mask-icon undo-icon"></span></button>
      <button class="btn secondary center shadow" @click="runAndFit(draft.reset)">Сброс</button>
      <button class="btn done center shadow" :disabled="!ceiling.closed || errors.length > 0" @click="finish">Готово</button>
    </footer>
  </div>
</template>

<script setup>
import { edgeId } from '~/ceiling/geometry'

// ====== Определение данных ======
const emit = defineEmits(['close'])

const draft = useCeilingDraft()
const { ceiling, errors, summary, canUndo } = draft

const stage = ref(null)
const selectedWall = ref('')
const inputError = ref('')
const closeError = ref('')
const opened = ceiling.value

// ====== Вычисляемые значения ======
const wall = computed(() => ceiling.value.walls.find((item) => edgeId(item) === selectedWall.value))

// текст подсказки
const statusText = computed(() => {
  const { closed, corners } = ceiling.value
  if (closed) {
    return `Площадь ${formatNumber(summary.value.area)} м². Периметр ${formatNumber(summary.value.perimeter)} м. Нажмите на стену, чтобы изменить длину`
  }
  if (!corners.length) return 'Нажимайте на пересечения сетки, чтобы отметить углы комнаты'
  if (corners.length < 4) return 'Отметьте ещё углы. Комнате нужно минимум четыре'
  return 'Нажмите на точку «A», чтобы замкнуть контур'
})

// ====== Действия на чертеже ======
function selectWall(id) {
  selectedWall.value = id
  inputError.value = ''
}

function runAndFit(action) {
  action()
  selectWall('')
  closeError.value = ''
  nextTick(() => stage.value.fit())
}

function onPlace(point) {
  console.log(point)
  closeError.value = ''
  draft.addPoint(point)
}

function onClose() {
  closeError.value = draft.close()
  console.log('close error', closeError.value)
  if (!closeError.value) nextTick(() => stage.value.fit())
}

function applyLength(length) {
  console.log('testttt', length)
  inputError.value = draft.setWallLength(selectedWall.value, length)
  if (!inputError.value) runAndFit(() => {})
}

// ====== Кнопки редактора ======
// Кнопки (закрыть, готово)
function close() {
  if (ceiling.value !== opened && !window.confirm('Закрыть схему без сохранения изменений?')) return
  ceiling.value = opened
  emit('close')
}

function finish() {
  draft.drawn.value = true
  emit('close')
}

// ====== Запрет прокрутки страницы под редактором ======
onMounted(() => {
  document.body.style.overflow = 'hidden'
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
    .status, .problem, .canvas
        margin: 0 8px
        border-radius: 8px
        background: var(--card-color)
    .status, .problem
        padding: 8px 12px
    .problem
        color: var(--error-color)
    .canvas
        position: relative
        flex: 1
        min-height: 0
        overflow: hidden
    .zoom
        position: absolute
        right: 8px
        bottom: 8px
        display: flex
        gap: 8px
    .bottom
        display: flex
        align-items: center
        gap: 8px
        padding: 0 8px 8px
    .done
        flex: 1

@media (min-width: $bp-pc)
    .ceiling-editor
        .done
            flex: 0 0 240px
            margin-left: auto

@media (max-width: $bp-pc)
    .ceiling-editor
        // на три строки, чтобы холст не прыгал
        .status
            min-height: 84px
        &.editing
            .zoom
                display: none

// открытая клавиатура
@media (max-height: 500px)
    .ceiling-editor
        &.editing
            .bottom
                display: none
</style>
