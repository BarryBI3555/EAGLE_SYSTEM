<template>
  <div class="heat-map-page">
    <!-- <h3 class="hot-map-title">案件量热图</h3> -->
    <div class="map-container-box">
      
      <div id="heat-map-container" class="map-container">
        
        <div class="search-date-row">
          <!-- <h3 class="hot-map-title">案件量热图</h3> -->
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
          <!-- 行政区划按钮 -->
          <img
            src="@/assets/images/icon/网格.png"
            class="district-img-btn"
            @click="toggleDistricts"
            title="显示/隐藏行政区划"
          />
        </div>
      </div>
      <div v-if="loading" class="loading">地图加载中...</div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { AdministrativeRegionManager } from '../../personalmap/modules/AdministrativeRegionmanager'
import { MapLoader } from '@/utils/mapLoader'
const VITE_API_PROXY_PORT_URL = import.meta.env.VITE_API_PROXY_PORT_URL
// 全局类型声明
declare global {
  interface Window {
    TMap: any
    heatData: any[]
    districtLabelLayer?: any
  }
}

// 地图实例
let map: any = null
let heat: any = null
let administrativeRegionManager: AdministrativeRegionManager | null = null

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
  try {
    let url = `${VITE_API_PROXY_PORT_URL}api/hotmap`
    if (selectedDate.value) {
      url += `?date=${selectedDate.value}`
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

// ==================== 行政区划功能 ====================
const toggleDistricts = () => {
  if (administrativeRegionManager) {
    administrativeRegionManager.toggleDistricts()
  }
}

const showDistricts = async () => {
  if (administrativeRegionManager) {
    await administrativeRegionManager.showDistricts()
  }
}

const hideDistricts = async () => {
  if (administrativeRegionManager) {
    await administrativeRegionManager.hideDistricts()
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
      zoom: 9.5,
      pitch: 45,
      center: center,
      mapStyleId: 'style1', // 根据HTML文件修改
      
      // baseMap: {
      //   type: 'vector',
      //   features: [
      //     'base', 
      //     'building3d',
      //     'arrow',//箭头
      //     'label'//标签
      //   ]
      // }
    })
    
    // 初始化行政区划管理器
    administrativeRegionManager = new AdministrativeRegionManager(map)

    // 先初始化热力图，再加载数据
    initHeatMap()
    await fetchHeatMap()
    
    // 默认显示行政区划
    await showDistricts()
    
    loading.value = false
  } catch (err: any) {
    error.value = '地图加载失败：' + err.message
    loading.value = false
  }
}

// ==================== 初始化3D热力图 ====================
const initHeatMap = () => {
  heat = new window.TMap.visualization.Heat({
    max: 3, // 热力最强阈值
    min: 0, // 热力最弱阈值
    height: 100, // 峰值高度
    radius: 25, // 最大辐射半径
    transitAnimation: {
        duration: 3000, //动画时长
      },
      
  }).addTo(map)
  console.log(window.heatData)
  heat.setData(window.heatData)
  heat.setGradientColor({
    start: '#FF0000',
    end: '#00FF00'
  })
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
  height: 100%;
  /* background: #111827; */

}


.map-container-box {
  width: 100%;
  height: 100%;
  position: relative;
}

.map-container {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  position: relative;
}

.search-date-row {
  display: flex;
  gap: 8px;
  align-items: center;
  position: absolute;
  left: 20px;
  top: 20px;
  z-index: 9999;
  padding: 10px;
  background: rgba(31, 41, 55, 0.9);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}

.search-date-row .el-date-picker {
  width: auto;
  min-width: 140px;
}

.search-date-row .el-button {
  pointer-events: auto;
}

.hot-map-title {
  position: relative;
  width: auto;
  font-size: 18px;
  font-weight: 600;
  color: #f3f4f6;
  padding-left:10px;
  padding-top:5px;
  padding-bottom: 5px;
  margin-bottom: 10px;
  white-space: nowrap;
  background: rgba(31, 41, 55, 0.9);
  border-radius: 8px;

}
.district-img-btn {
  width: 25px;
  height: 25px;
  cursor: pointer;
  transition: all 0.25s ease;
  opacity: 0.85;
  filter: brightness(0) invert(1);
  flex-shrink: 0;
  border: 1px solid #9ca3af; /* 添加边框 */
  border-radius: 4px; /* 可选：添加圆角 */
  padding: 4px; /* 可选：添加内边距 */
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

<style scoped>
.heat-map-page {
  width: 100%;
  height: 100%;
  /* background: #111827; */

}

.map-container-box {
  width: 100%;
  height: 100%;
  position: relative;
}

.map-container {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  position: relative;
}

.search-date-row {
  display: flex;
  gap: 8px;
  align-items: center;
  position: absolute;
  left: 20px;
  top: 20px;
  z-index: 9999;
  padding: 10px;
  background: rgba(31, 41, 55, 0.9);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
}

.search-date-row .el-date-picker {
  width: auto;
  min-width: 140px;
}

.search-date-row .el-button {
  pointer-events: auto;
}

.hot-map-title {
  position: relative;
  width: auto;
  font-size: 18px;
  font-weight: 600;
  color: #f3f4f6;
  padding-left:10px;
  padding-top:5px;
  padding-bottom: 5px;
  margin-bottom: 10px;
  white-space: nowrap;
  background: rgba(31, 41, 55, 0.9);
  border-radius: 8px;

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