// src/plugins/globalAutoRefresh.ts
import { App } from 'vue'

interface GlobalAutoRefreshOptions {
  interval?: number // 刷新间隔（分钟）
  enabled?: boolean // 是否启用
}

export const GlobalAutoRefresh = {
  install(app: App, options: GlobalAutoRefreshOptions = {}) {
    const { 
      interval = 30, // 默认30分钟
      enabled = true  // 默认启用
    } = options
    
    if (!enabled) return

    const AUTO_REFRESH_INTERVAL = interval * 60 * 1000
    let refreshTimer: number | null = null

    const startGlobalRefresh = () => {
      if (refreshTimer) {
        clearInterval(refreshTimer)
      }
      
      refreshTimer = window.setInterval(() => {
        console.log(`全局自动刷新: 每${interval}分钟刷新一次`)
        location.reload()
      }, AUTO_REFRESH_INTERVAL)
    }

    // 启动全局刷新
    startGlobalRefresh()

    // 监听页面可见性变化
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // 页面重新可见时重启定时器
        startGlobalRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 页面卸载前清理定时器
    const handleBeforeUnload = () => {
      if (refreshTimer) {
        clearInterval(refreshTimer)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    // 将控制方法暴露到全局
    app.config.globalProperties.$globalRefresh = {
      start: startGlobalRefresh,
      stop: () => {
        if (refreshTimer) {
          clearInterval(refreshTimer)
          refreshTimer = null
        }
      },
      restart: startGlobalRefresh
    }
  }
}