<template>
  <section class="start-page">
    <div class="content">
      <div class="card shadow">
        <h1 class="h1">Прототип конструктора</h1>
        <nuxt-link class="btn center shadow" to="/constructor">Начать расчёт</nuxt-link>
      </div>
    </div>
  </section>
</template>

<style lang="sass">
.start-page
    padding: 48px 0
    .card
        display: flex
        flex-direction: column
        align-items: center
        gap: 20px
        max-width: 600px
        margin: 0 auto
        padding: 32px 24px
        border-radius: 12px
        text-align: center
        background: var(--card-color)
    .h1
        font-size: 1.625rem
</style>
