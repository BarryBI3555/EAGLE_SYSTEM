<!-- 人员路线地图组件（可用版 qq.maps） -->
<template>
  <div class="user-map-container">
    <div id="map-container" class="map-container"></div>
    <div v-if="loading" class="loading">地图加载中...</div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

declare global {
  interface Window {
    qq: any
  }
}

const map = ref<any>(null)
const markers = ref<any[]>([])
const polyline = ref<any>(null)
const loading = ref(true)
const error = ref('')

// 初始化地图
const initMap = async () => {
  try {
    if (!window.qq || !window.qq.maps) {
      throw new Error("地图SDK加载失败")
    }

    // 成都中心
    const center = new window.qq.maps.LatLng(30.6799, 104.0571)
    
    map.value = new window.qq.maps.Map(document.getElementById("map-container"), {
      center: center,
      zoom: 12,
      draggable: true,
      scrollwheel: true
    })

    await fetchUserLocations()
    loading.value = false
  } catch (err: unknown) {
    console.error('地图初始化失败', err)
    error.value = '地图加载失败'
    loading.value = false
  }
}

// 获取后端数据并绘制路线 + 点
const fetchUserLocations = async () => {
  try {
    const res = await fetch('http://localhost:8080/api/locations')
    const data = await res.json()
    console.log('获取数据:', data)

    clearOverlays()
    if (!data || data.length === 0) return

    // 构造坐标点
    const path = data.map((item: any) => 
      new window.qq.maps.LatLng(item.latitude, item.longitude)
    )

    // 绘制路线
    const line = new window.qq.maps.Polyline({
      map: map.value,
      path: path,
      strokeColor: '#FF4E4F',
      strokeWeight: 4
    })
    polyline.value = line

    // 绘制点 + 弹窗
    data.forEach((item: any) => {
      const pos = new window.qq.maps.LatLng(item.latitude, item.longitude)
      const marker = new window.qq.maps.Marker({
        position: pos,
        map: map.value
      })
      markers.value.push(marker)

      // 点击弹窗
      const info = new window.qq.maps.InfoWindow({
        content: `
          <div style="padding:8px;">
            用户：${item.usercode}<br>
            时间：${item.createTime}<br>
            经纬度：${item.latitude}, ${item.longitude}
          </div>
        `
      })

      window.qq.maps.event.addListener(marker, 'click', () => {
        info.open(map.value, marker)
      })
    })

    // 自适应视野
    map.value.fitBounds(new window.qq.maps.LatLngBounds(path[0], path[path.length - 1]))
  } catch (e) {
    console.error('获取数据失败', e)
    error.value = '后端接口异常'
  }
}

// 清理覆盖物
const clearOverlays = () => {
  if (map.value) {
    markers.value.forEach(m => m.setMap(null))
    if (polyline.value) polyline.value.setMap(null)
  }
  markers.value = []
  polyline.value = null
}

onMounted(() => {
  initMap()
})

onUnmounted(() => {
  clearOverlays()
  map.value = null
})
</script>

<style scoped>
.user-map-container {
  width: 100%;
  height: 100%;
  position: relative;
}
.map-container {
  width: 100%;
  height: 500px;
}
.loading, .error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.error {
  color: #f56c6c;
}
</style>