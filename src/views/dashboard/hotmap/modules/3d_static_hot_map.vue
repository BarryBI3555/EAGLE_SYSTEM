<template>
  
    <div class="search-date-row" style="margin-top: 10px">
        <el-date-picker
            v-model="selectedDate"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            class="date-picker"
            @change="fetchHeatMap"
        />
        <el-button type="primary" @click="fetchHeatMap">筛选</el-button>
    </div>
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
  import { MapLoader } from '@/utils/mapLoader'
  const VITE_API_PROXY_PORT_URL= import.meta.env.VITE_API_PROXY_PORT_URL
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

  // 地图加载器实例
  const mapLoader = MapLoader.getInstance()

  // ==================== 动态加载官方热力数据（你要的Promise方式） ====================
    // 选择日期
  const today = new Date()
  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const selectedDate = ref<string | null>(formatDate(today))

//   const loadHeatDataScript = () => {
//     return new Promise((resolve, reject) => {
//       const script = document.createElement('script')
//       script.src = `${VITE_TENCENT_MAP_WSAPI_URL}web/lbs/visualizationApi/demo/data/heat.js`
//       script.onload = resolve
//       script.onerror = reject
//       document.body.appendChild(script)
//     })
//   }
const fetchHeatMap = async () => {
    try{
        let url=`${VITE_API_PROXY_PORT_URL}api/hotmap`
        if(selectedDate.value){
            url+=`?date=${selectedDate.value}`
        }
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        window.heatData = data
        
        // 更新热力图数据
        if (heat) {
          heat.setData(window.heatData)
          console.log(window.heatData)
        }
    } catch (err: any) {
        error.value = '热力图加载失败：' + err.message
        loading.value = false
    }
    
  }



  // ==================== 初始化地图 ====================
  const initMap = async () => {
    try {
      // 使用MapLoader加载地图API
      await mapLoader.loadMapApi()

      const container = document.getElementById('heat-map-container')
      if (!container) return

    
      const center = new window.TMap.LatLng(30.6799, 104.0571)

      // 创建地图
      map = new window.TMap.Map(container, {
        zoom: 12,
        pitch: 45,
        center: center,
        mapStyleId: 'style1', // 根据HTML文件修改
        baseMap: {
          type: 'vector',
          features: ['base', 'building3d']
        }
      })
      await fetchHeatMap()
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
      max: 10, // 热力最强阈值
      min: 0, // 热力最弱阈值
      height: 40, // 峰值高度
      radius: 30 // 最大辐射半径
    }).addTo(map)
    console.log(window.heatData)
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
    // 清理地图加载器（可选）
    // mapLoader.reset()
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