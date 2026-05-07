import { ElMessage } from 'element-plus'
import { AuthService } from '@/services/authService'
import { useRouter } from 'vue-router'

/**
 * 处理401未授权错误的中间件
 * 当API返回401状态码时调用
 */
export function handleAuthError(): void {
  // 清除认证信息
  AuthService.logout()
  
  // 显示错误消息
  ElMessage.error('登录已过期，请重新登录')
  
  // 跳转到登录页
  const router = useRouter()
  const currentPath = router.currentRoute.value.fullPath
  
  // 避免在登录页无限重定向
  if (currentPath !== '/auth/login') {
    router.push({
      path: '/auth/login',
      query: { redirect: currentPath }
    })
  }
}

/**
 * 检查响应是否为401未授权错误
 */
export function isUnauthorizedResponse(response: any): boolean {
  return response && response.status === 401
}

/**
 * 检查错误响应是否为401未授权错误
 */
export function isUnauthorizedError(error: any): boolean {
  return error && 
         error.response && 
         error.response.status === 401
}

/**
 * 检查是否已登录
 * 如果未登录且访问需要认证的页面，则重定向到登录页
 */
export function checkAuthAndRedirect(toPath: string): boolean {
  const isPublicRoute = ['/auth/login', '/auth/register'].includes(toPath)
  
  if (!isPublicRoute && !AuthService.isLoggedIn()) {
    const router = useRouter()
    router.push({
      path: '/auth/login',
      query: { redirect: toPath }
    })
    return false
  }
  
  return true
}