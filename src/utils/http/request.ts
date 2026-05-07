import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

const VITE_API_PROXY_PORT_URL = import.meta.env.VITE_API_PROXY_PORT_URL

// 创建axios实例
const service: AxiosInstance = axios.create({
  baseURL: VITE_API_PROXY_PORT_URL,
  timeout: 15000,
})

// 请求拦截器：自动添加 Authorization 请求头
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

export default service