/**
 * 路由全局前置守卫模块
 *
 * 提供完整的路由导航守卫功能
 *
 * ## 主要功能
 *
 * - 登录状态验证和重定向
 * - 动态路由注册和权限控制
 * - 菜单数据获取和处理（前端/后端模式）
 * - 用户信息获取和缓存
 * - 页面标题设置
 * - 工作标签页管理
 * - 进度条和加载动画控制
 * - 静态路由识别和处理
 * - 错误处理和异常跳转
 *
 * ## 使用场景
 *
 * - 路由跳转前的权限验证
 * - 动态菜单加载和路由注册
 * - 用户登录状态管理
 * - 页面访问控制
 * - 路由级别的加载状态管理
 *
 * ## 工作流程
 *
 * 1. 检查登录状态，未登录跳转到登录页
 * 2. 首次访问时获取用户信息和菜单数据
 * 3. 根据权限动态注册路由
 * 4. 设置页面标题和工作标签页
 * 5. 处理根路径重定向到首页
 * 6. 未匹配路由跳转到 404 页面
 *
 * @module router/guards/beforeEach
 * @author Art Design Pro Team
 */
import type { Router, RouteLocationNormalized, NavigationGuardNext } from 'vue-router'
import { nextTick } from 'vue'
import NProgress from 'nprogress'
import { useSettingStore } from '@/store/modules/setting'
import { useUserStore } from '@/store/modules/user'
import { useMenuStore } from '@/store/modules/menu'
import { setWorktab } from '@/utils/navigation'
import { setPageTitle } from '@/utils/router'
import { RoutesAlias } from '../routesAlias'
import { staticRoutes } from '../routes/staticRoutes'
import { loadingService } from '@/utils/ui'
import { useCommon } from '@/hooks/core/useCommon'
import { useWorktabStore } from '@/store/modules/worktab'
import { fetchGetUserInfo } from '@/api/auth/index'
import { ApiStatus } from '@/utils/http/status'
import { isHttpError } from '@/utils/http/error'
import { AuthService } from '@/services/authService'
import { RouteRegistry, MenuProcessor, IframeRouteManager, RoutePermissionValidator } from '../core'

// 路由注册器实例
let routeRegistry: RouteRegistry | null = null

// 菜单处理器实例
const menuProcessor = new MenuProcessor()

// 跟踪是否需要关闭 loading
let pendingLoading = false

// 路由初始化失败标记，防止死循环
// 一旦设置为 true，只有刷新页面或重新登录才能重置
let routeInitFailed = false

// 路由初始化进行中标记，防止并发请求
let routeInitInProgress = false

/**
 * 获取 pendingLoading 状态
 */
export function getPendingLoading(): boolean {
  return pendingLoading
}

/**
 * 重置 pendingLoading 状态
 */
export function resetPendingLoading(): void {
  pendingLoading = false
}

/**
 * 获取路由初始化失败状态
 */
export function getRouteInitFailed(): boolean {
  return routeInitFailed
}

/**
 * 重置路由初始化状态（用于重新登录场景）
 */
export function resetRouteInitState(): void {
  routeInitFailed = false
  routeInitInProgress = false
}

/**
 * 设置路由全局前置守卫
 */
export function setupBeforeEachGuard(router: Router): void {
  // 初始化路由注册器
  routeRegistry = new RouteRegistry(router)

  router.beforeEach(
    async (
      to: RouteLocationNormalized,
      from: RouteLocationNormalized,
      next: NavigationGuardNext
    ) => {
      try {
        await handleRouteGuard(to, from, next, router)
      } catch (error) {
        console.error('[RouteGuard] 路由守卫处理失败:', error)
        closeLoading()
        // 检查是否是网络连接错误（后端未启动）
        const isNetworkError = error.message?.includes('Network Error') || 
                               error.message?.includes('ECONNREFUSED') ||
                               error.message?.includes('ERR_CONNECTION_REFUSED') ||
                               error.message?.includes('Failed to fetch')
        
        if (isNetworkError) {
          // 后端未启动，重定向到登录页而不是500页
          next({ name: 'Login', replace: true })
        } else {
          next({ name: 'Exception500' })
        }
      }
    }
  )
}

/**
 * 关闭 loading 效果
 */
function closeLoading(): void {
  if (pendingLoading) {
    nextTick(() => {
      loadingService.hideLoading()
      pendingLoading = false
    })
  }
}

