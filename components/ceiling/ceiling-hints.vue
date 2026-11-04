<template>
  <div class="ceiling-hints center" @click.self="emit('close')">
    <div class="card shadow">
      <h3 class="heading">Как построить комнату</h3>
      <ol class="list">
        <li v-for="hint in HINTS" :key="hint" class="item">{{ hint }}</li>
      </ol>
      <button class="btn center shadow" @click="emit('close')">Понятно</button>
    </div>
  </div>
</template>

<script setup>
// ====== Определение констант и данных ======
const HINTS = [
  'Нажимайте на поле, чтобы отметить углы комнаты. Форма примерная, точную задают размеры. Чтобы замкнуть контур, нажмите на точку A.',
  'Когда контур замкнут, введите длины стен по очереди. Кнопка «Следующий шаг» сохраняет размер и переходит к следующей стене.',
  'Стены без замера нарисованы пунктиром, введённые сплошной линией. Чтобы исправить размер, нажмите на стену на чертеже или в ленте над полем.',
  'Чтобы убрать угол, нажмите на него, затем «Удалить угол».',
  'Кнопка «Диагонали» показывает нужные диагонали. Введите их замеры, чтобы форма была точной.',
  'Если перетащить угол, замеры его стен и диагоналей сбросятся. Их нужно ввести заново.',
  'Чертёж двигается по пустому месту, масштаб меняется двумя пальцами или кнопками плюс и минус.'
]

const emit = defineEmits(['close'])
</script>

<style lang="sass">
.ceiling-hints
    position: absolute
    top: 0
    left: 0
    z-index: 1
    width: 100%
    height: 100%
    padding: 16px
    background: rgba(0, 0, 0, 0.4)
    .card
        display: flex
        flex-direction: column
        width: 100%
        max-width: 480px
        max-height: 100%
        padding: 20px
        border-radius: 8px
        background: var(--card-color)
    .heading
        margin-bottom: 12px
        font-size: 1.125rem
        color: var(--main-color)
    .list
        flex: 1
        min-height: 0
        margin-bottom: 16px
        padding-left: 20px
        overflow-y: auto
    .item
        margin-bottom: 8px
        list-style-type: decimal
</style>
