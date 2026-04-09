<template>
  <div class="Indicator-page">
    <indicator />
  </div>
</template>

<script setup lang="ts">
  import indicator from './modules/indicator.vue'

  defineOptions({ name: 'Indicator' })
</script>

<style scoped>
  .Indicator-page {
    width: 100%;
    height: 75vh; /* 关键：让父级占满屏幕高度 */
    padding: 10px;
    box-sizing: border-box;
  }
</style>