/**
 * 处理路由守卫逻辑
 */
async function handleRouteGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
  router: Router
): Promise<void> {
  const settingStore = useSettingStore()
  const userStore = useUserStore()

  // 启动进度条
  if (settingStore.showNprogress) {
    NProgress.start()
  }

  // 1. 检查登录状态
  if (!handleLoginStatus(to, userStore, next)) {
    return
  }

  // 2. 检查路由初始化是否已失败（防止死循环）
  if (routeInitFailed) {
    // 如果访问登录页面，重置失败标记，允许重新登录
    if (to.path === RoutesAlias.Login) {
      routeInitFailed = false
      next()
      return
    }
    // 已经失败过，直接放行到错误页面，不再重试
    if (to.matched.length > 0) {
      next()
    } else {
      // 未匹配到路由，跳转到 500 页面
      next({ name: 'Exception500', replace: true })
    }
    return
  }

  // 3. 处理动态路由注册
  if (!routeRegistry?.isRegistered() && userStore.isLogin) {
    // 防止并发请求（快速连续导航场景）
    if (routeInitInProgress) {
      // 正在初始化中，等待完成后重新导航
      // console.log('[RouteGuard] 动态路由正在注册中，等待完成...')
      // 短暂延迟后重试
      setTimeout(() => {
        router.replace(to.fullPath).catch(err => console.error('重试导航失败:', err))
      }, 100)
      next(false)
      return
    }
    // console.log('[RouteGuard] 开始处理动态路由注册')
    await handleDynamicRoutes(to, next, router)
    return
  }

  // 4. 处理根路径重定向
  if (handleRootPathRedirect(to, next)) {
    return
  }

  // 5. 处理已匹配的路由
  if (to.matched.length > 0) {
    setWorktab(to)
    setPageTitle(to)
    next()
    return
  }

  // 6. 未匹配到路由，跳转到 404
  next({ name: 'Exception404' })
}

/**
 * 处理登录状态
 * @returns true 表示可以继续，false 表示已处理跳转
 */
function handleLoginStatus(
  to: RouteLocationNormalized,
  userStore: ReturnType<typeof useUserStore>,
  next: NavigationGuardNext
): boolean {
  // 已登录或访问登录页或静态路由，直接放行
  if (userStore.isLogin || to.path === RoutesAlias.Login || isStaticRoute(to.path)) {
    return true
  }

  // 未登录且访问需要权限的页面，跳转到登录页并携带 redirect 参数
  // 特殊处理根路径：如果未登录用户访问根路径，直接跳转到登录页
  if (to.path === '/') {
    next({ name: 'Login' })
  } else {
    next({
      name: 'Login',
      query: { redirect: to.fullPath }
    })
  }
  return false
}

/**
 * 检查路由是否为静态路由
 */
function isStaticRoute(path: string): boolean {
  const checkRoute = (routes: any[], targetPath: string): boolean => {
    return routes.some((route) => {
      // 处理动态路由参数匹配
      const routePath = route.path
      const pattern = routePath.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*')
      const regex = new RegExp(`^${pattern}$`)

      if (regex.test(targetPath)) {
        return true
      }
      if (route.children && route.children.length > 0) {
        return checkRoute(route.children, targetPath)
      }
      return false
    })
  }

  return checkRoute(staticRoutes, path)
}

/**
 * 处理动态路由注册
 */
