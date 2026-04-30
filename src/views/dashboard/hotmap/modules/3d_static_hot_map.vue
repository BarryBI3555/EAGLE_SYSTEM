<template>
  <div class="heat-map-page">
    <div class="map-container-box">
      <!-- 统计卡片部分 - 放在地图容器上方 -->
      <div class="controls-and-cards-container">
        <!-- 统计卡片部分 - 与控制按钮在同一样式容器内 -->
        <div class="stats-cards-top">
          <ElRow :gutter="10">
            <ElCol :xs="24" :sm="12" :md="6" v-for="card in statsCards" :key="card.id" class="mb-10">
              <div class="card-wrapper">
                <div class="art-card flex-c px-4 transition-transform duration-200 hover:-translate-y-0.5"
                  :class="card.boxStyle || ''">
                  <div v-if="card.localIcon" class="mr-4 size-11 flex-cc rounded-lg text-xl text-white"
                    :class="card.iconStyle">
                    <!-- 使用本地图片 -->
                    <img :src="card.localIcon" :alt="card.title" class="w-6 h-6 object-contain" />
                  </div>
                  <div v-else-if="card.icon" class="mr-4 size-11 flex-cc rounded-lg text-xl text-white"
                    :class="card.iconStyle">
                    <!-- 使用SVG图标 -->
                    <ArtSvgIcon :icon="card.icon"></ArtSvgIcon>
                  </div>
                  <div class="flex-1">

                    <ArtCountTo class="m-0 text-2xl font-medium" v-if="card.count !== undefined" :target="card.count"
                      :duration="2000" :decimals="0" :separator="' ,'" />
                    <p class="mt-1 text-sm text-g-500 opacity-90" v-if="card.description">{{ card.description }}</p>
                  </div>
                  <div v-if="card.showArrow">
                    <ArtSvgIcon icon="ri:arrow-right-s-line" class="text-xl text-g-500" />
                  </div>
                </div>
              </div>
            </ElCol>
            <!-- 控制按钮部分 -->
            <ElCol :xs="24" :sm="12" :md="6">
              <div xs="24" :sm="12" :md="6" class="search-date-row">
                <el-date-picker v-model="selectedDate" type="date" placeholder="选择日期" format="YYYY-MM-DD"
                  value-format="YYYY-MM-DD" class="date-picker" @change="fetchHeatMap" />
                <div class="flex-c">
                  <el-button type="primary" @click="fetchHeatMap">筛选</el-button>
                </div>
              </div>
            </ElCol>
          </ElRow>
        </div>
      </div>
      <div id="heat-map-container" class="map-container">
        <!-- 行政区划按钮 -->
        <div class="bottom-in-map">
          <img src="@/assets/images/icon/网格.png" class="district-img-btn" @click="toggleDistricts" title="显示/隐藏行政区划" />
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
import { ElRow, ElCol } from 'element-plus'
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
// 统计卡片默认数据
const statsCards = ref([
  {
    id: 1,
    title: '新增立案',
    count: 0,
    description: '当日新增立案量',
    localIcon: new URL('../../../../assets/images/icon/立案信息.png', import.meta.url).href, // 使用本地图标
    iconStyle: 'bg-primary',
    boxStyle: 'h-22',
    textColor: 'var(--theme-color)',
    showArrow: false
  },
  {
    id: 2,
    title: '已决案件',
    count: 0,
    description: '当日已决量',
    localIcon: new URL('../../../../assets/images/icon/已决.png', import.meta.url).href, // 使用本地图标
    iconStyle: 'bg-success',
    boxStyle: 'h-22',
    textColor: 'var(--theme-color)',
    showArrow: false
  },
  {
    id: 3,
    title: '未决案件',
    count: 0,
    description: '截止统计日期未决量',
    localIcon: new URL('../../../../assets/images/icon/未决管理.png', import.meta.url).href, // 使用本地图标
    iconStyle: 'bg-warning',
    boxStyle: 'h-22',
    textColor: 'var(--theme-color)',
    showArrow: false
  },])

