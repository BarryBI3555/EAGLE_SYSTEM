const VITE_API_PROXY_PORT_URL = import.meta.env.VITE_API_PROXY_PORT_URL
interface LoginResponse {
  success: boolean
  message?: string
  token?: string
  data?: any
}

interface RegisterResponse {
  success: boolean
  message?: string
}

export class AuthService {
  private static readonly LOGIN_URL = `${VITE_API_PROXY_PORT_URL}api/auth/login`
  private static readonly REGISTER_URL = `${VITE_API_PROXY_PORT_URL}api/auth/register`
  private static readonly ME_URL = `${VITE_API_PROXY_PORT_URL}api/auth/info`

  /**
   * 用户登录
   * @param username 用户名
   * @param password 密码
   * @returns 登录结果
   */
  static async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(this.LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      // 检查响应是否成功获取
      if (!response.ok) {
        // 尝试获取错误响应体
        const errorData = await response.text();
        let errorMessage = '登录失败';
        try {
          const parsedError = JSON.parse(errorData);
          errorMessage = parsedError.message || parsedError.msg || errorMessage;
        } catch {
          // 如果无法解析为JSON，使用原始文本
          errorMessage = errorData || errorMessage;
        }
        // console.log('登录失败，响应数据:', errorMessage);
        return { success: false, message: errorMessage };
      }

      const data = await response.json()
      
      // 调试日志
      // console.log('登录响应数据:', data)
      // console.log('响应状态:', response.status)
      
      if (response.ok) {
        // 保存token到localStorage
        if (data.code === 200 && data.data && data.data.token) {
          // 后端返回的标准结构: { code: 200, data: { token: '...', user: {...} }}
          const token = data.data.token;
          const user = data.data.user;
          
          localStorage.setItem('access_token', token)
          // 设置axios请求头
          this.setAuthToken(token)
          
          return { 
            success: true, 
            token: token, 
            data: { ...data.data, user: user } 
          }
        } else {
          // 如果没有找到期望的结构，返回错误
          // console.log('登录响应格式不符合预期，响应数据:', data);
          return { 
            success: false, 
            message: data.msg || data.message || '登录响应格式错误' 
          };
        }
      }
    } catch (error) {
      console.error('登录请求失败:', error)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // 网络错误
        return { success: false, message: '网络请求失败，请检查网络连接和服务器状态' };
      }
      return { success: false, message: '网络请求失败' };
    }
  }

  /**
   * 用户注册
   * @param username 用户名
   * @param password 密码
   * @returns 注册结果
   */
  static async register(username: string, password: string): Promise<RegisterResponse> {
    try {
      const response = await fetch(this.REGISTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      // 检查响应是否成功获取
      if (!response.ok) {
        // 尝试获取错误响应体W
        const errorData = await response.text();
        let errorMessage = '注册失败';
        try {
          const parsedError = JSON.parse(errorData);
          errorMessage = parsedError.message || parsedError.msg || errorMessage;
        } catch {
          // 如果无法解析为JSON，使用原始文本
          errorMessage = errorData || errorMessage;
        }
        // console.log('注册失败，响应数据:', errorData);
        return { success: false, message: errorMessage };
      }

      const data = await response.json()
      
      // 调试日志
      // console.log('注册响应数据:', data)
      // console.log('注册响应状态:', response.status)
      
      return { success: true, message: data.message || data.msg || '注册成功' };
    } catch (error) {
      console.error('注册请求失败:', error)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // 网络错误
        return { success: false, message: '网络请求失败，请检查网络连接和服务器状态' };
      }
      return { success: false, message: '网络请求失败' };
    }
  }

  /**
   * 获取当前用户信息
   * @returns 用户信息
   */
  static async getCurrentUser(): Promise<any> {
    try {
      const token = this.getToken()
      if (!token) {
        throw new Error('未登录')
      }

      const response = await fetch(this.ME_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      // 检查响应是否成功获取
      if (!response.ok) {
        if (response.status === 401) {
          this.clearToken()
          throw new Error('登录已过期，请重新登录')
        }
        // 尝试获取错误响应体
        const errorData = await response.text();
        let errorMessage = '获取用户信息失败';
        try {
          const parsedError = JSON.parse(errorData);
          errorMessage = parsedError.message || parsedError.msg || errorMessage;
        } catch {
          // 如果无法解析为JSON，使用原始文本
          errorMessage = errorData || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json()
      
      // 调试日志
      // console.log('获取用户信息响应数据:', data)
      // console.log('获取用户信息响应状态:', response.status)
      
      // 后端返回的是标准结构 { code: 200, data: {...}, msg: '...' }
      if (data.code === 200 && data.data) {
        return data.data
      }
      // 如果直接返回用户数据（向后兼容）
      return data
    } catch (error) {
      console.error('获取用户信息失败:', error)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // 网络错误
        throw new Error('网络请求失败，请检查网络连接和服务器状态')
      }
      throw error
    }
  }

  /**
   * 退出登录
   */
  static logout(): void {
    this.clearToken()
    // 可以在这里执行其他清理操作
  }

  /**
   * 获取token
   */
  static getToken(): string | null {
    return localStorage.getItem('access_token')
  }

  /**
   * 设置token
   */
  static setToken(token: string): void {
    localStorage.setItem('access_token', token)
    this.setAuthToken(token)
  }

  /**
   * 清除token
   */
  static clearToken(): void {
    localStorage.removeItem('access_token')
    // 如果使用axios，清除请求头
    if ((window as any).axios) {
      delete (window as any).axios.defaults.headers.common['Authorization']
    }
  }

  /**
   * 设置axios请求头中的认证token
   */
  private static setAuthToken(token: string): void {
    // 如果项目使用axios，设置默认请求头
    if ((window as any).axios) {
      (window as any).axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    }
  }

  /**
   * 检查是否已登录
   */
  static isLoggedIn(): boolean {
    const token = this.getToken()
    if (!token) return false
    
    // 检查token是否过期（如果有存储过期时间的话）
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Math.floor(Date.now() / 1000)
      return payload.exp > currentTime
    } catch (e) {
      // 如果无法解析token，假设它是有效的
      return !!token
    }
  }
}