async function handleDynamicRoutes(
  to: RouteLocationNormalized,
  next: NavigationGuardNext,
  router: Router
): Promise<void> {
  const userStore = useUserStore()
  
  // 标记初始化进行中
  routeInitInProgress = true

  // 显示 loading
  pendingLoading = true
  loadingService.showLoading()

  try {
    // 1. 获取用户信息
    await fetchUserInfo()

    // 2. 获取菜单数据
    const menuList = await menuProcessor.getMenuList()

    // 3. 验证菜单数据
    if (!menuProcessor.validateMenuList(menuList)) {
      throw new Error('获取菜单列表失败，请重新登录')
    }

    // 4. 注册动态路由
    routeRegistry?.register(menuList)

    // 5. 保存菜单数据到 store
    const menuStore = useMenuStore()
    menuStore.setMenuList(menuList)
    menuStore.addRemoveRouteFns(routeRegistry?.getRemoveRouteFns() || [])

    // 6. 保存 iframe 路由
    IframeRouteManager.getInstance().save()

    // 7. 验证工作标签页
    useWorktabStore().validateWorktabs(router)

    // 8. 验证目标路径权限
    const { homePath } = useCommon()
    const { path: validatedPath, hasPermission } = RoutePermissionValidator.validatePath(
      to.path,
      menuList,
      homePath.value || '/'
    )

    // 初始化成功，重置进行中标记
    routeInitInProgress = false

    // 9. 重新导航到目标路由
    // console.log('[RouteGuard] 检查权限，目标路径:', to.path, '验证路径:', validatedPath, '有权限:', hasPermission)
    // console.log('[RouteGuard] 用户角色:', userStore.info?.roles)
    
    if (!hasPermission) {
      // 无权限访问，跳转到首页
      closeLoading()

      // 输出警告信息
      console.warn(`[RouteGuard] 用户无权限访问路径: ${to.path}，已跳转到首页`)
      // console.log('[RouteGuard] 目标路径:', to.path)
      // console.log('[RouteGuard] 验证后的路径:', validatedPath)
      // console.log('[RouteGuard] 菜单列表长度:', menuList.length)
      // console.log('[RouteGuard] 用户角色:', userStore.info?.roles)
      
      // 检查是否有可用的菜单路径作为首页
      const availablePaths = RoutePermissionValidator.buildMenuPathSet(menuList)
      // console.log('[RouteGuard] 可用的菜单路径:', Array.from(availablePaths))
      
      // 如果有可用路径，选择第一个作为默认首页
      let finalPath = validatedPath
      if (availablePaths.size > 0) {
        finalPath = Array.from(availablePaths)[0]
      }
      
      // 直接跳转到首页
      next({
        path: finalPath,
        replace: true
      })
    } else {
      // 有权限，但需要检查路由是否真实存在
      // 有时候路由注册完成但路由表还没完全更新
      // console.log('[RouteGuard] 用户有权限，准备导航到:', to.path)
      
      // 等待下一个事件循环，确保路由注册完成
      await new Promise(resolve => setTimeout(resolve, 50))
      
      if (to.path === validatedPath && router.hasRoute(to.name || '')) {
        // console.log('[RouteGuard] 路由存在，正常导航')
        // 路由存在，正常导航
        next({
          path: to.path,
          query: to.query,
          hash: to.hash,
          replace: true
        })
      } else {
        // 路由可能还未完全注册完成，稍等后重试
        // console.log('[RouteGuard] 路由可能未完全注册，稍等后重试')
        // console.log('[RouteGuard] 当前所有已注册路由:', router.getRoutes().map(r => ({ path: r.path, name: r.name })))
        
        // 再次检查目标路由是否存在
        if (router.hasRoute(to.name || '')) {
          // console.log('[RouteGuard] 路由现在存在，直接导航')
          next()
        } else {
          // 路由仍然不存在，跳转到首页
          console.warn('[RouteGuard] 路由注册失败，跳转到首页')
          // console.log('[RouteGuard] 检查所有已注册路由:', router.getRoutes().map(r => r.path))
          
          // 尝试找到一个可用的路径
          const availablePaths = RoutePermissionValidator.buildMenuPathSet(menuList)
          let fallbackPath = validatedPath
          if (availablePaths.size > 0) {
            fallbackPath = Array.from(availablePaths)[0]
          }
          
          next({
            path: fallbackPath,
            replace: true
          })
        }
      }
    }
  } catch (error) {
    console.error('[RouteGuard] 动态路由注册失败:', error)

    // 关闭 loading
    closeLoading()

    // 401 错误：token 无效，清除登录状态并重定向到登录页
    if (isUnauthorizedError(error)) {
      // 重置状态，允许重新登录后再次初始化
      routeInitInProgress = false
      routeInitFailed = false
      // 清除用户状态
      AuthService.logout()
      next({ name: 'Login', replace: true })
      return
    }

    // 检查是否是网络错误（后端未启动）
    const isNetworkError = error.message?.includes('Network Error') || 
                           error.message?.includes('ECONNREFUSED') ||
                           error.message?.includes('ERR_CONNECTION_REFUSED') ||
                           error.message?.includes('Failed to fetch')
    
    if (isNetworkError) {
      // 网络错误：后端可能未启动，不标记失败，允许重试
      routeInitInProgress = false
      routeInitFailed = false // 重要：不清除失败标记会导致无法重试
      // 跳转到登录页，让用户等待后端启动后重新登录
      next({ name: 'Login', replace: true })
      return
    }

    if (isNetworkError) {
      // 网络错误：后端可能未启动，不标记失败，允许重试
      routeInitInProgress = false
      routeInitFailed = false // 不标记失败，允许重试
      // 跳转到登录页，让用户等待后端启动后重新登录
      next({ name: 'Login', replace: true })
    } else {
      // 标记初始化失败，防止死循环（仅对于非网络错误）
      routeInitFailed = true
      routeInitInProgress = false
      
      // 输出详细错误信息，便于排查
      if (isHttpError(error)) {
        console.error(`[RouteGuard] 错误码: ${error.code}, 消息: ${error.message}`)
      }
      
      // 跳转到 500 页面，使用 replace 避免产生历史记录
      next({ name: 'Exception500', replace: true })
    }
  }
}

