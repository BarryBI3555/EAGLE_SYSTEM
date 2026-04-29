<!-- 人员路线地图页面 -->
<template>
  <div class="map-page">
    <!-- <h3>3D热力图</h3> -->
    <HotMap />
  </div>
</template>

<script setup lang="ts">
  import HotMap from './modules/3d_static_hot_map.vue'

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
