/**
 * 统一 API 接口模块
 * 整合 usermap、3dhotmap、table_cur_ 等组件的 API 请求
 */
import request from '@/utils/http'

// ==================== 人员位置相关 API ====================

/**
 * 获取人员最新位置
 * @param params 查询参数
 */
export const axiosRequestLatestLocations = (params: Record<string, any>) => {
  return request.get({ url: '/api/locations/latest', params })
}

/**
 * 获取片区列表
 * @param params 查询参数
 */
export const axiosRequestGroupList = (params: Record<string, any> = {}) => {
  return request.get({ url: '/api/locations/groups', params })
}

/**
 * 获取单个人员轨迹
 * @param usercode 用户编码
 * @param params 查询参数
 */
export const axiosRequestUserTrajectory = (usercode: string, params: Record<string, any> = {}) => {
  return request.get({ url: `/api/locations/user/${usercode}`, params })
}

// ==================== 热力图相关 API ====================

/**
 * 获取统计卡片数据
 * @param params 查询参数
 */
export const axiosRequestStatsCardsData = (params: Record<string, any> = {}) => {
  return request.get({ url: 'api/statsCardsData', params })
}

/**
 * 获取热力图数据
 * @param params 查询参数
 */
export const axiosRequestHeatMapData = (params: Record<string, any> = {}) => {
  return request.get({ url: 'api/hotmap', params })
}

// ==================== 工作量统计相关 API ====================

/**
 * 获取部门当日工作量统计
 * @param params 查询参数
 */
export const axiosRequestDailyWorkloadBm = (params: Record<string, any>) => {
  return request.get({ url: 'api/cur_gzl_bm/list', params })
}

/**
 * 获取小组当日工作量统计
 * @param params 查询参数
 */
export const axiosRequestDailyWorkloadGroup = (params: Record<string, any>) => {
  return request.get({ url: 'api/cur_gzl_group/list', params })
}

/**
 * 获取人员当日工作量统计
 * @param params 查询参数
 */
export const axiosRequestDailyWorkloadRy = (params: Record<string, any>) => {
  return request.get({ url: 'api/cur_gzl/list', params })
}

/**
 * 获取人事当日工作量统计
 * @param params 查询参数
 */
export const axiosRequestDailyWorkloadRs = (params: Record<string, any>) => {
  return request.get({ url: 'api/cur_gzl_rs/list', params })
}

// ==================== 行政区划相关 API ====================

/**
 * 获取地理位置信息（通过后端代理）
 * @param location 位置坐标
 */
export const axiosRequestGeocoder = (location: string) => {
  const VITE_API_PROXY_PORT_URL = import.meta.env.VITE_API_PROXY_PORT_URL
  const url = `${VITE_API_PROXY_PORT_URL}api/map/geocoder?location=${location}`
  return request.get({ url })
}

/**
 * 搜索行政区划
 * @param keyword 搜索关键词
 */
export const axiosRequestSearchDistrict = (keyword: string) => {
  const VITE_API_PROXY_PORT_URL = import.meta.env.VITE_API_PROXY_PORT_URL
  const url = `${VITE_API_PROXY_PORT_URL}api/map/district/search?keyword=${encodeURIComponent(keyword)}`
  return request.get({ url })
}

/**
 * 获取行政区划子节点
 * @param id 行政区划ID
 */
export const axiosRequestDistrictChildren = (id: string) => {
  return request.get({ url: 'api/map/district/getchildren', params: { id } })
}

// ==================== 操作日志相关 API ====================

/**
 * 查询操作日志
 * @param params 查询参数
 */
export const axiosRequestQueryOperationLogs = (params: Record<string, any>) => {
  return request.get({ url: 'api/log/query', params })
}

/**
 * 写入操作日志
 * @param operation 操作描述
 */
export const axiosRequestWriteOperationLog = (operation: string) => {
  return request.post({ url: 'api/log/write', data: { operation } })
}