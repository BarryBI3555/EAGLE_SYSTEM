<!-- 人员路线地图组件 -->
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
      T: any
    }
  }

  const map = ref<any>(null)
  const markers = ref<any[]>([])
  const polyline = ref<any>(null)
  const loading = ref(true)
  const error = ref('')

  // 检查腾讯地图 API 是否已加载
  const checkTencentMapLoaded = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (window.T && window.T.Map) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)

      // 5秒超时
      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('腾讯地图 API 加载超时'))
      }, 5000)
    })
  }

  // 初始化地图
  const initMap = async () => {
    try {
      // 检查腾讯地图 API 是否已加载
      await checkTencentMapLoaded()

      // 初始化地图
      map.value = new window.T.Map('map-container', {
        center: new window.T.LngLat(104.0657, 30.6574),
        zoom: 13,
        displayOptions: {
          toolbar: true,
          scale: true
        }
      })

      // 获取人员位置数据
      await fetchUserLocations()
      loading.value = false
    } catch (err) {
      console.error('地图初始化失败:', err)
      error.value = '地图加载失败，请检查网络连接或腾讯地图 API 密钥配置'
      loading.value = false
    }
  }

  // 获取人员位置数据
  const fetchUserLocations = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/locations')
      const data = await response.json()
      console.log('人员位置数据:', data)

      // 清除旧的标记
      clearMarkers()

      // 如果有数据，绘制路线
      if (data && data.length > 0) {
        // 获取所有坐标点
        const latlngs = data.map((item: any) => {
          return new window.T.LngLat(item.longitude, item.latitude)
        })

        // 绘制折线
        const polylineOptions = {
          strokeColor: '#FF4E4F',
          strokeWeight: 4,
          strokeOpacity: 0.8
        }
        polyline.value = new window.T.Polyline(latlngs, polylineOptions)
        map.value.addOverlay(polyline.value)

        // 添加标记点
        data.forEach((item: any, index: number) => {
          const marker = new window.T.Marker(
            new window.T.LngLat(item.longitude, item.latitude),
            {
              title: `用户: ${item.usercode}\n时间: ${item.createTime}`
            }
          )
          markers.value.push(marker)
          map.value.addOverlay(marker)

          // 点击标记显示信息窗口
          window.T.Event.addListener(marker, 'click', () => {
            const content = document.createElement('div')
            content.innerHTML = `<div style="padding:10px;">
              <strong>用户编码:</strong> ${item.usercode}<br>
              <strong>创建时间:</strong> ${item.createTime}<br>
              <strong>纬度:</strong> ${item.latitude}<br>
              <strong>经度:</strong> ${item.longitude}
            </div>`
            
            const infoWindow = new window.T.InfoWindow(content, {
              position: new window.T.LngLat(item.longitude, item.latitude)
            })
            map.value.openInfoWindow(infoWindow)
          })
        })

        // 自动调整地图视野
        if (latlngs.length > 0) {
          map.value.setFitView()
        }
      }
    } catch (err) {
      console.error('获取位置数据失败:', err)
      error.value = '获取位置数据失败，请检查后端服务是否正常'
      loading.value = false
    }
  }

  // 清除所有标记
  const clearMarkers = () => {
    markers.value.forEach((marker) => {
      map.value.removeOverlay(marker)
    })
    markers.value = []
    if (polyline.value) {
      map.value.removeOverlay(polyline.value)
      polyline.value = null
    }
  }

  onMounted(() => {
    initMap()
  })

  onUnmounted(() => {
    // 清理资源
    clearMarkers()
    if (map.value) {
      map.value.dispose()
    }
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

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 16px;
  color: #666;
}

.error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 16px;
  color: #f56c6c;
  text-align: center;
}
</style>
