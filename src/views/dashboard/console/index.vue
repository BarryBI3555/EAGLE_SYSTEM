<!-- 人员路线地图页面 -->
<template>
  <div class="map-page">
    <UserMap />
  </div>
</template>

<script setup lang="ts">
  import UserMap from './modules/user-map.vue'

  defineOptions({ name: 'Console' })
</script>

<style scoped>
  .map-page {
    width: 100%;
    height: 75vh; /* 关键：让父级占满屏幕高度 */
    padding: 10px;
    box-sizing: border-box;
  }
</style>
