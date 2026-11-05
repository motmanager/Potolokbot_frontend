<template>
  <div class="confirm-dialog center" @click.self="emit('no')">
    <div class="card shadow">
      <h3 class="heading">{{ title }}</h3>
      <p class="text">{{ text }}</p>
      <div class="buttons">
        <button class="btn secondary center shadow" @click="emit('no')">Нет</button>
        <button class="btn center shadow" @click="emit('yes')">Да</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: 'Внимание' },
  text: { type: String, required: true }
})

const emit = defineEmits(['yes', 'no'])
</script>

<style lang="sass">
.confirm-dialog
    position: absolute
    top: 0
    left: 0
    z-index: 1
    width: 100%
    height: 100%
    padding: 16px
    background: rgba(0, 0, 0, 0.4)
    .card
        width: 100%
        max-width: 320px
        padding: 20px
        border-radius: 8px
        text-align: center
        background: var(--card-color)
    .heading
        margin-bottom: 8px
        font-size: 1.125rem
        color: var(--main-color)
    .text
        margin-bottom: 20px
    .buttons
        display: grid
        grid-template-columns: 1fr 1fr
        gap: 8px
</style>
