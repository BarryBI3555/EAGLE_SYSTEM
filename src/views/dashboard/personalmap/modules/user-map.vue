<template>
  <div class="user-map-container">
    <!-- 左侧地图区域 -->
    <div class="map-content">
      <div id="map-container" class="map-container"></div>
      <div v-if="loading" class="loading">地图加载中...</div>
      <div v-if="error" class="error">{{ error }}</div>
      
    </div>

    <!-- 右侧面板容器 -->
    <div class="sidebar-container">
      <!-- 右侧人员列表 / 详情 -->
      <div class="user-list" :class="{ collapsed: isSidebarCollapsed }">
        <!-- 列表模式 -->
        <div v-if="!showDetailMode" class="list-mode">
          <div class="user-list-fixed">
            <!-- 第一行：标题 + 返回主页 + 行政区划-->
            <div class="top-title-row">
              <h3 class="user-list-title">人员列表</h3>
              <!-- 返回主页按钮 -->
              <div class="district-and-home-btns">
                <!-- 行政区划相关 -->
                <img
                  src="@/assets/images/icon/网格.png"
                  class="home-img-btn"
                  @click="toggleDistricts"
                  title="显示/隐藏行政区划"
                  position="left"
                />
                <img
                  src="@/assets/images/icon/Home.png"
                  class="home-img-btn"
                  @click="goToHomePage"
                  title="返回主页"
                  position="right"
                />
                
              </div>
            </div>
            <!-- 第二行：日期选择器 + 片区下拉框 -->
            <div class="search-date-row" style="margin-top: 10px">
              <el-date-picker
                v-model="selectedDate"
                type="date"
                placeholder="选择日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                class="date-picker"
                @change="fetchGroupList"
              />
              <el-select
                v-model="selectedGroupCode"
                placeholder="全部片区"
                class="group-select"
                clearable
              >
                <el-option
                  v-for="item in groupOptions"
                  :key="item.groupscode"
                  :label="item.groups"
                  :value="item.groupscode"
                />
              </el-select>
            </div>

            <!-- 第三行： 搜索框 + 筛选按钮 -->
            <div class="search-date-row" style="margin-top: 10px">
              <el-input
                v-model="searchKeyword"
                placeholder="搜索姓名/工号"
                class="search-input"
                clearable
              />
              <el-button type="primary" @click="filterUsers">筛选</el-button>
            </div>
          </div>

          <div class="user-list-scroll">
            <div v-if="loading" class="user-list-loading">加载中...</div>
            <div v-else-if="filteredUserList.length === 0" class="user-list-empty"
              >暂无人员数据</div
            >
            <div
              v-for="user in filteredUserList"
              :key="user.usercode"
              class="user-card"
              :class="{ active: selectedUser === user.usercode }"
              @click="showUserDetail(user)"
            >
              <!-- 人员姓名与工号 -->
              <div class="user-card-header">
                <span class="user-code">
                  {{ user.username || user.usercode }}
                  <span v-if="user.username && user.usercode" class="user-code-sub"
                    >({{ user.usercode }})</span
                  >
                </span>
                <span class="user-time">{{ formatTime(user.createTime) }}</span>
              </div>
              <div class="user-card-body">
                <div class="user-location">
                  <span class="label">当前位置</span>
                  <span class="value">{{ user.address || '获取中...' }}</span>
                </div>
                <div class="user-info" v-if="user.ckl || user.dsl">
                  查勘量: {{ user.ckl || '-' }} &nbsp;&nbsp;|&nbsp;&nbsp; 定损量:
                  {{ user.dsl || '-' }}
                </div>
                <div class="user-group" v-if="user.groups"> 所属片区：{{ user.groups }} </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 详情模式：轨迹回放 -->
        <div v-else class="detail-mode">
          <div class="detail-header">
            <div class="detail-top">
              <h2 class="detail-title">{{ currentDetailUser.username }}</h2>
              <el-button type="default" size="small" @click="backToList">返回列表</el-button>
            </div>
            <div class="detail-info-row">
              <div
                ><label>工号</label><span>{{ currentDetailUser.usercode }}</span></div
              >
              <div
                ><label>查询日期</label><span>{{ selectedDate }}</span></div
              >
              <div
                ><label>查勘量</label><span>{{ currentDetailUser.ckl || '-' }}</span></div
              >
              <div
                ><label>定损量</label><span>{{ currentDetailUser.dsl || '-' }}</span></div
              >
              <div
                ><label>所属片区</label><span>{{ currentDetailUser.groups || '-' }}</span></div
              >
            </div>
          </div>
          <div class="detail-path-list">
            <div class="path-title">轨迹经纬度记录</div>
            <div
              v-for="(item, idx) in currentUserPathList.filter(
                (item) =>
                  item.address &&
                  item.address.trim() !== '' &&
                  item.address !== '坐标无效' &&
                  item.address !== '解析异常'
              )"
              :key="idx"
              class="path-item"
              @click="showPointOnMap(item)"
            >
              <div class="path-time">{{ formatTime(item.createTime) }}</div>
              <div class="path-coord">{{ item.address || '解析中...' }}</div>
            </div>
            <div v-if="trackLoading" class="no-path"> 轨迹解析中... </div>
            <div
              v-else-if="
                currentUserPathList.filter(
                  (item) =>
                    item.address &&
                    item.address.trim() !== '' &&
                    item.address !== '坐标无效' &&
                    item.address !== '解析异常'
                ).length === 0
              "
              class="no-path"
              >暂无轨迹点
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 固定展开按钮 -->
    <div
      class="float-toggle-btn"
      @click="isSidebarCollapsed = !isSidebarCollapsed"
      title="收起/展开面板"
    >
      {{ isSidebarCollapsed ? '<' : '>' }}
    </div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
  import { AdministrativeRegionManager } from './AdministrativeRegionmanager'
  const VITE_API_PROXY_PORT_URL = import.meta.env.VITE_API_PROXY_PORT_URL
  // 全局声明腾讯地图SDK和自定义属性，避免TS类型报错
  declare global {
    interface Window {
      TMap: any
      districtLabelLayer?: any
    }
  }
  
  // 类型定义
  type AdministrativeRegionManagerType = InstanceType<typeof AdministrativeRegionManager>
  
    // 腾讯地图api key
  // const ApiKey = 'KJ5BZ-2JC6Q-PGA5F-4DREW-YWBR6-TEB24'
  // ==================== 地图实例与图层对象 ====================
  let map: any = null
  let markerLayer: any = null
  let labelLayer: any = null
  let trackLineLayer: any = null
  let startEndMarkerLayer: any = null
  let carMarkerLayer: any = null
  let tempMarker: any = null
  let infoWindow: any = null
  let currentTrackBounds: any = null
  const currentTrackPadding = { top: 50, bottom: 50, left: 50, right: 50 }

  // ==================== 响应式状态 ====================
  const loading = ref(true)
  const error = ref('')
  const userList = ref<any[]>([])
  const isSidebarCollapsed = ref(false)
  const selectedUser = ref<string>('')
  const searchKeyword = ref('')
  const showDetailMode = ref(false)
  const currentDetailUser = ref<any>(null)
  const currentUserPathList = ref<any[]>([])
  const trackLoading = ref(false)

  // 片区相关
  const groupOptions = ref<any[]>([])
  const selectedGroupCode = ref<string>('')



  // ==================== 日期处理 ====================
  const today = new Date()
  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const selectedDate = ref<string | null>(formatDate(today))

  // ==================== 计算属性 ====================
  const filteredUserList = computed(() => {
    return userList.value
  })

  // ==================== 工具函数 ====================
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

  

  // ==================== 地图初始化 ====================
  const initMap = async () => {
    try {
      let attempts = 0
      while (!window.TMap && attempts < 100) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        attempts++
      }
      if (!window.TMap) throw new Error('腾讯地图 GL SDK 加载失败')

      const container = document.getElementById('map-container')
      if (!container) throw new Error('地图容器未找到')

      map = new window.TMap.Map(container, {
        center: new window.TMap.LatLng(30.6799, 104.0571),
        zoom: 12,
        minZoom: 8,
        maxZoom: 19,
        draggable: true,
        scrollwheel: true,
        mapStyleId: 'style1'
      })

      const zoomControl = map.getControl(window.TMap.constants.DEFAULT_CONTROL_ID.ZOOM)
      const rotationControl = map.getControl(window.TMap.constants.DEFAULT_CONTROL_ID.ROTATION)
      if (zoomControl) zoomControl.setPosition(window.TMap.constants.CONTROL_POSITION.TOP_LEFT)
      if (rotationControl)
        rotationControl.setPosition(window.TMap.constants.CONTROL_POSITION.TOP_LEFT)

      // 初始化行政区划管理器
      administrativeRegionManager = new AdministrativeRegionManager(map)

      await fetchLatestLocations()
      await fetchGroupList()
      loading.value = false
    } catch (err: any) {
      console.error('地图初始化失败', err)
      error.value = '地图加载失败：' + err.message
      loading.value = false
    }
  }


  // ==================== 行政区划功能 ====================
  let administrativeRegionManager: AdministrativeRegionManager | null = null
  
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


  // ==================== 获取片区列表 ====================
  const fetchGroupList = async () => {
    try {
      let url = `${VITE_API_PROXY_PORT_URL}api/locations/groups`
      if (selectedDate.value) url += `?date=${selectedDate.value}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const allGroups = await res.json()

      const dataUrl = `${VITE_API_PROXY_PORT_URL}api/locations/latest${selectedDate.value ? `?date=${selectedDate.value}` : ''}`
      const dataRes = await fetch(dataUrl)
      if (!dataRes.ok) throw new Error(`HTTP ${dataRes.status}`)
      const userData = await dataRes.json()

      const groupsWithData = new Set(userData.map((user: any) => user.groupscode))
      const filteredGroups = (allGroups || []).filter((group: any) =>
        groupsWithData.has(group.groupscode)
      )

      groupOptions.value = filteredGroups.sort((a: any, b: any) =>
        a.groupscode.localeCompare(b.groupscode)
      )
      selectedGroupCode.value = ''
    } catch (err) {
      console.error('获取片区失败', err)
      groupOptions.value = []
    }
  }

  // ==================== 获取人员最新位置（支持日期+片区+关键词） ====================
  const fetchLatestLocations = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedDate.value) params.append('date', selectedDate.value)
      if (selectedGroupCode.value) params.append('groupscode', selectedGroupCode.value)
      if (searchKeyword.value) params.append('keyword', searchKeyword.value)

      const query = params.toString() ? `?${params.toString()}` : ''
      const url = `${VITE_API_PROXY_PORT_URL}api/locations/latest${query}`

      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      clearOverlays()

      userList.value = data || []

      if (userList.value.length === 0) return

      // 渲染点
      const geometries = userList.value.map((user) => ({
        id: `user-${user.usercode}`,
        styleId: 'location',
        position: new window.TMap.LatLng(user.latitude, user.longitude),
        properties: { title: `${user.username || ''} (${user.usercode})`, user }
      }))

      markerLayer = new window.TMap.MultiMarker({
        map,
        styles: {
          location: new window.TMap.MarkerStyle({
            width: 32,
            height: 32,
            anchor: { x: 16, y: 32 },
            src: '/src/assets/images/icon/Location.png'
          })
        },
        geometries
      })

      markerLayer.on('click', (evt: any) => {
        const user = evt.geometry?.properties?.user
        if (user) showUserDetail(user)
      })

      const labelGeometries = userList.value.map((user) => ({
        id: `label-${user.usercode}`,
        styleId: 'userLabel',
        position: new window.TMap.LatLng(user.latitude, user.longitude),
        content: user.username || user.usercode,
        offset: { x: 0, y: 20 }
      }))

      labelLayer = new window.TMap.MultiLabel({
        map,
        styles: {
          userLabel: new window.TMap.LabelStyle({
            color: '#ff3333',
            size: 12,
            offset: { x: 0, y: 0 },
            angle: 0,
            alignment: 'center',
            verticalAlignment: 'top'
          })
        },
        geometries: labelGeometries
      })

      // 自动聚焦所有点
      if (geometries.length) {
        const bounds = new window.TMap.LatLngBounds()
        geometries.forEach((g) => bounds.extend(g.position))
        map.fitBounds(bounds, { padding: currentTrackPadding })
      }
    } catch (err: any) {
      console.error('获取人员数据失败', err)
      error.value = '后端接口异常：' + err.message
    }
  }

  




  // 筛选按钮
  const filterUsers = async () => {
    await fetchLatestLocations()
  }

  // 返回主页
  const goToHomePage = async () => {
    selectedUser.value = ''
    searchKeyword.value = ''
    selectedGroupCode.value = ''
    showDetailMode.value = false
    currentDetailUser.value = null
    currentUserPathList.value = []
    clearOverlays()
    await fetchLatestLocations()
    await fetchGroupList()
  }

  // 返回列表
  const backToList = () => {
    showDetailMode.value = false
    currentDetailUser.value = null
    currentUserPathList.value = []
    selectedUser.value = ''
    clearOverlays()
    fetchLatestLocations()
  }

  // 查看人员详情
  const showUserDetail = async (user: any) => {
    selectedUser.value = user.usercode
    showDetailMode.value = true
    currentDetailUser.value = user
    await loadUserTrack(user.usercode)
  }

  // ==================== 加载轨迹 ====================
  const loadUserTrack = async (usercode: string) => {
    try {
      trackLoading.value = true
      if (!map) {
        error.value = '地图未初始化'
        trackLoading.value = false
        return
      }
      clearOverlays()

      let url = `${VITE_API_PROXY_PORT_URL}api/locations/user/${usercode}`
      if (selectedDate.value) url += `?date=${selectedDate.value}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      if (!data || data.length === 0) {
        error.value = '该用户当日无轨迹数据'
        currentUserPathList.value = []
        trackLoading.value = false
        return
      }

      const sorted = [...data].sort(
        (a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime()
      )
      currentUserPathList.value = [...data].sort(
        (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
      )

      const path = sorted.map((p) => new window.TMap.LatLng(p.latitude, p.longitude))
      if (path.length < 2) {
        error.value = '轨迹点不足，无法回放'
        trackLoading.value = false
        return
      }

      trackLineLayer = new window.TMap.MultiPolyline({
        map,
        styles: {
          arrow: new window.TMap.PolylineStyle({
            color: '#FF5722',
            borderWidth: 2,
            borderColor: '#FF9800',
            width: 6,
            showArrow: true,
            arrowOptions: { width: 8, height: 5, space: 50, animSpeed: 50 }
          })
        },
        geometries: [{ id: `track-${usercode}`, styleId: 'arrow', paths: path }]
      })

      startEndMarkerLayer = new window.TMap.MultiMarker({
        map,
        styles: {
          start: new window.TMap.MarkerStyle({
            width: 36,
            height: 36,
            anchor: { x: 18, y: 18 },
            src: '/src/assets/images/icon/FirstPoint.png'
          }),
          end: new window.TMap.MarkerStyle({
            width: 32,
            height: 32,
            anchor: { x: 18, y: 18 },
            src: '/src/assets/images/icon/EndPoint.png'
          })
        },
        geometries: [
          { id: 'start', styleId: 'start', position: path[0] },
          { id: 'end', styleId: 'end', position: path[path.length - 1] }
        ]
      })

      const carIcon = `/src/assets/images/icon/car.png`
      carMarkerLayer = new window.TMap.MultiMarker({
        map,
        styles: {
          car: new window.TMap.MarkerStyle({
            width: 36,
            height: 36,
            anchor: { x: 18, y: 18 },
            faceTo: 'map',
            rotate: 0,
            src: carIcon
          })
        },
        geometries: [{ id: 'car', styleId: 'car', position: path[0] }]
      })

      const bounds = new window.TMap.LatLngBounds()
      path.forEach((p) => bounds.extend(p))
      currentTrackBounds = bounds
      map.fitBounds(bounds, { padding: currentTrackPadding })

      setTimeout(() => startPlayback(path), 200)
      setTimeout(() => {
        trackLoading.value = false
      }, 2000)
      error.value = ''
    } catch (err: any) {
      console.error('获取轨迹失败:', err)
      error.value = `获取轨迹失败: ${err.message}`
      trackLoading.value = false
    }
  }

  // 轨迹回放
  const startPlayback = (path: any[]) => {
    if (!carMarkerLayer || path.length < 2) return
    try {
      carMarkerLayer.moveAlong({ car: { path, speed: 500 } }, { autoRotation: true })
      carMarkerLayer.on('moving', (e: any) => {
        const passed = e.car?.passedLatLngs
        if (passed && passed.length && trackLineLayer) {
          try {
            trackLineLayer.eraseTo(
              `track-${currentDetailUser.value?.usercode}`,
              passed.length - 1,
              passed[passed.length - 1]
            )
          } catch (err: any) {
            console.error('擦轨迹失败', err)
          }
        }
      })
    } catch (err: any) {
      console.error('回放失败', err)
    }
  }

  // 清除临时标记
  const clearTempMarkerAndRestoreBounds = () => {
    if (tempMarker) {
      tempMarker.setMap(null)
      tempMarker = null
    }
    if (currentTrackBounds && map)
      map.fitBounds(currentTrackBounds, { padding: currentTrackPadding })
  }

  // 点击轨迹点
  const showPointOnMap = (point: any) => {
    if (!map) return
    if (infoWindow) {
      infoWindow.close()
      infoWindow = null
    }
    if (tempMarker) {
      tempMarker.setMap(null)
      tempMarker = null
    }

    const latLng = new window.TMap.LatLng(point.latitude, point.longitude)
    tempMarker = new window.TMap.MultiMarker({
      map,
      styles: {
        highlight: new window.TMap.MarkerStyle({
          width: 30,
          height: 30,
          anchor: { x: 15, y: 30 },
          src: '/src/assets/images/icon/Location.png'
        })
      },
      geometries: [{ id: 'temp-marker', styleId: 'highlight', position: latLng }]
    })

    const closeBtnId = `custom-info-close-${Date.now()}`
    const content = `
  <div style="background:#1f2937;color:#e5e7eb;border-radius:12px;padding:12px 16px;min-width:240px;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:13px;line-height:1.5;border:1px solid #374151;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <span style="font-weight:bold;font-size:14px;">📍 轨迹点详情</span>
      <span id="${closeBtnId}" style="cursor:pointer;font-size:18px;color:#9ca3af;">&times;</span>
    </div>
    <div>🕒 时间：${formatTime(point.createTime)}</div>
    <div style="margin:6px 0;">🏠 地址：${point.address || '解析中...'}</div>
    <div>📍 坐标：${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}</div>
  </div>`

    infoWindow = new window.TMap.InfoWindow({
      map,
      position: latLng,
      content,
      offset: { x: 0, y: -35 },
      enableCustom: true
    })
    infoWindow.open()
    document.getElementById(closeBtnId)?.addEventListener('click', () => {
      infoWindow?.close()
      infoWindow = null
      clearTempMarkerAndRestoreBounds()
    })
    map.setCenter(latLng)
  }

  // 清空覆盖物
  const clearOverlays = () => {
    if (carMarkerLayer) carMarkerLayer.setMap(null)
    if (markerLayer) markerLayer.setMap(null)
    if (labelLayer) labelLayer.setMap(null)
    if (trackLineLayer) trackLineLayer.setMap(null)
    if (startEndMarkerLayer) startEndMarkerLayer.setMap(null)
    if (tempMarker) tempMarker.setMap(null)
    if (infoWindow) infoWindow.close()
    carMarkerLayer =
      markerLayer =
      labelLayer =
      trackLineLayer =
      startEndMarkerLayer =
      tempMarker =
      infoWindow =
        null
    currentTrackBounds = null
  }

  // 生命周期
  onMounted(() => {
    initMap()
  })
  onBeforeUnmount(() => {
    clearOverlays()
    if (map) {
      map.destroy()
      map = null
    }
  })
</script>

<style scoped>
  /* ========== 深色主题样式 ========== */
  :deep(.el-input__inner),
  :deep(.el-select__input) {
    color: #e5e7eb !important;
    background-color: #1f2937 !important;
    border-color: #374151 !important;
  }
  :deep(.el-input__inner::placeholder),
  :deep(.el-select__input::placeholder) {
    color: #9ca3af !important;
  }
  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper) {
    background-color: #1f2937 !important;
    box-shadow: none !important;
    border: 1px solid #9ca3af !important;
    border-radius: 4px;
  }
  :deep(.el-input__prefix),
  :deep(.el-input__suffix),
  :deep(.el-select__suffix) {
    color: #9ca3af !important;
  }
  :deep(.el-button--primary) {
    background-color: #3b82f6;
    border-color: #3b82f6;
  }
  :deep(.el-button--default) {
    background-color: #374151;
    border-color: #4b5563;
    color: #e5e7eb;
  }
  :deep(.el-button--default:hover) {
    background-color: #4b5563;
    border-color: #6b7280;
    color: #f3f4f6;
  }

  /* 顶部一行布局 */
  .top-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 0;
  }
  .user-list-title {
    font-size: 18px;
    font-weight: 600;
    color: #f3f4f6;
    margin: 0;
    white-space: nowrap;
  }
  .date-picker {
    flex: 1;
    min-width: 170px;
    max-width: 225px;
  }
  .group-select {
    flex: 1;
    min-width: 130px;
    max-width: 225px;
  }
  .home-img-btn {
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
  .home-img-btn:hover {
    opacity: 1;
    transform: scale(1.08);
  }

  .district-and-home-btns {
    display: flex;
    gap: 4px; /* 小间隙确保按钮紧贴 */
    align-items: center;
  }

  .search-date-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .search-date-row .search-input {
    flex: 1;
    min-width: 125px;
  }

  .user-map-container {
    display: flex;
    width: 100%;
    height: 100%;
    background: #111827;
  }
 
  .map-content {
    flex: 1;
    height: 100%;
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
  .map-container {
    width: 100%;
    height: 100%;
  }
  .sidebar-container {
    position: relative;
    height: 100%;
    flex-shrink: 0;
  }
  .user-list {
    width: 340px;
    height: 100%;
    background: #1f2937;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    padding: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
    transition: all 0.3s ease;
    flex-shrink: 0;
  }
  .user-list.collapsed {
    width: 0;
    padding: 0;
    border: none;
    box-shadow: none;
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
  }
  .float-toggle-btn {
    position: fixed;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 30px;
    background: #89929f;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px 0 0 8px;
    cursor: pointer;
    font-size: 20px;
    z-index: 99999;
    transition: 0.2s ease;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
  }
  .float-toggle-btn:hover {
    background: #253f78;
    width: 30px;
  }
  .list-mode {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .user-list-fixed {
    flex-shrink: 0;
    padding-bottom: 16px;
    border-bottom: 1px solid #374151;
    margin-bottom: 8px;
  }
  .user-list-scroll {
    flex: 1;
    overflow-y: auto !important;
    padding-top: 12px;
    box-sizing: border-box;
  }
  .user-card {
    background: #2d3a4a;
    border-radius: 10px;
    padding: 16px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: all 0.28s ease;
    border: 1px solid #374151;
  }
  .user-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
    border-color: #3b82f6;
  }
  .user-card.active {
    border-color: #3b82f6;
    background: linear-gradient(135deg, #1e2a3a 0%, #1f2c3c 100%);
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
    color: #f9fafb;
  }
  .user-code-sub {
    font-size: 12px;
    color: #9ca3af;
    margin-left: 4px;
    font-weight: normal;
  }
  .user-time {
    font-size: 12px;
    color: #9ca3af;
    white-space: nowrap;
  }
  .user-card-body {
    font-size: 14px;
    line-height: 1.5;
  }
  .user-location {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 6px;
  }
  .user-location .label {
    color: #9ca3af;
    font-size: 13px;
    white-space: nowrap;
  }
  .user-location .value {
    color: #e5e7eb;
    font-size: 13px;
    text-align: right;
    word-break: break-all;
  }
  .user-info {
    font-size: 12px;
    color: #9ca3af;
    padding: 6px 0;
    border-top: 1px dashed #374151;
    margin: 6px 0;
  }
  .user-group {
    font-size: 12px;
    color: #9ca3af;
  }
  .detail-mode {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .detail-header {
    flex-shrink: 0;
    padding: 20px;
    background: linear-gradient(135deg, #1e2a3a 0%, #1f2c3c 100%);
    border-radius: 12px;
    margin-bottom: 16px;
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
    color: #f3f4f6;
    margin: 0;
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
    color: #9ca3af;
    font-size: 13px;
  }
  .detail-info-row span {
    color: #e5e7eb;
  }
  .detail-path-list {
    flex: 1;
    overflow-y: auto !important;
    padding-top: 8px;
    padding-right: 8px;
  }
  .path-title {
    font-size: 14px;
    font-weight: 600;
    color: #d1d5db;
    margin-bottom: 12px;
  }
  .path-item {
    padding: 14px;
    border-radius: 10px;
    background: #2d3a4a;
    margin-bottom: 10px;
    border: 1px solid #374151;
    transition: all 0.2s ease;
    cursor: pointer;
  }
  .path-item:hover {
    background: #374151;
    border-color: #4b5563;
  }
  .path-time {
    font-size: 12px;
    color: #9ca3af;
    margin-bottom: 6px;
  }
  .path-coord {
    font-size: 13px;
    color: #e5e7eb;
  }
  .no-path {
    padding: 40px 0;
    text-align: center;
    color: #9ca3af;
    font-size: 14px;
  }
  .loading,
  .error {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    font-size: 14px;
  }
  .error {
    color: #f87171;
  }
  .user-list-loading,
  .user-list-empty {
    padding: 30px 0;
    text-align: center;
    color: #9ca3af;
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
  
  /* 地图控件样式 */
  .map-control-top-right {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .map-control-btn {
    width: 32px;
    height: 32px;
    cursor: pointer;
    background: white;
    border-radius: 4px;
    padding: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    z-index: 1000;
  }
  
  .map-control-btn:hover {
    background: #f5f5f5;
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  @media (max-width: 768px) {
    .map-control-top-right {
      top: 8px;
      right: 8px;
    }
  }

  @reference '@styles/core/tailwind.css';

  .art-button {
    @apply ml-2 
    size-8 
    flex 
    items-center 
    justify-center 
    cursor-pointer 
    rounded-md 
    bg-g-300/55
    dark:bg-g-300/40
    text-g-700  
    hover:bg-g-300 
    md:ml-0 
    md:mr-2.5;
  }
</style>

<style>
  .user-map-container .user-list-scroll::-webkit-scrollbar,
  .user-map-container .detail-path-list::-webkit-scrollbar {
    width: 4px !important;
    height: 4px !important;
  }
  .user-map-container .user-list-scroll::-webkit-scrollbar-thumb,
  .user-map-container .detail-path-list::-webkit-scrollbar-thumb {
    background: #4b5563 !important;
    border-radius: 10px !important;
  }
  .user-map-container .user-list-scroll::-webkit-scrollbar-track,
  .user-map-container .detail-path-list::-webkit-scrollbar-track {
    background: #1f2937 !important;
  }
</style>