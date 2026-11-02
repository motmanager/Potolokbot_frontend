<template>
  <form class="wall-input shadow" @submit.prevent="submit">
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
      <button class="btn center shadow">ОК</button>
      <button class="close center" @click.prevent="emit('close')"><span class="mask-icon close-icon"></span></button>
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
  error: { type: String, default: '' }
})
const emit = defineEmits(['apply', 'close'])

const input = ref(null)
const text = ref('')

// ====== Работа с полем ======
function reset() {
  text.value = formatNumber(roundLength(props.value))
  nextTick(() => {
    input.value.focus()
    input.value.select()
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

watch(() => props.title, reset)
onMounted(reset)
</script>

<style lang="sass">
@use '@/assets/styles/adaptive' as *

.wall-input
    margin: 0 8px
    padding: 10px 12px
    border-radius: 8px
    background: var(--card-color)
    .row
        display: flex
        align-items: center
        gap: 8px
    .field
        display: flex
        flex: 1
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
    .close
        width: 32px
        height: 44px
        border: none
        color: var(--main-color)
    .error
        margin-top: 8px
        color: var(--error-color)

// кнопки на второй строке, иначе поле не помещается
@media (max-width: $bp-pc)
    .wall-input
        .row
            flex-wrap: wrap
        .field
            flex: 0 0 100%
        .btn
            flex: 1
</style>
