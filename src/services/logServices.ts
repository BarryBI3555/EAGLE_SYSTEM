/**
 * 日志服务
 * 用于记录用户操作日志
 */
import request from '@/utils/http';

export class LogService {
  /**
   * 写入日志
   * @param operation 操作描述
   */
  static async writeLog(operation: string): Promise<void> {
    try {
      await request.post({
        url: 'api/log/write',
        data: { operation }
      });
    } catch (error) {
      // 日志写入失败不影响主流程
      console.warn('日志写入失败:', error);
    }
  }

  /**
   * 登录日志
   * @param username 用户名
   */
  static async loginLog(username: string): Promise<void> {
    await this.writeLog(`${username}登录`);
  }

  /**
   * 登出日志
   */
  static async logoutLog(username: string): Promise<void> {
    await this.writeLog(`${username}登出`);
  }

  /**
   * 个人地图页面操作日志
   * @param action 操作类型
   * @param params 查询参数
   */
  static async userMapLog( action: string, params?: Record<string, any>): Promise<void> {
    const paramsStr = params ? `，查询条件: ${JSON.stringify(params)}` : '';
    await this.writeLog(`地图页面 - ${action}${paramsStr}`);
  }

  /**
   * 表格页面操作日志
   * @param pageName 页面名称
   * @param action 操作类型
   * @param params 查询参数
   */
  static async tableLog(pageName: string, action: string, params?: Record<string, any>): Promise<void> {
    const paramsStr = params ? `，查询条件: ${JSON.stringify(params)}` : '';
    await this.writeLog(`${pageName}页面 - ${action}${paramsStr}`);
  }

  /**
   * 3D热力图页面操作日志
   * @param action 操作类型
   * @param params 查询参数
   */
  static async hotmapLog( action: string, params?: Record<string, any>): Promise<void> {
    const paramsStr = params ? `，查询条件: ${JSON.stringify(params)}` : '';
    await this.writeLog(`3D热力图页面 - ${action}${paramsStr}`);
  }
}

export default LogService;