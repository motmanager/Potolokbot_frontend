<template>
  <section class="constructor-page">
    <div class="content">
      <h1 class="h1">Схема комнаты</h1>
      <div class="list">
        <ceiling-card v-for="entry in ceilings" :key="entry.number" :entry="entry" @edit="editorOpen = true" />
      </div>
      <!-- новый потолок, когда прошлые уже построены -->
      <button v-if="allBuilt" class="btn secondary add center shadow" @click="draft.addCeiling">
        <span class="mask-icon plus-icon"></span>Добавить потолок
      </button>
    </div>

    <lazy-ceiling-editor v-if="editorOpen" @close="editorOpen = false" />
  </section>
</template>

<script setup>
// ====== Определение данных ======
const draft = useCeilingDraft()
const { ceilings } = draft

const editorOpen = ref(false)

// ====== Вычисляемые значения ======
const allBuilt = computed(() => ceilings.value.every((entry) => entry.data))
</script>

<style lang="sass">
.constructor-page
    padding: 24px 0
    .content
        display: flex
        flex-direction: column
        gap: 16px
        max-width: 600px
    .h1
        font-size: 1.5rem
    .list
        display: flex
        flex-direction: column
        gap: 16px
    .add
        gap: 8px
        min-height: 52px
</style>
