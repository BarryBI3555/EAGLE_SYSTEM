<!-- 人员路线地图页面 -->
<template>
  <div class="map-page">
    <UserMap />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import UserMap from './modules/user-map.vue'
  import { usePreload } from '@/hooks/core/usePreload'

  defineOptions({ name: 'Console' })


  // 预加载table_cur_gzl_ry组件，减少打开table_cur_gzl_ry页面时的加载时间

  
  const { preloadComponents, getPreloadedComponent, isLoading, isPreloaded } = usePreload();
  
  // 使用 sessionStorage 来追踪是否已经预加载过组件
  const PRELOAD_KEY = 'personalmap_preloaded';

  const preloadComponentsPages = async() => {
    // 检查是否已经预加载过
    if (sessionStorage.getItem(PRELOAD_KEY)) {
      console.log('组件已预加载过，跳过预加载');
      return;
    }

    setTimeout(async () => {
      try {
        await preloadComponents({
          table_cur_gzl_ry : () => import('../../efficiency/daily/periodic/table_cur_gzl_ry.vue'),
        });
        
        // 标记为已预加载
        sessionStorage.setItem(PRELOAD_KEY, 'true');
        
        console.log('预加载完成，组件可用:', isPreloaded('table_cur_gzl_ry'));
        console.log('预加载完成，组件实例:', getPreloadedComponent('table_cur_gzl_ry'));
      } catch (error) {
        console.warn('预加载失败:', error);
      }
    }, 2000); // 延迟2秒，让页面先渲染完成
  };

  onMounted(() => {
    preloadComponentsPages();
  });
    

</script>

<style scoped>
  .map-page {
    width: 100%;
    height: 75vh; /* 关键：让父级占满屏幕高度 */
    padding: 10px;
    box-sizing: border-box;
  }
</style>