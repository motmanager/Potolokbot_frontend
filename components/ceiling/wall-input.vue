<template>
  <form class="wall-input shadow" @submit.prevent="submit">
    <div class="head">
      <div ref="list" class="edges">
        <button
          v-for="item in edges"
          :key="item.id"
          class="edge"
          :class="{ active: item.id === selected, entered: item.entered }"
          @mousedown.prevent
          @click.prevent="emit('select', item.id)"
        >
          <span class="edge-name">{{ item.name }}</span>
          <span class="edge-length">{{ item.entered ? formatNumber(roundLength(item.length)) : '—' }}</span>
        </button>
      </div>
      <button class="close center" @click.prevent="emit('close')"><span class="mask-icon close-icon"></span></button>
    </div>
    <div class="row">
      <label class="field">
        <span class="name">{{ title }}</span>
        <input
          ref="input"
          v-model="text"
          class="value"
          inputmode="decimal"
          @keydown.enter.prevent="submit"
          @keydown.up.prevent="changeBy(LENGTH_STEP)"
          @keydown.down.prevent="changeBy(-LENGTH_STEP)"
        >
        <span class="unit">см</span>
      </label>
      <button class="step center shadow" @mousedown.prevent @click.prevent="changeBy(-LENGTH_STEP)"><span class="mask-icon minus-icon"></span></button>
      <button class="step center shadow" @mousedown.prevent @click.prevent="changeBy(LENGTH_STEP)"><span class="mask-icon plus-icon"></span></button>
      <button class="btn next center shadow">Следующий шаг</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </form>
</template>

<script setup>
import { MIN_LENGTH } from '~/ceiling/geometry'

// ====== Определение данных ======
// шаг 1 см
const LENGTH_STEP = 1

const props = defineProps({
  title: { type: String, required: true },
  value: { type: Number, required: true },
  error: { type: String, default: '' },
  edges: { type: Array, default: () => [] },
  selected: { type: String, default: '' }
})
const emit = defineEmits(['apply', 'close', 'select'])

const input = ref(null)
const list = ref(null)
const text = ref('')

// ====== Работа с полем ======
// без замера поле пустое: размер по сетке условный
function reset() {
  text.value = props.value ? formatNumber(roundLength(props.value)) : ''
  nextTick(() => {
    input.value.focus()
    // на телефоне не выделяем: выглядит как будто предлагают скопировать
    if (window.matchMedia('(pointer: fine)').matches) input.value.select()
    console.log('focus', props.title)
  })
}

function changeBy(delta) {
  const next = parseNumber(text.value) + delta
  if (isNaN(next) || next < MIN_LENGTH) return
  text.value = formatNumber(roundLength(next))
}

function submit() {
  emit('apply', parseNumber(text.value))
}

// ====== Лента стен ======
// выбранная стена всегда видна в ленте
function showSelected() {
  nextTick(() => {
    const active = list.value.querySelector('.active')
    console.log('active', active)
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  })
}

watch(() => props.title, () => {
  reset()
  showSelected()
})

onMounted(() => {
  reset()
  showSelected()
})
</script>

<style lang="sass">
@use '@/assets/styles/adaptive' as *

.wall-input
    margin: 0 8px
    padding: 10px 12px
    border-radius: 8px
    background: var(--card-color)
    // лента стен и крестик сверху, «Следующий шаг» снизу, чтобы не нажать не то
    .head
        display: flex
        align-items: flex-start
        gap: 8px
        margin-bottom: 10px
    .edges
        display: flex
        flex: 1
        gap: 8px
        min-width: 0
        overflow-x: auto
        scrollbar-width: none
    .edge
        display: flex
        flex: 0 0 72px
        flex-direction: column
        align-items: center
        gap: 2px
        padding: 6px 0
        border: 1px solid var(--border-color)
        border-radius: 8px
        color: var(--disabled-color)
        background: var(--card-color)
        &.entered
            color: var(--main-color)
        &.active
            border-color: var(--accent-color)
            color: var(--accent-color)
    .edge-name
        font-weight: 600
    // поле на всю ширину, кнопки на второй строке
    .row
        display: flex
        flex-wrap: wrap
        align-items: center
        gap: 8px
    .field
        display: flex
        flex: 0 0 100%
        align-items: center
        gap: 8px
        min-width: 0
    .name
        font-weight: 600
        color: var(--main-color)
        white-space: nowrap
    .value
        width: 100%
        height: 44px
        padding: 0 10px
        border: 1px solid var(--border-color)
        border-radius: 8px
    .step
        width: 44px
        height: 44px
        border: none
        border-radius: 8px
        color: var(--main-color)
        background: var(--card-color)
    .next
        flex: 1
        font-size: 0.875rem
    .close
        flex: 0 0 auto
        width: 36px
        height: 36px
        border: none
        border-radius: 8px
        color: var(--main-color)
        background: var(--bg-color)
    .error
        margin-top: 8px
        color: var(--error-color)

// в боковой колонке на ПК лента в несколько строк, без прокрутки
@media (min-width: $bp-pc)
    .wall-input
        .edges
            flex-wrap: wrap
</style>
