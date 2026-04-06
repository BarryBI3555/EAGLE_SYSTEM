<template>
  <div class="user-map-container">
    <!-- 左侧：地图展示区域 -->
    <div class="map-content">
      <div id="map-container" class="map-container"></div>
      <div v-if="loading" class="loading">地图加载中...</div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>

    <!-- 右侧：人员列表 / 详情面板 -->
    <div class="user-list">
      <!-- 列表模式：默认展示人员卡片列表 -->
      <div v-if="!showDetailMode" class="list-mode">
        <!-- 顶部搜索筛选栏（固定不滚动） -->
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

          <div class="search-date-row">
            <!-- 日期选择器 -->
            <el-date-picker
              v-model="selectedDate"
              type="date"
              placeholder="选择日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              class="date-picker"
            />
            <!-- 人员搜索框 -->
            <el-input
              v-model="searchKeyword"
              placeholder="搜索姓名/工号"
              class="search-input"
              clearable
            />
          </div>

          <!-- 筛选按钮 -->
          <el-button
            type="primary"
            @click="filterUsers"
            style="width: 100%; margin-top: 10px"
          >
            筛选
          </el-button>
        </div>

        <!-- 人员列表滚动区域 -->
        <div class="user-list-scroll">
          <div v-if="loading" class="user-list-loading">加载中...</div>
          <div v-else-if="filteredUserList.length === 0" class="user-list-empty">暂无人员数据</div>

          <!-- 人员卡片列表 -->
          <div
            v-for="user in filteredUserList"
            :key="user.usercode"
            class="user-card"
            :class="{ active: selectedUser === user.usercode }"
            @click="showUserDetail(user)"
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
                <span class="label">当前地址</span>
                <span class="value">{{ user.address || '获取中...' }}</span>
              </div>
              <div class="user-info" v-if="user.ckl || user.dsl">
                查勘量: {{ user.ckl || '-' }} &nbsp;&nbsp;|&nbsp;&nbsp; 定损量: {{ user.dsl || '-' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 详情模式：点击人员卡片后展示轨迹详情 -->
      <div v-else class="detail-mode">
        <div class="detail-header">
          <div class="detail-top">
            <h2 class="detail-title">{{ currentDetailUser.username }}</h2>
            <el-button type="default" size="small" @click="backToList">返回列表</el-button>
          </div>
          <div class="detail-info-row">
            <div><label>工号</label><span>{{ currentDetailUser.usercode }}</span></div>
            <div><label>查询日期</label><span>{{ selectedDate }}</span></div>
            <div><label>查勘量</label><span>{{ currentDetailUser.ckl || '-' }}</span></div>
            <div><label>定损量</label><span>{{ currentDetailUser.dsl || '-' }}</span></div>
          </div>
        </div>

        <!-- 轨迹记录列表（可滚动） -->
        <div class="detail-path-list">
          <div class="path-title">轨迹经纬度记录</div>
          <div
            v-for="(item, idx) in currentUserPathList"
            :key="idx"
            class="path-item"
          >
            <div class="path-time">{{ formatTime(item.createTime) }}</div>
            <div class="path-coord">
              {{ item.address || '解析中...' }}
            </div>
          </div>
          <div v-if="!currentUserPathList.length" class="no-path">暂无轨迹点</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'

// 声明全局地图对象，避免TS报错
declare global {
  interface Window {
    qq: any
  }
}

// ==================== 地图实例与覆盖物管理 ====================
// 地图实例
const map = ref<any>(null)
// 所有标记点（人员、起点、终点）
const markers = ref<any[]>([])
// 轨迹线
const polylines = ref<any[]>([])

// ==================== 页面状态 ====================
const loading = ref(true)
const error = ref('')

// ==================== 人员数据 ====================
const userList = ref<any[]>([])
// 当前选中的人员工号
const selectedUser = ref<string>('')

// ==================== 搜索筛选 ====================
const searchKeyword = ref('')
// 计算属性：根据关键词过滤人员列表
const filteredUserList = computed(() => {
  if (!searchKeyword.value) return userList.value
  const kw = searchKeyword.value.toLowerCase()
  return userList.value.filter(u => {
    const name = (u.username || '').toLowerCase()
    const code = (u.usercode || '').toLowerCase()
    return name.includes(kw) || code.includes(kw)
  })
})

// ==================== 详情面板状态 ====================
// 是否显示详情模式
const showDetailMode = ref(false)
// 当前查看详情的人员信息
const currentDetailUser = ref<any>(null)
// 当前人员的轨迹列表
const currentUserPathList = ref<any[]>([])

// ==================== 轨迹动画相关 ====================
// 动画小车标记
const playMarker = ref<any>(null)
// 动画定时器
const playTimer = ref<any>(null)
// 动画速度
const playSpeed = ref(16)
// 上一次方向角度（用于平滑旋转）
let lastHeading = 0

// ==================== 日期时间格式化 ====================
// 获取今天日期（YYYY-MM-DD）
const today = new Date()
const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
// 默认选中今天
const selectedDate = ref<string | null>(formatDate(today))

// 格式化时间：年-月-日 时:分:秒
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

// ==================== 轨迹平滑动画工具 ====================
/**
 * 轨迹插值：让轨迹动画更流畅
 * @param path 原始轨迹点
 * @param segmentCount 插值密度
 * @returns 平滑后的轨迹数组
 */
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

/**
 * 计算小车朝向（平滑旋转，不跳变）
 */
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

// ==================== 地图初始化 ====================
const initMap = async () => {
  try {
    if (!window.qq || !window.qq.maps) {
      throw new Error('地图SDK加载失败')
    }

    // 初始化地图中心点与配置
    const center = new window.qq.maps.LatLng(30.6799, 104.0571)
    map.value = new window.qq.maps.Map(document.getElementById('map-container'), {
      center,
      zoom: 12,
      draggable: true,
      scrollwheel: true
    })

    // 加载人员最新位置
    await fetchLatestLocations()
    loading.value = false
  } catch (err: unknown) {
    console.error('地图初始化失败', err)
    error.value = '地图加载失败'
    loading.value = false
  }
}

// ==================== 获取所有人员最新位置 ====================
const fetchLatestLocations = async (date?: string) => {
  try {
    let url = 'http://localhost:8080/api/locations/latest'
    if (date) url += `?date=${date}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP错误: ${res.status}`)
    const data = await res.json()

    // 清除旧的地图覆盖物
    clearOverlays()
    if (!data || data.length === 0) {
      userList.value = []
      return
    }

    userList.value = data

    // 为每个人员添加地图标记
    userList.value.forEach((user) => {
      const pos = new window.qq.maps.LatLng(user.latitude, user.longitude)
      const marker = new window.qq.maps.Marker({
        position: pos,
        map: map.value,
        title: `${user.username || ''} (${user.usercode})`,
        icon: 'src/assets/images/icon/Location.png'
      })
      markers.value.push(marker)

      // 点击标记显示信息弹窗
      const info = new window.qq.maps.InfoWindow({
        content: `
          <div style="padding:8px;">
            <strong>用户：</strong>${user.username || user.usercode}<br>
            <strong>时间：</strong>${formatTime(user.createTime)}<br>
            <strong>经纬度：</strong>${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}<br>
            <strong>CKL：</strong>${user.ckl || '-'} | <strong>DSL：</strong>${user.dsl || '-'}`
      })

      window.qq.maps.event.addListener(marker, 'click', () => {
        info.open(map.value, marker)
      })
    })

    // 自动调整视野，显示所有标记
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

// ==================== 筛选按钮事件 ====================
const filterUsers = async () => {
  await fetchLatestLocations(selectedDate.value || undefined)
}

// ==================== 返回主页：重置所有状态 ====================
const goToHomePage = async () => {
  selectedUser.value = ''
  searchKeyword.value = ''
  showDetailMode.value = false
  clearOverlays()
  await fetchLatestLocations(selectedDate.value || undefined)
}

// ==================== 从详情页返回列表 ====================
const backToList = () => {
  showDetailMode.value = false
  currentDetailUser.value = null
  currentUserPathList.value = []
  selectedUser.value = ''
}

// ==================== 点击卡片：显示人员详情 ====================
const showUserDetail = async (user: any) => {
  selectedUser.value = user.usercode
  showDetailMode.value = true
  currentDetailUser.value = user
  // 加载该人员历史轨迹
  await showUserHistory(user.usercode)
}

// ==================== 获取单人历史轨迹并绘制 ====================
const showUserHistory = async (usercode: string) => {
  try {
    clearOverlays()
    lastHeading = 0

    let url = `http://localhost:8080/api/locations/user/${usercode}`
    if (selectedDate.value) url += `?date=${selectedDate.value}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP错误: ${res.status}`)
    const data = await res.json()

    if (!data || data.length === 0) {
      error.value = '该用户当日无轨迹数据'
      currentUserPathList.value = []
      return
    }

    // 地图绘制：按时间正序
    const sortedPath = data.sort((a: any, b: any) =>
      new Date(a.createTime).getTime() - new Date(b.createTime).getTime()
    )
    // 列表展示：最新时间在前
    const reversePath = [...data].sort((a: any, b: any) =>
      new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
    )
    currentUserPathList.value = reversePath

    // 构造地图经纬度数组
    const path = sortedPath.map((item: any) =>
      new window.qq.maps.LatLng(item.latitude, item.longitude)
    )

    // 绘制轨迹线
    const line = new window.qq.maps.Polyline({
      map: map.value,
      path: path,
      strokeColor: '#FF5722',
      strokeWeight: 4,
      strokeOpacity: 0.4
    })
    polylines.value.push(line)

    // 起点标记
    const startMarker = new window.qq.maps.Marker({
      position: path[0],
      map: map.value,
      icon: new window.qq.maps.MarkerImage(
        'src/assets/images/icon/FirstPoint.png',
        new window.qq.maps.Size(24, 24),
        null,
        new window.qq.maps.Point(12, 24),
        new window.qq.maps.Size(24, 24)
      ),
      zIndex: 100
    })
    markers.value.push(startMarker)

    // 终点标记
    const endMarker = new window.qq.maps.Marker({
      position: path[path.length - 1],
      map: map.value,
      icon: new window.qq.maps.MarkerImage(
        'src/assets/images/icon/EndPoint.png',
        new window.qq.maps.Size(24, 24),
        null,
        new window.qq.maps.Point(12, 24),
        new window.qq.maps.Size(24, 24)
      ),
      zIndex: 100
    })
    markers.value.push(endMarker)

    // 小车动画标记
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

    // 开始播放动画
    startPlay(path)

    // 自动适配视野
    const bounds = new window.qq.maps.LatLngBounds()
    path.forEach((p: any) => bounds.extend(p))
    map.value.fitBounds(bounds)

    error.value = ''
  } catch (e) {
    console.error('获取轨迹失败:', e)
    error.value = `获取轨迹失败: ${(e as Error).message}`
  }
}

// ==================== 轨迹小车动画 ====================
const startPlay = (path: any[]) => {
  if (playTimer.value) clearInterval(playTimer.value)
  // 生成平滑轨迹
  const smoothPath = interpolatePath(path, 200)
  let index = 0
  const len = smoothPath.length

  const run = () => {
    if (index >= len) {
      index = 0
    }
    const curr = smoothPath[index]
    const next = smoothPath[Math.min(index + 1, len - 1)]
    // 计算朝向
    const heading = computeSmoothHeading(curr, next)
    // 更新位置与角度
    playMarker.value.setPosition(curr)
    playMarker.value.setRotation(heading)
    index++
  }

  playTimer.value = setInterval(run, playSpeed.value)
}

// ==================== 清空地图所有覆盖物与定时器 ====================
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

// ==================== 生命周期 ====================
// 页面挂载后初始化地图
onMounted(() => {
  initMap()
})

// 页面卸载前清理资源
onBeforeUnmount(() => {
  clearOverlays()
  map.value = null
})
</script>

<style scoped>
:deep(.el-input__inner) {
  color: #1d2129 !important;
  --el-input-text-color: #1d2129 !important;
}
:deep(.el-input__inner::placeholder) {
  color: #999 !important;
}

:deep(.el-date-editor.el-input--mini),
:deep(.el-date-editor.el-input),
:deep(.el-date-editor) {
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
}

.search-date-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.search-date-row .date-picker {
  flex: 1;
  min-width: 150px;
  max-width: 225px;
}
.search-date-row .search-input {
  flex: 1;
  min-width: 125px;
}

/* 布局容器 */
.user-map-container {
  display: flex;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
}

/* 地图区域 */
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

/* 右侧面板 */
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
  box-sizing: border-box;
}

/* 列表模式 */
.list-mode{
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 顶部搜索栏固定 */
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
  margin-bottom: 16px;
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

/* 列表滚动区域 */
.user-list-scroll {
  flex: 1;
  overflow-y: auto !important;
  padding-top: 12px;
  padding-bottom: 4px;
  box-sizing: border-box;
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
  gap: 30px;        /* 中间固定间隔 */
  align-items: flex-start;
  margin-bottom: 6px;
  line-height: 1.5;
}
.user-location .label {
  color: #4e5969;
  font-weight: 500;
  font-size: 13px;
  white-space: nowrap;
}
.user-location .value {
  color: #1d2129;
  font-size: 13px;
  flex: 1;
  text-align: right;      /* 右对齐 */
  white-space: pre-line;
  word-break: break-all; /* 自动换行 */
}
.user-info {
  font-size: 12px;
  color: #666;
  padding-top: 6px;
  border-top: 1px dashed #f0f2f5;
  margin-top: 6px;
}

/* 详情模式 */
.detail-mode {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-header {
  flex-shrink: 0;
  padding: 20px;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 12px;
  margin-bottom: 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.04);
}
.detail-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.detail-title {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  letter-spacing: 0.3px;
}
.detail-info-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 14px;
}
.detail-info-row div {
  display: flex;
  align-items: center;
}
.detail-info-row label {
  width: 68px;
  font-weight: 600;
  color: #64748b;
  font-size: 13px;
}
.detail-info-row span {
  color: #1e293b;
  font-weight: 500;
}

/* 轨迹列表 */
.detail-path-list {
  flex: 1;
  overflow-y: auto !important;
  padding-top: 8px;
  padding-right: 8px;
}

.path-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 12px;
  padding-left: 4px;
}
.path-item {
  padding: 14px;
  border-radius: 10px;
  background: #fafbfb;
  margin-bottom: 10px;
  border: 1px solid #f1f5f9;
  transition: all 0.2s ease;
}
.path-item:hover {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
}
.path-time {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 500;
}
.path-coord {
  font-size: 13px;
  font-family: 'Menlo', monospace;
  color: #1e293b;
  font-weight: 500;
}
.no-path {
  padding: 40px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

/* 加载与错误提示 */
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
  padding: 30px 0;
  color: #999;
  text-align: center;
  font-size: 14px;
}

/* 移动端适配 */
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

<style>
/* 自定义超细滚动条 */
.user-map-container .user-list-scroll::-webkit-scrollbar,
.user-map-container .detail-path-list::-webkit-scrollbar {
  width: 2px !important;
  height: 2px !important;
}
.user-map-container .user-list-scroll::-webkit-scrollbar-thumb,
.user-map-container .detail-path-list::-webkit-scrollbar-thumb {
  background: #c0c0c0 !important;
  border-radius: 10px !important;
}
.user-map-container .user-list-scroll::-webkit-scrollbar-track,
.user-map-container .detail-path-list::-webkit-scrollbar-track {
  background: transparent !important;
}
</style>