import request from '@/utils/http/request'
import { AuthService } from '@/services/authService'
import { useUserStore } from '@/store/modules/user'

/**
 * 获取当前用户信息
 * @returns 用户信息
 */
export async function fetchGetUserInfo(): Promise<Api.Auth.UserInfo> {
  try {
    const userStore = useUserStore()
    // console.log('开始请求用户信息...')
    // console.log('当前用户store信息:', {
    //   isLogin: userStore.isLogin,
    //   accessToken: userStore.accessToken ? '存在' : '不存在',
    //   userInfo: userStore.info
    // })
    
    const response = await request.get('/api/auth/info')
    
    // console.log('获取用户信息响应状态:', response.status)
    // console.log('获取用户信息响应数据:', response.data)
    
    // 统一响应格式处理: { code: 200, msg: "success", data: {...} }
    if (response.data && response.data.code === 200 && response.data.data) {
      // console.log('解析用户数据成功:', response.data.data)
      return response.data.data
    }
    
    // 如果直接返回用户数据
    // console.log('返回原始用户数据:', response.data)
    return response.data
  } catch (error: any) {
    // console.error('获取用户信息失败:', error)
    // console.error('错误详情:', {
    //   status: error.response?.status,
    //   statusText: error.response?.statusText,
    //   data: error.response?.data,
    //   message: error.message
    // })
    
    // 如果请求失败且状态码为401（未授权），执行登出操作
    // 但如果是403（禁止访问）且不是因为认证问题，则不登出用户（可能是因为后端未启动）
    if (error.response && error.response.status === 401) {
      // console.log('检测到认证错误，执行登出操作')
      AuthService.logout()
    }
    throw error
  }
}

/**
 * 用户登录
 */
export async function apiLogin(username: string, password: string): Promise<any> {
  const response = await request.post('/api/auth/login', {
    username,
    password
  })
  return response.data
}

/**
 * 用户注册
 */
export async function apiRegister(userData: any): Promise<any> {
  const response = await request.post('/api/auth/register', userData)
  return response.data
}