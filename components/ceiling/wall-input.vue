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
          placeholder="Введите размер"
          :readonly="keypad"
          @keydown.enter.prevent="submit"
          @keydown.up.prevent="changeBy(LENGTH_STEP)"
          @keydown.down.prevent="changeBy(-LENGTH_STEP)"
        >
        <span class="unit">см</span>
      </label>
      <template v-if="!keypad">
        <button class="step center shadow" @mousedown.prevent @click.prevent="changeBy(-LENGTH_STEP)"><span class="mask-icon minus-icon"></span></button>
        <button class="step center shadow" @mousedown.prevent @click.prevent="changeBy(LENGTH_STEP)"><span class="mask-icon plus-icon"></span></button>
        <button class="btn next center shadow">Следующий шаг</button>
      </template>
    </div>
    <div v-if="keypad" class="keypad">
      <button
        v-for="key in KEYS"
        :key="key"
        class="key center"
        :class="{ 'btn next': key === 'next' }"
        @click.prevent="press(key)"
      >
        <span v-if="KEY_ICONS[key]" class="mask-icon" :class="KEY_ICONS[key]"></span>
        <template v-else>{{ key === 'next' ? 'Следующий шаг' : key }}</template>
      </button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </form>
</template>

<script setup>
import { MIN_LENGTH } from '~/ceiling/geometry'

// ====== Определение данных ======
// шаг 1 см
const LENGTH_STEP = 1
// своя клавиатура на телефоне, как в Easy Ceiling: системная сдвигает страницу
const KEYS = ['1', '2', '3', 'erase', '4', '5', '6', 'minus', '7', '8', '9', 'plus', ',', '0', 'next']
const KEY_ICONS = { erase: 'erase-icon', minus: 'minus-icon', plus: 'plus-icon' }
const MAX_TEXT = 7

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
const keypad = window.matchMedia('(pointer: coarse)').matches
// первая цифра заменяет старый размер, как при выделенном тексте
let fresh = true

// ====== Работа с полем ======
// без замера поле пустое: размер по наброску условный
function reset() {
  text.value = props.value ? formatNumber(roundLength(props.value)) : ''
  fresh = true
  if (keypad) return
  nextTick(() => {
    input.value.focus()
    input.value.select()
    console.log('focus', props.title)
  })
}

function changeBy(delta) {
  const next = parseNumber(text.value) + delta
  if (isNaN(next) || next < MIN_LENGTH) return
  text.value = formatNumber(roundLength(next))
  fresh = false
}

// ====== Своя клавиатура ======
function press(key) {
  console.log('key', key)
  if (key === 'next') return submit()
  if (key === 'minus') return changeBy(-LENGTH_STEP)
  if (key === 'plus') return changeBy(LENGTH_STEP)
  const current = fresh ? '' : text.value
  fresh = false
  if (key === 'erase') {
    text.value = current.slice(0, -1)
    return
  }
  if (key === ',' && current.includes(',')) return
  if (current.length >= MAX_TEXT) return
  text.value = current + (key === ',' && !current ? '0,' : key)
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
    // подпись над полем, «см» внутри поля справа
    .field
        position: relative
        display: flex
        flex: 0 0 100%
        flex-direction: column
        gap: 4px
        min-width: 0
    .name
        font-weight: 600
        color: var(--main-color)
        white-space: nowrap
    .value
        width: 100%
        height: 44px
        padding: 0 40px 0 12px
        border: 1px solid var(--border-color)
        border-radius: 8px
    .unit
        position: absolute
        right: 12px
        bottom: 0
        display: flex
        align-items: center
        height: 44px
        color: var(--disabled-color)
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
    .keypad
        display: grid
        grid-template-columns: repeat(4, 1fr)
        gap: 8px
        margin-top: 10px
    .key
        height: 48px
        border: 1px solid var(--border-color)
        border-radius: 8px
        font-size: 1.25rem
        color: var(--text-color)
        background: var(--card-color)
        &.next
            grid-column: span 2
            border: none
            font-size: 0.875rem
            color: var(--btn-text-color)
            background: var(--accent-color)
    .error
        margin-top: 8px
        color: var(--error-color)

// в боковой колонке на ПК лента в несколько строк, без прокрутки
@media (min-width: $bp-pc)
    .wall-input
        .edges
            flex-wrap: wrap
</style>
