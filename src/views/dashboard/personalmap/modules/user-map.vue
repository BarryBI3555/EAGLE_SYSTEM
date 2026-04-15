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
            <div class="title-row">
              <h3 class="user-list-title">人员列表</h3>
              <img
                src="@/assets/images/icon/Home.png"
                class="home-img-btn"
                @click="goToHomePage"
                title="返回主页"
              />
            </div>
            <div class="search-date-row">
              <el-date-picker
                v-model="selectedDate"
                type="date"
                placeholder="选择日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                class="date-picker"
              />
              <el-input
                v-model="searchKeyword"
                placeholder="搜索姓名/工号"
                class="search-input"
                clearable
              />
            </div>
            <el-button type="primary" @click="filterUsers" style="width: 100%; margin-top: 10px"
              >筛选</el-button
            >
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
            </div>
          </div>
          <div class="detail-path-list">
            <div class="path-title">轨迹经纬度记录</div>

            <!-- 轨迹列表：只显示有效地址数据 -->
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

            <!-- 轨迹加载提示：修复刚进入显示暂无轨迹点问题 -->
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

  // 全局声明腾讯地图SDK，避免TS类型报错
  declare global {
    interface Window {
      TMap: any
    }
  }

  // ==================== 地图实例与图层对象 ====================
  let map: any = null // 地图主实例
  let markerLayer: any = null // 人员点位图层
  let labelLayer: any = null // 人员名称标签图层
  let trackLineLayer: any = null // 轨迹连线图层
  let startEndMarkerLayer: any = null // 轨迹起点/终点标记图层
  let carMarkerLayer: any = null // 车辆动画标记图层
  let tempMarker: any = null // 点击轨迹点时的临时高亮标记
  let infoWindow: any = null // 地图信息弹窗
  let currentTrackBounds: any = null // 当前轨迹的自动视野范围
  const currentTrackPadding = { top: 50, bottom: 50, left: 50, right: 50 } // 轨迹视野边距

  // ==================== 响应式状态 ====================
  const loading = ref(true) // 加载状态
  const error = ref('') // 错误提示信息
  const userList = ref<any[]>([]) // 所有人员最新位置列表
  const isSidebarCollapsed = ref(false) // 侧边栏是否折叠
  const selectedUser = ref<string>('') // 当前选中的人员工号
  const searchKeyword = ref('') // 搜索关键词
  const showDetailMode = ref(false) // 是否显示轨迹详情模式
  const currentDetailUser = ref<any>(null) // 当前查看详情的用户
  const currentUserPathList = ref<any[]>([]) // 当前用户的轨迹点列表
  const trackLoading = ref(false) // 轨迹地址解析加载状态

  // ==================== 日期处理 ====================
  const today = new Date()
  // 格式化日期为 YYYY-MM-DD 字符串
  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  // 默认选中今天
  const selectedDate = ref<string | null>(formatDate(today))

  // ==================== 计算属性 ====================
  // 根据关键词过滤人员列表（姓名/工号）
  const filteredUserList = computed(() => {
    if (!searchKeyword.value) return userList.value
    const kw = searchKeyword.value.toLowerCase()
    return userList.value.filter((u) => {
      const name = (u || '').toLowerCase()
      const code = (u.usercode || '').toLowerCase()
      return name.includes(kw) || code.includes(kw)
    })
  })

  // ==================== 工具函数 ====================
  // 格式化时间为本地标准时间
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
      // 等待腾讯地图SDK加载完成
      let attempts = 0
      while (!window.TMap && attempts < 100) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        attempts++
      }
      if (!window.TMap) throw new Error('腾讯地图 GL SDK 加载失败，请检查网络')

      const container = document.getElementById('map-container')
      if (!container) throw new Error('地图容器未找到')

      // 创建地图实例
      map = new window.TMap.Map(container, {
        center: new window.TMap.LatLng(30.6799, 104.0571),
        zoom: 12,
        minZoom: 8,
        maxZoom: 19,
        draggable: true,
        scrollwheel: true,
        mapStyleId: 'style1'
      })

      // 设置地图控件位置到左上角
      let zoomControl = map.getControl(window.TMap.constants.DEFAULT_CONTROL_ID.ZOOM)
      let rotationControl = map.getControl(window.TMap.constants.DEFAULT_CONTROL_ID.ROTATION)
      if (zoomControl) {
        zoomControl.setPosition(window.TMap.constants.CONTROL_POSITION.TOP_LEFT)
      }
      if (rotationControl) {
        rotationControl.setPosition(window.TMap.constants.CONTROL_POSITION.TOP_LEFT)
      }

      // 加载人员位置数据
      await fetchLatestLocations()
      loading.value = false
    } catch (err: any) {
      console.error('地图初始化失败', err)
      error.value = '地图加载失败：' + err.message
      loading.value = false
    }
  }

  // ==================== 获取所有人员最新位置 ====================
  const fetchLatestLocations = async (date?: string) => {
    try {
      let url = 'http://localhost:8080/api/locations/latest'
      if (date) url += `?date=${date}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      clearOverlays() // 清空旧图层

      if (!data || data.length === 0) {
        userList.value = []
        return
      }
      userList.value = data

      // 构建人员点位
      const geometries = userList.value.map((user) => ({
        id: `user-${user.usercode}`,
        styleId: 'location',
        position: new window.TMap.LatLng(user.latitude, user.longitude),
        properties: { title: `${user.username || ''} (${user.usercode})`, user }
      }))

      // 创建点位图层
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

      // 点击地图点位 → 打开轨迹详情
      markerLayer.on('click', (evt: any) => {
        const user = evt.geometry?.properties?.user
        if (user) showUserDetail(user)
      })

      // 构建人员名称标签
      const labelGeometries = userList.value.map((user) => ({
        id: `label-${user.usercode}`,
        styleId: 'userLabel',
        position: new window.TMap.LatLng(user.latitude, user.longitude),
        content: user.username || user.usercode,
        offset: { x: 0, y: 20 }
      }))

      // 创建标签图层
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

      // 自动调整视野，显示所有人员
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

  // 点击筛选按钮 → 根据日期刷新位置
  const filterUsers = async () => {
    await fetchLatestLocations(selectedDate.value || undefined)
  }

  // 返回主页 → 重置所有状态并刷新列表
  const goToHomePage = async () => {
    selectedUser.value = ''
    searchKeyword.value = ''
    showDetailMode.value = false
    currentDetailUser.value = null
    currentUserPathList.value = []
    clearOverlays()
    await fetchLatestLocations(selectedDate.value || undefined)
  }

  // 从轨迹详情返回人员列表
  const backToList = () => {
    showDetailMode.value = false
    currentDetailUser.value = null
    currentUserPathList.value = []
    selectedUser.value = ''
    clearOverlays()
    fetchLatestLocations(selectedDate.value || undefined)
  }

  // 显示某个人的轨迹详情
  const showUserDetail = async (user: any) => {
    selectedUser.value = user.usercode
    showDetailMode.value = true
    currentDetailUser.value = user
    await loadUserTrack(user.usercode)
  }

  // ==================== 加载单个用户全天轨迹 ====================
  const loadUserTrack = async (usercode: string) => {
    try {
      trackLoading.value = true // 开启轨迹加载状态
      if (!map) {
        error.value = '地图未初始化'
        trackLoading.value = false
        return
      }
      clearOverlays()

      // 请求轨迹接口
      let url = `http://localhost:8080/api/locations/user/${usercode}`
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

      // 按时间正序 → 用于绘制轨迹线
      const sorted = [...data].sort(
        (a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime()
      )
      // 按时间倒序 → 用于列表展示最新点在上
      currentUserPathList.value = [...data].sort(
        (a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
      )

      // 构造轨迹经纬度数组
      const path = sorted.map((p) => new window.TMap.LatLng(p.latitude, p.longitude))
      if (path.length < 2) {
        error.value = '轨迹点不足，无法回放'
        trackLoading.value = false
        return
      }

      // 绘制带箭头的轨迹线
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

      // 绘制起点 & 终点
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

      // 创建车辆动画图标
      const carIcon = 'https://mapapi.qq.com/web/lbs/javascriptGL/demo/img/car.png'
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

      // 自动缩放视野以包含整条轨迹
      const bounds = new window.TMap.LatLngBounds()
      path.forEach((p) => bounds.extend(p))
      currentTrackBounds = bounds
      map.fitBounds(bounds, { padding: currentTrackPadding })

      // 延迟启动轨迹回放
      setTimeout(() => {
        startPlayback(path)
      }, 200)

      // 地址解析延迟后关闭加载状态
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

  // ==================== 车辆沿轨迹回放 ====================
  const startPlayback = (path: any[]) => {
    if (!carMarkerLayer) {
      console.error('车辆标记未创建')
      error.value = '车辆标记未创建，无法回放'
      return
    }
    if (path.length < 2) {
      error.value = '轨迹点数不足，无法回放'
      return
    }

    try {
      // 车辆沿路径移动
      carMarkerLayer.moveAlong({ car: { path, speed: 500 } }, { autoRotation: true })
      // 移动时擦除已走过的轨迹
      carMarkerLayer.on('moving', (e: any) => {
        const passed = e.car?.passedLatLngs
        if (passed && passed.length > 0 && trackLineLayer) {
          try {
            trackLineLayer.eraseTo(
              `track-${currentDetailUser.value?.usercode}`,
              passed.length - 1,
              passed[passed.length - 1]
            )
          } catch (err: any) {
            console.error('擦除轨迹失败:', err)
          }
        }
      })
    } catch (err: any) {
      console.error('moveAlong 调用失败:', err)
      error.value = `轨迹回放失败: ${err.message}`
    }
  }

  // 清除临时标记并恢复轨迹视野
  const clearTempMarkerAndRestoreBounds = () => {
    if (tempMarker) {
      tempMarker.setMap(null)
      tempMarker = null
    }
    if (currentTrackBounds && map) {
      map.fitBounds(currentTrackBounds, { padding: currentTrackPadding })
    }
  }

  // ==================== 点击轨迹点 → 在地图上显示该点 ====================
  const showPointOnMap = (point: any) => {
    if (!map) return

    // 关闭已存在的弹窗与标记
    if (infoWindow) {
      infoWindow.close()
      infoWindow = null
    }
    if (tempMarker) {
      tempMarker.setMap(null)
      tempMarker = null
    }

    const latLng = new window.TMap.LatLng(point.latitude, point.longitude)

    // 创建临时高亮标记
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

    // 生成唯一关闭按钮ID，防止事件冲突
    const closeBtnId = `custom-info-close-${Date.now()}`

    // 自定义深色信息弹窗内容
    const content = `
  <div style="
    background: #1f2937;
    color: #e5e7eb;
    border-radius: 12px;
    padding: 12px 16px;
    min-width: 240px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-size: 13px;
    line-height: 1.5;
    border: 1px solid #374151;
  ">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span style="font-weight: bold; font-size: 14px;">📍 轨迹点详情</span>
      <span id="${closeBtnId}" style="cursor: pointer; font-size: 18px; line-height: 1; color: #9ca3af;">&times;</span>
    </div>
    <div style="margin-bottom: 6px;">🕒 时间：${formatTime(point.createTime)}</div>
    <div style="margin-bottom: 6px;">🏠 地址：${point.address || '解析中...'}</div>
    <div>📍 坐标：${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}</div>
  </div>
`

    // 创建并打开信息窗
    infoWindow = new window.TMap.InfoWindow({
      map,
      position: latLng,
      content: content,
      offset: { x: 0, y: -35 },
      enableCustom: true
    })
    infoWindow.open()

    // 绑定关闭按钮事件
    const closeBtn = document.getElementById(closeBtnId)
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation()
        if (infoWindow) {
          infoWindow.close()
          infoWindow = null
        }
        clearTempMarkerAndRestoreBounds()
      }
    }

    // 地图居中到该点
    map.setCenter(latLng)
  }

  // ==================== 清空所有地图覆盖物 ====================
  const clearOverlays = () => {
    if (carMarkerLayer) carMarkerLayer.setMap(null)
    if (markerLayer) markerLayer.setMap(null)
    if (labelLayer) labelLayer.setMap(null)
    if (trackLineLayer) trackLineLayer.setMap(null)
    if (startEndMarkerLayer) startEndMarkerLayer.setMap(null)
    if (tempMarker) tempMarker.setMap(null)
    if (infoWindow) infoWindow.close()

    // 释放引用
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

  // ==================== 生命周期 ====================
  // 页面挂载 → 初始化地图
  onMounted(() => {
    initMap() 
  })

  // 页面销毁 → 清理资源，防止内存泄漏
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
  :deep(.el-input__inner) {
    color: #e5e7eb !important;
    background-color: #1f2937 !important;
    border-color: #374151 !important;
  }
  :deep(.el-input__inner::placeholder) {
    color: #9ca3af !important;
  }
  :deep(.el-date-editor.el-input--mini),
  :deep(.el-date-editor.el-input),
  :deep(.el-date-editor) {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }
  :deep(.el-input__wrapper) {
    background-color: #1f2937 !important;
    box-shadow: none !important;
    border: 1px solid #9ca3af !important;
    border-radius: 4px;
  }
  :deep(.el-input__prefix),
  :deep(.el-input__suffix) {
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
    width: 100%;
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
    width: 320px;
    height: 100%;
    background: #1f2937;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    padding: 20px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
    transition: all 0.3s ease; /* 动画 */
    flex-shrink: 0;
  }
  /* 收缩状态 */
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

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .user-list-title {
    font-size: 18px;
    font-weight: 60;
    color: #f3f4f6;
    margin: 0;
    letter-spacing: 0.5px;
  }
  .home-img-btn {
    width: 26px;
    height: 26px;
    cursor: pointer;
    transition: all 0.25s ease;
    opacity: 0.85;
    filter: brightness(0) invert(1);
  }
  .home-img-btn:hover {
    opacity: 1;
    transform: scale(1.08);
  }

  .user-list-scroll {
    flex: 1;
    overflow-y: auto !important;
    padding-top: 12px;
    padding-bottom: 4px;
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
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
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
    gap: 30px;
    align-items: flex-start;
    margin-bottom: 6px;
    line-height: 1.5;
  }
  .user-location .label {
    color: #9ca3af;
    font-weight: 50;
    font-size: 13px;
    white-space: nowrap;
  }
  .user-location .value {
    color: #e5e7eb;
    font-size: 13px;
    flex: 1;
    text-align: right;
    white-space: pre-line;
    word-break: break-all;
  }
  .user-info {
    font-size: 12px;
    color: #9ca3af;
    padding-top: 6px;
    border-top: 1px dashed #374151;
    margin-top: 6px;
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
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
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
    color: #9ca3af;
    font-size: 13px;
  }
  .detail-info-row span {
    color: #e5e7eb;
    font-weight: 500;
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
    padding-left: 4px;
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
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
  .path-time {
    font-size: 12px;
    color: #9ca3af;
    margin-bottom: 6px;
    font-weight: 500;
  }
  .path-coord {
    font-size: 13px;
    font-family: 'Menlo', monospace;
    color: #e5e7eb;
    font-weight: 500;
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

<style>
  /* 全局滚动条样式 - 深色适配 */
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
