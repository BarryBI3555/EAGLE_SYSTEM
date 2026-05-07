import { AuthService } from '@/services/authService';

interface FetchOptions extends RequestInit {
  url: string;
  params?: Record<string, any>;
}

class FetchWrapper {
  private baseUrl: string;

  constructor() {
    // 确保baseUrl末尾没有多余的斜杠
    const rawBaseUrl = import.meta.env.VITE_API_PROXY_PORT_URL || '';
    this.baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
  }
  
  private buildFullUrl(url: string): string {
    // 如果URL已经是完整URL，直接返回
    if (url.startsWith('http')) {
      return url;
    }
    
    // 确保URL前面有斜杠
    const normalizedUrl = url.startsWith('/') ? url : '/' + url;
    
    return this.baseUrl + normalizedUrl;
  }

  async request<T = any>(options: FetchOptions): Promise<T> {
    const { url, params, method = 'GET', headers, body, ...rest } = options;
    
    // 构建完整URL，避免双斜杠
    let fullUrl = this.buildFullUrl(url);
    
    // 处理查询参数
    if (params) {
      const searchParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          searchParams.append(key, String(params[key]));
        }
      });
      const queryString = searchParams.toString();
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
    }

    // 获取认证token
    const token = AuthService.getToken();
    
    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...headers,
      },
      ...rest,
    };

    // 如果有body，转换为字符串（除非是FormData）
    if (body && !(body instanceof FormData)) {
      config.body = typeof body === 'string' ? body : JSON.stringify(body);
    } else if (body) {
      config.body = body;
    }

    try {
      const response = await fetch(fullUrl, config);

      // 检查响应状态
      if (!response.ok) {
        if (response.status === 401) {
          // Token过期或无效，清除认证信息
          AuthService.logout();
          throw new Error('登录已过期，请重新登录');
        }
        
        // 尝试获取错误响应
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.msg || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      // 对于204 No Content，直接返回null
      if (response.status === 204) {
        return null as T;
      }

      // 尝试解析JSON响应
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text() as unknown as T;
      }
    } catch (error) {
      console.error('请求失败:', error);
      throw error;
    }
  }

  get<T = any>(url: string, params?: Record<string, any>, options?: Omit<FetchOptions, 'url' | 'method' | 'params'>) {
    return this.request<T>({ url, method: 'GET', params, ...options });
  }

  post<T = any>(url: string, body?: any, options?: Omit<FetchOptions, 'url' | 'method' | 'body'>) {
    return this.request<T>({ url, method: 'POST', body, ...options });
  }

  put<T = any>(url: string, body?: any, options?: Omit<FetchOptions, 'url' | 'method' | 'body'>) {
    return this.request<T>({ url, method: 'PUT', body, ...options });
  }

  delete<T = any>(url: string, params?: Record<string, any>, options?: Omit<FetchOptions, 'url' | 'method' | 'params'>) {
    return this.request<T>({ url, method: 'DELETE', params, ...options });
  }
}

export default new FetchWrapper();