<!-- 查勘热力图页面 -->
<template>
  <div class="map-container">
    
    <!-- <h3>3D热力图</h3> -->
    <HotMap />
    
  </div>
</template>

<script setup lang="ts">
  import HotMap from './modules/3d_static_hot_map.vue'


  defineOptions({ name: 'HotMap' })
</script>

<style scoped>
  .map-container {
    width: 100%;
    height: 75vh; 
    padding: 10px;
    box-sizing: border-box;
    
  }

</style>
