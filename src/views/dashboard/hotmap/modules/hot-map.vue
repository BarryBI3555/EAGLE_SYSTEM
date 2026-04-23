<template>
  <div class="heat-map-page">
    <div class="map-container-box">
      <div id="heat-map-container" class="map-container"></div>
      <div v-if="loading" class="loading">地图加载中...</div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref } from 'vue'
  const VITE_TENCENT_MAP_WSAPI_URL = import.meta.env.VITE_TENCENT_MAP_WSAPI_URL
  // 全局类型声明
  declare global {
    interface Window {
      TMap: any
      heatData: any[]
    }
  }

  // 地图实例
  let map: any = null
  let heat: any = null

  // 状态
  const loading = ref(true)
  const error = ref('')

  // ==================== 动态加载官方热力数据（你要的Promise方式） ====================
  const loadHeatDataScript = () => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = `${VITE_TENCENT_MAP_WSAPI_URL}web/lbs/visualizationApi/demo/data/heat.js`
      script.onload = resolve
      script.onerror = reject
      document.body.appendChild(script)
    })
  }

  // ==================== 初始化地图 ====================
  const initMap = async () => {
    try {
      // 等待 TMap 加载（你已在index.html引入）
      let attempts = 0
      while (!window.TMap && attempts < 100) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        attempts++
      }
      if (!window.TMap) throw new Error('腾讯地图加载失败')

      // 动态加载热力数据
      await loadHeatDataScript()

      const container = document.getElementById('heat-map-container')
      if (!container) return

      // 官网中心点（北京）
      const center = new window.TMap.LatLng(39.909897147274364, 116.39756310116866)

      // 创建地图
      map = new window.TMap.Map(container, {
        zoom: 12,
        pitch: 45,
        center: center,
        mapStyleId: 'style1',
        baseMap: {
          type: 'vector',
          features: ['base', 'building3d']
        }
      })

      // 初始化热力图
      initHeatMap()
      loading.value = false
    } catch (err: any) {
      error.value = '地图加载失败：' + err.message
      loading.value = false
    }
  }

  // ==================== 初始化3D热力图 ====================
  const initHeatMap = () => {
    heat = new window.TMap.visualization.Heat({
      max: 180,
      min: 0,
      height: 40,
      radius: 30
    }).addTo(map)

    // 设置官网热力数据
    heat.setData(window.heatData)
  }

  // ==================== 生命周期 ====================
  onMounted(() => {
    initMap()
  })

  onBeforeUnmount(() => {
    if (map) {
      map.destroy()
      map = null
      heat = null
    }
  })
</script>

<style scoped>
  .heat-map-page {
    width: 100%;
    height: 100vh;
    background: #111827;
  }
  .map-container-box {
    width: 100%;
    height: 100%;
    position: relative;
  }
  .map-container {
    width: 100%;
    height: 100%;
  }
  .loading,
  .error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #fff;
  }
</style>
