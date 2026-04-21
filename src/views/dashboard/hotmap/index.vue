<!-- 人员路线地图页面 -->
<template>
  <div class="map-page">
    <h3>⭐敬请期待...</h3>
    <HotMap />
  </div>
</template>

<script setup lang="ts">
  import HotMap from './modules/hot-map.vue'

  defineOptions({ name: 'HotMap' })
</script>

<style scoped>
  .map-page {
    width: 100%;
    height: 75vh; /* 关键：让父级占满屏幕高度 */
    padding: 10px;
    box-sizing: border-box;
  }
</style>
