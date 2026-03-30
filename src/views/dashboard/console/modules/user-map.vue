<!-- 人员路线地图组件 -->
<template>
  <div class="user-map-container">
    <div class="map-content">
      <div id="map-container" class="map-container"></div>
      <div v-if="loading" class="loading">地图加载中...</div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>
    <div class="user-list">
      <h3 class="user-list-title">人员列表</h3>

      <!-- 时间选择器 -->
      <div class="time-filter">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          placeholder="选择日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          style="width: 100%; margin-bottom: 12px"
          class="time-picker"
        />
        <el-button type="primary" @click="filterUsers" style="width: 100%">
          筛选
        </el-button>
      </div>

      <div v-if="loading" class="user-list-loading">加载中...</div>
      <div v-else-if="userList.length === 0" class="user-list-empty">暂无人员数据</div>
      <div
        v-for="user in userList"
        :key="user.usercode"
        class="user-card"
        :class="{ active: selectedUser === user.usercode }"
        @click="showUserHistory(user.usercode)"
      >
        <div class="user-card-header">
          <span class="user-code">{{ user.username || user.usercode }}</span>
          <span class="user-time">{{ formatTime(user.createTime) }}</span>
        </div>
        <div class="user-card-body">
          <div class="user-location">
            <span class="label">经纬度:</span>
            <span class="value">{{ `${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}` }}</span>
          </div>
          <div class="user-info" v-if="user.ckl || user.dsl">
            <span>查勘量: {{ user.ckl || '-' }} | 定损量: {{ user.dsl || '-' }}</span>
          </div>
        </div>
      </div>
    </div>
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
const polylines = ref<any[]>([])
const loading = ref(true)
const error = ref('')
const userList = ref<any[]>([])
const selectedUser = ref<string>('')

// 默认日期：今天
const today = new Date()
const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const selectedDate = ref<string | null>(formatDate(today))

// 格式化时间
const formatTime = (timeString: string) => {
  const date = new Date(timeString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 初始化地图
const initMap = async () => {
  try {
    if (!window.qq || !window.qq.maps) {
      throw new Error('地图SDK加载失败')
    }

    const center = new window.qq.maps.LatLng(30.6799, 104.0571)
    map.value = new window.qq.maps.Map(document.getElementById('map-container'), {
      center,
      zoom: 12,
      draggable: true,
      scrollwheel: true
    })

    await fetchLatestLocations()
    loading.value = false
  } catch (err: unknown) {
    console.error('地图初始化失败', err)
    error.value = '地图加载失败'
    loading.value = false
  }
}

// 获取【指定日期】所有用户最新位置
const fetchLatestLocations = async (date?: string) => {
  try {
    let url = 'http://localhost:8080/api/locations/latest'
    if (date) url += `?date=${date}`

    const res = await fetch(url)
    const data = await res.json()
    console.log('最新人员数据：', data)

    clearOverlays()
    if (!data || data.length === 0) {
      userList.value = []
      return
    }

    userList.value = data

    // 绘制标记
    userList.value.forEach((user) => {
      const pos = new window.qq.maps.LatLng(user.latitude, user.longitude)
      const marker = new window.qq.maps.Marker({
        position: pos,
        map: map.value,
        title: user.usercode
      })
      markers.value.push(marker)

      // 信息窗口
      const info = new window.qq.maps.InfoWindow({
        content: `
          <div style="padding:8px;">
            <strong>用户：</strong>${user.username || user.usercode}<br>
            <strong>时间：</strong>${formatTime(user.createTime)}<br>
            <strong>经纬度：</strong>${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}<br>
            <strong>CKL：</strong>${user.ckl || '-'} | <strong>DSL：</strong>${user.dsl || '-'}
          </div>
        `
      })

      window.qq.maps.event.addListener(marker, 'click', () => {
        info.open(map.value, marker)
      })
    })

    // 自适应视野
    if (markers.value.length) {
      const bounds = new window.qq.maps.LatLngBounds()
      markers.value.forEach((m) => bounds.extend(m.getPosition()))
      map.value.fitBounds(bounds)
    }
  } catch (e) {
    console.error('获取人员数据失败', e)
    error.value = '后端接口异常'
  }
}

// 筛选按钮
const filterUsers = async () => {
  await fetchLatestLocations(selectedDate.value || undefined)
}

// 查看用户【当日】轨迹
const showUserHistory = async (usercode: string) => {
  try {
    selectedUser.value = usercode
    clearOverlays()

    let url = `http://localhost:8080/api/locations/user/${usercode}`
    if (selectedDate.value) url += `?date=${selectedDate.value}`

    const res = await fetch(url)
    const data = await res.json()
    console.log('用户轨迹：', data)

    if (!data || data.length === 0) {
      error.value = '该用户当日无轨迹数据'
      return
    }

    // 绘制轨迹线
    const path = data.map((item: any) => new window.qq.maps.LatLng(item.latitude, item.longitude))
    const line = new window.qq.maps.Polyline({
      map: map.value,
      path,
      strokeColor: '#409EFF',
      strokeWeight: 4,
      strokeOpacity: 0.8
    })
    polylines.value.push(line)

    // 绘制轨迹点
    data.forEach((item: any, index: number) => {
      const pos = new window.qq.maps.LatLng(item.latitude, item.longitude)
      const marker = new window.qq.maps.Marker({
        position: pos,
        map: map.value,
        title: `点 ${index + 1}`
      })
      markers.value.push(marker)
    })

    // 聚焦轨迹
    const bounds = new window.qq.maps.LatLngBounds()
    path.forEach((p: any) => bounds.extend(p))
    map.value.fitBounds(bounds)

    error.value = ''
  } catch (e) {
    console.error('获取轨迹失败', e)
    error.value = '获取轨迹失败'
  }
}

// 清理地图覆盖物
const clearOverlays = () => {
  if (map.value) {
    markers.value.forEach((m) => m.setMap(null))
    polylines.value.forEach((p) => p.setMap(null))
  }
  markers.value = []
  polylines.value = []
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
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
}

.map-content {
  flex: 1;
  position: relative;
}

.map-container {
  width: 100%;
  height: 500px;
}

.user-list {
  width: 300px;
  height: 500px;
  overflow-y: auto;
  background-color: #f9f9f9;
  border-left: 1px solid #eaeaea;
  padding: 16px;
}

.user-list-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 16px;
  color: #333;
}

.time-filter {
  margin-bottom: 16px;
  width: 100%;
}

.user-card {
  background-color: white;
  border: 1px solid #eaeaea;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.user-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #409EFF;
}

.user-card.active {
  border-color: #409EFF;
  background-color: #ecf5ff;
}

.user-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.user-code {
  font-weight: bold;
  color: #333;
}

.user-time {
  font-size: 12px;
  color: #999;
}

.user-card-body {
  font-size: 14px;
  line-height: 1.5;
}

.user-location {
  display: flex;
  justify-content: space-between;
}

.user-info {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.user-location .label {
  color: #666;
}

.user-location .value {
  color: #333;
  font-family: monospace;
}

.loading,
.error,
.user-list-loading,
.user-list-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.error {
  color: #f56c6c;
}

.user-list-loading,
.user-list-empty {
  position: relative;
  top: auto;
  left: auto;
  transform: none;
  padding: 40px 0;
  color: #999;
}

@media (max-width: 768px) {
  .user-map-container {
    flex-direction: column;
  }

  .user-list {
    width: 100%;
    height: 200px;
    border-left: none;
    border-top: 1px solid #eaeaea;
  }
}
</style>