// ==================== 获取统计卡片数据 ====================
const fetchStatsCardsData = async () => {
  try {
    let url = `${VITE_API_PROXY_PORT_URL}api/statsCardsData`
    if (selectedDate.value) {
      url += `?date=${selectedDate.value}`
    }

    // console.log('请求统计数据URL:', url)  // 调试信息

    const response = await fetch(url)
    // console.log('响应状态:', response.status)  // 调试信息

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    // console.log('后端返回数据:', data)  // 调试信息

    // 更新统计卡片数据
    statsCards.value.forEach(card => {
      const cardData = data.find((item: any) => item.title === card.title)
      // console.log(`匹配卡片 ${card.title}:`, cardData)  // 调试信息
      if (cardData) {
        card.count = cardData.count
        card.description = cardData.description
        // console.log(`更新卡片 ${card.title}: count=${card.count}, description=${card.description}`)  // 调试信息
      } else {
        // console.log(`未找到匹配的卡片数据: ${card.title}`)  // 调试信息
      }
    })
  } catch (err) {
    console.error('获取统计卡片数据失败:', err)
  }
}



// 地图加载器实例
const mapLoader = MapLoader.getInstance()

// ==================== 动态加载官方热力数据（你要的Promise方式） ====================
// 选择日期
const today = new Date()
const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate() - 1).padStart(2, '0')
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

    // 同时获取统计卡片数据
    await fetchStatsCardsData()
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

    // 获取统计卡片数据
    await fetchStatsCardsData()

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
    radius: 20, // 最大辐射半径
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
/* ==================== 主容器样式 ==================== */
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
  height: 88%;
  border-radius: 8px;
  position: relative;
}

.controls-and-cards-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  /* 控件和卡片之间的间距 */
  margin-bottom: 10px;
  /* 与地图保持10px距离 */
}



.search-date-row {
  display: flex;
  gap: 15px;
  align-items: center;
  height: 88px;
  /* 与卡片高度一致 */
  padding: 15px 15px;
  /* 调整内边距以适应高度 */
  background: var(--default-box-color, rgba(17, 17, 17, 0.9));
  border: 0.5px solid;
  border-radius: 16px;
  /* box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); */
  pointer-events: auto;
  /* margin-left: 5px; */
  min-width: 24%;
}

/* 深色主题下的样式 */
.dark .search-date-row {
  border-color: rgba(0, 0, 0, 0.8); /* 深色主题边框 */
}

/* 浅色主题下的样式 */
:not(.dark) .search-date-row {
  border-color: rgba(156, 163, 175, 0.20); /* 浅色主题边框 */
}


/* 调整日期选择器和按钮的高度 */
.search-date-row :deep(.el-date-editor.el-input),
.search-date-row :deep(.el-date-editor.el-input__wrapper) {
  height: 60px;
  font-size: 18px;
}

.search-date-row :deep(.el-button--default) {
  height: 60px !important;
  padding: 8px 16px; /* 调整按钮内边距以适应高度 */
  font-size: 18px;
}

.stats-cards-top {
  margin-bottom: 0;
  /* 已经通过gap控制间距 */
}

.hot-map-title {
  position: relative;
  width: auto;
  font-size: 18px;
  font-weight: 600;
  color: #f3f4f6;
  padding-left: 10px;
  padding-top: 5px;
  padding-bottom: 5px;
  margin-bottom: 10px;
  white-space: nowrap;
  background: rgba(31, 41, 55, 0.9);
  border-radius: 8px;

}

.district-img-btn {
  /* position: absolute; */
  width: 25px;
  height: 25px;
  cursor: pointer;
  transition: all 0.25s ease;
  opacity: 0.85;
  filter: brightness(0) invert(1);
  flex-shrink: 0;
  border: 1px solid #9ca3af;
  /* 添加边框 */
  border-radius: 4px;
  /* 可选：添加圆角 */
  padding: 4px;
  /* 可选：添加内边距 */
}

.loading,
.error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
}

.stats-cards-top {
  margin-bottom: 10px;
  /* 与地图保持10px距离 */
}

.card-wrapper {
  height: 70px;
  /* 减小高度 */
  min-width: 200px;
  margin-bottom: 8px;
  /* 添加底部间距 */
}

.bottom-in-map {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 9999;
}

.custom-height {
  height: 100px;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .card-wrapper {
    height: 65px;
    min-width: 180px;
  }
}

@media (max-width: 480px) {
  .card-wrapper {
    height: 60px;
    min-width: 160px;
  }

  .stats-cards-top .art-card {
    padding-left: 4px;
    padding-right: 4px;
  }
}
</style>

<!-- <style scoped>
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
  min-width: 80px;
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
</style> -->