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
  padding: 20px;
}
</style>
