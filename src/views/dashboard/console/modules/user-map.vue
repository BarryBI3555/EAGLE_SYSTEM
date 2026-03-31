<!-- 人员路线地图组件 -->
<template>
  <div class="user-map-container">
    <div class="map-content">
      <div id="map-container" class="map-container"></div>
      <div v-if="loading" class="loading">地图加载中...</div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>

    <div class="user-list">
      <!-- 固定顶部区域 -->
      <div class="user-list-fixed">
        <div class="title-row">
          <h3 class="user-list-title">人员列表</h3>
          <img
            src="@/assets/images/icon/Home.png"
            class="home-img-btn"
            @click="goToHomePage"
            title="返回主页"
          >
        </div>

        <div class="time-filter">
          <el-date-picker
            v-model="selectedDate"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%; margin-bottom: 12px"
          />
          <el-button type="primary" @click="filterUsers" style="width: 100%">
            筛选
          </el-button>
        </div>
      </div>

      <!-- 滚动列表 -->
      <div class="user-list-scroll">
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
            <span class="user-code">
              {{ user.username || user.usercode }}
              <span v-if="user.username && user.usercode" class="user-code-sub">
                ({{ user.usercode }})
              </span>
            </span>
            <span class="user-time">{{ formatTime(user.createTime) }}</span>
          </div>
          <div class="user-card-body">
            <div class="user-location">
              <span class="label">经纬度</span>
              <span class="value">{{ `${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}` }}</span>
            </div>
            <div class="user-info" v-if="user.ckl || user.dsl">
              查勘量: {{ user.ckl || '-' }} &nbsp;&nbsp;|&nbsp;&nbsp; 定损量: {{ user.dsl || '-' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

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

const playMarker = ref<any>(null)
const playTimer = ref<any>(null)
const playSpeed = ref(16)

const today = new Date()
const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const selectedDate = ref<string | null>(formatDate(today))

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

let lastHeading = 0

const interpolatePath = (path: any[], segmentCount = 120) => {
  let smoothPath: any[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]
    const end = path[i + 1]
    for (let j = 0; j <= segmentCount; j++) {
      const t = j / segmentCount
      const lat = start.lat + (end.lat - start.lat) * t
      const lng = start.lng + (end.lng - start.lng) * t
      smoothPath.push(new window.qq.maps.LatLng(lat, lng))
    }
  }
  return smoothPath
}

const computeSmoothHeading = (from: any, to: any) => {
  const dy = to.lng - from.lng
  const dx = to.lat - from.lat
  let heading = Math.atan2(dy, dx) * 180 / Math.PI
  const diff = heading - lastHeading
  if (Math.abs(diff) > 180) {
    heading -= Math.sign(diff) * 360
  }
  lastHeading = heading
  return heading
}

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

const fetchLatestLocations = async (date?: string) => {
  try {
    let url = 'http://localhost:8080/api/locations/latest'
    if (date) url += `?date=${date}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP错误: ${res.status}`)
    const data = await res.json()
    console.log('最新人员数据：', data)

    clearOverlays()

    if (!data || data.length === 0) {
      userList.value = []
      return
    }

    userList.value = data

    userList.value.forEach((user) => {
      const pos = new window.qq.maps.LatLng(user.latitude, user.longitude)
      const marker = new window.qq.maps.Marker({
        position: pos,
        map: map.value,
        title: `${user.username || ''} (${user.usercode})`,
        icon: 'src/assets/images/icon/Location.png' 
      })
      markers.value.push(marker)

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

const filterUsers = async () => {
  await fetchLatestLocations(selectedDate.value || undefined)
}

const goToHomePage = async () => {
  selectedUser.value = ''
  clearOverlays()
  await fetchLatestLocations(selectedDate.value || undefined)
}

const showUserHistory = async (usercode: string) => {
  try {
    selectedUser.value = usercode
    clearOverlays()
    lastHeading = 0

    let url = `http://localhost:8080/api/locations/user/${usercode}`
    if (selectedDate.value) url += `?date=${selectedDate.value}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP错误: ${res.status}`)
    const data = await res.json()

    if (!data || data.length === 0) {
      error.value = '该用户当日无轨迹数据'
      return
    }

    const sortedPath = data.sort((a: any, b: any) =>
      new Date(a.createTime).getTime() - new Date(b.createTime).getTime()
    )

    const path = sortedPath.map((item: any) =>
      new window.qq.maps.LatLng(item.latitude, item.longitude)
    )

    const line = new window.qq.maps.Polyline({
      map: map.value,
      path: path,
      strokeColor: '#409EFF',
      strokeWeight: 4,
      strokeOpacity: 0.6
    })
    polylines.value.push(line)

    const startPoint = path[0]
    const endPoint = path[path.length - 1]

    const startMarker = new window.qq.maps.Marker({
      position: startPoint,
      map: map.value,
      icon: new window.qq.maps.MarkerImage(
        'src/assets/images/icon/FirstPoint.png',
        new window.qq.maps.Size(20, 20),
        null,
        new window.qq.maps.Point(12, 20),
        new window.qq.maps.Size(20, 20)
      ),
      zIndex: 100
    })
    markers.value.push(startMarker)

    const endMarker = new window.qq.maps.Marker({
      position: endPoint,
      map: map.value,
      icon: new window.qq.maps.MarkerImage(
        'src/assets/images/icon/EndPoint.png',
        new window.qq.maps.Size(20, 20),
        null,
        new window.qq.maps.Point(12, 20),
        new window.qq.maps.Size(20, 20)
      ),
      zIndex: 100
    })
    markers.value.push(endMarker)

    playMarker.value = new window.qq.maps.Marker({
      position: path[0],
      map: map.value,
      icon: new window.qq.maps.MarkerImage(
        'src/assets/images/icon/car.png',
        new window.qq.maps.Size(36, 36),
        null,
        null,
        new window.qq.maps.Size(36, 36)
      ),
      zIndex: 999,
      anchor: new window.qq.maps.Point(18, 18)
    })

    startPlay(path)

    const bounds = new window.qq.maps.LatLngBounds()
    path.forEach((p: any) => bounds.extend(p))
    map.value.fitBounds(bounds)

    error.value = ''
  } catch (e) {
    console.error('获取轨迹失败详情:', e)
    error.value = `获取轨迹失败: ${(e as Error).message}`
  }
}

const startPlay = (path: any[]) => {
  if (playTimer.value) clearInterval(playTimer.value)
  const smoothPath = interpolatePath(path, 200)
  let index = 0
  const len = smoothPath.length

  const run = () => {
    if (index >= len) {
      index = 0
    }

    const curr = smoothPath[index]
    const next = smoothPath[Math.min(index + 1, len - 1)]
    const heading = computeSmoothHeading(curr, next)

    playMarker.value.setPosition(curr)
    playMarker.value.setRotation(heading)

    index++
  }

  playTimer.value = setInterval(run, playSpeed.value)
}

const clearOverlays = () => {
  if (playTimer.value) clearInterval(playTimer.value)
  if (playMarker.value) {
    playMarker.value.setMap(null)
    playMarker.value = null
  }

  if (map.value) {
    markers.value.forEach(m => m.setMap(null))
    polylines.value.forEach(p => p.setMap(null))
  }
  markers.value = []
  polylines.value = []
}

onMounted(() => {
  initMap()
})

onBeforeUnmount(() => {
  clearOverlays()
  map.value = null
})
</script>

<style scoped>
/* 日期选择器选中后文字变黑色 */
:deep(.el-input__inner) {
  color: #1d2129 !important;
  --el-input-text-color: #1d2129 !important;
}
:deep(.el-input__inner::placeholder) {
  color: #999 !important;
}

.user-map-container {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
  background: #f5f7fa;
}

.map-content {
  flex: 1;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.map-container {
  width: 100%;
  height: 500px;
}

/* 右侧人员面板 */
.user-list {
  width: 320px;
  height: 500px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 固定顶部区域 */
.user-list-fixed {
  flex-shrink: 0;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f2f5;
  margin-bottom: 8px;
}

.title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.user-list-title {
  font-size: 18px;
  font-weight: 600;
  color: #1d2129;
  margin: 0;
  letter-spacing: 0.5px;
}

.home-img-btn {
  width: 26px;
  height: 26px;
  cursor: pointer;
  transition: all 0.25s ease;
  opacity: 0.85;
}
.home-img-btn:hover {
  opacity: 1;
  transform: scale(1.08);
}

.time-filter {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 滚动区域 —— 超细 + 透明 + 靠右 */
.user-list-scroll {
  flex: 1;
  overflow-y: auto;
  padding-top: 12px;
  padding-bottom: 4px;
  padding-right: 0px !important;
  margin-right: -8px;
}
.user-list-scroll::-webkit-scrollbar {
  width: 2px !important;
  height: 2px !important;
}
.user-list-scroll::-webkit-scrollbar-thumb {
  background: rgba(150, 150, 150, 0.3) !important;
  border-radius: 10px !important;
  opacity: 0.4 !important;
}
.user-list-scroll::-webkit-scrollbar-track {
  background: transparent !important;
}

/* 人员卡片 */
.user-card {
  background: #ffffff;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.28s ease;
  border: 1px solid #f0f2f5;
}

/* 悬浮：轻微上移 + 阴影加深 */
.user-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  border-color: #409EFF;
}

.user-card.active {
  border-color: #409EFF;
  background: linear-gradient(135deg, #edf7ff 0%, #e8f3ff 100%);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

/* 卡片内容 */
.user-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.user-code {
  font-weight: 600;
  font-size: 15px;
  color: #222;
}
.user-code-sub {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
  font-weight: normal;
}
.user-time {
  font-size: 12px;
  color: #86909c;
  white-space: nowrap;
}

.user-card-body {
  font-size: 14px;
  line-height: 1.5;
}
.user-location {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.user-location .label {
  color: #4e5969;
  font-weight: 500;
  font-size: 13px;
}
.user-location .value {
  color: #1d2129;
  font-family: monospace;
  font-size: 13px;
}
.user-info {
  font-size: 12px;
  color: #666;
  padding-top: 6px;
  border-top: 1px dashed #f0f2f5;
  margin-top: 6px;
}

/* 状态 */
.loading, .error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  font-size: 14px;
}
.error {
  color: #f56c6c;
}
.user-list-loading, .user-list-empty {
  padding: 50px 0;
  color: #999;
  text-align: center;
  font-size: 14px;
}

@media (max-width: 768px) {
  .user-map-container {
    flex-direction: column;
    gap: 16px;
  }
  .user-list {
    width: 100%;
    height: auto;
    max-height: 280px;
  }
}
</style>