/**
 * 获取用户信息
 */
async function fetchUserInfo(): Promise<void> {
  const userStore = useUserStore()
  
  try {
    const data = await fetchGetUserInfo()
    
    // 根据后端返回格式处理用户信息 { code: 200, data: { user: {...} }, msg: '...' }
    let userData = data
    if (data.code === 200 && data.data && data.data.user) {
      // 如果是 { code: 200, data: { user: {...} }} 格式
      userData = data.data.user
    } else if (data.code === 200 && data.data) {
      // 如果用户信息直接在data中
      userData = data.data
    } else if (data.data && data.data.user) {
      // 如果是 { data: { user: {...} }} 格式
      userData = data.data.user
    }
    
    userStore.setUserInfo(userData)
    // 检查并清理工作台标签页（如果是不同用户登录）
    userStore.checkAndClearWorktabs()
  } catch (error) {
    console.error('获取用户信息失败:', error)
    
    // 检查是否是网络错误（后端未启动）
    const isNetworkError = error.message?.includes('Network Error') || 
                           error.message?.includes('ECONNREFUSED') ||
                           error.message?.includes('ERR_CONNECTION_REFUSED') ||
                           error.message?.includes('Failed to fetch')
    
    if (isNetworkError) {
      // 如果是网络错误，不要登出用户，只是抛出错误让上级处理
      throw error
    } else {
      // 如果获取用户信息失败，可能是token无效，执行登出操作
      AuthService.logout()
      throw error
    }
  }
}

/**
 * 重置路由相关状态
 */
export function resetRouterState(delay: number): void {
  setTimeout(() => {
    routeRegistry?.unregister()
    IframeRouteManager.getInstance().clear()

    const menuStore = useMenuStore()
    menuStore.removeAllDynamicRoutes()
    menuStore.setMenuList([])

    // 重置路由初始化状态，允许重新登录后再次初始化
    resetRouteInitState()
  }, delay)
}

/**
 * 处理根路径重定向到首页
 * @returns true 表示已处理跳转，false 表示无需跳转
 */
function handleRootPathRedirect(to: RouteLocationNormalized, next: NavigationGuardNext): boolean {
  if (to.path !== '/') {
    return false
  }

  const userStore = useUserStore()
  
  // 如果用户未登录，重定向到登录页
  if (!userStore.isLogin) {
    next({ name: 'Login', replace: true })
    return true
  }

  // 如果用户已登录，尝试获取首页路径
  const { homePath } = useCommon()
  
  // 等待动态路由注册完成
  if (!routeRegistry?.isRegistered()) {
    // console.log('[RouteGuard] 动态路由尚未注册完成，稍后重试')
    // 不立即跳转，而是继续执行路由守卫流程
    return false
  }
  
  if (homePath.value && homePath.value !== '/') {
    // console.log('[RouteGuard] 重定向到用户首页:', homePath.value)
    next({ path: homePath.value, replace: true })
    return true
  }

  // 如果没有找到首页路径，默认跳转到仪表盘
  // console.log('[RouteGuard] 默认重定向到仪表盘')
  next({ path: '/dashboard', replace: true })
  return true
}

/**
 * 判断是否为未授权错误（401）
 */
function isUnauthorizedError(error: unknown): boolean {
  return isHttpError(error) && error.code === ApiStatus.unauthorized
}