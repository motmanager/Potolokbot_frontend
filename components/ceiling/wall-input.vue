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
        >
        <span class="unit">см</span>
      </label>
      <button class="btn center shadow">ОК</button>
      <button class="close center" @click.prevent="emit('close')"><span class="mask-icon close-icon"></span></button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </form>
</template>

<script setup>
// ====== Определение данных ======
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
  text.value = String(roundLength(props.value))
  nextTick(() => {
    input.value.focus()
    input.value.select()
  })
}

function submit() {
  emit('apply', parseNumber(text.value))
}

watch(() => props.title, reset)
onMounted(reset)
</script>

<style lang="sass">
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
    .close
        width: 32px
        height: 44px
        border: none
        color: var(--main-color)
    .error
        margin-top: 8px
        color: var(--error-color)
</style>
