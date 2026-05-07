
// 地图加载工具类
export class MapLoader {
  private static instance: MapLoader | null = null;
  private mapLoaded = false;
  private loadingPromise: Promise<boolean> | null = null;

  private constructor() {}

  public static getInstance(): MapLoader {
    if (!MapLoader.instance) {
      MapLoader.instance = new MapLoader();
    }
    return MapLoader.instance;
  }

  /**
   * 异步加载地图API
   */
  public async loadMapApi(): Promise<boolean> {
    if (this.mapLoaded) {
      return true;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = new Promise(async (resolve, reject) => {
      // 检查是否已经存在地图脚本
      const existingScript = document.getElementById('tencent-map-script');
      if (existingScript && (window as any).TMap) {
        this.mapLoaded = true;
        resolve(true);
        return;
      }

      try {
        // 测速开始时间
        // const startTime = Date.now();
        // console.log('开始直接加载腾讯地图API');
        // console.log('请求时间戳:', new Date().toISOString());
        
        // 直接加载腾讯地图API，不再通过后端代理
        // const timestamp = new Date().getTime();
        const mapKey = import.meta.env.VITE_TENCENT_MAP_KEY || 'KJ5BZ-2JC6Q-PGA5F-4DREW-YWBR6-TEB24'; // 使用环境变量存储密钥
        const tencentMapUrl = ` https://map.qq.com/api/gljs?v=1.exp&key=${mapKey}&libraries=visualization`;
        
        // 创建并注入脚本标签直接加载腾讯地图API
        const script = document.createElement('script');
        script.id = 'tencent-map-script';
        script.type = 'text/javascript';
        script.src = tencentMapUrl;
        script.async = true; // 异步加载
        
        script.onload = () => {
          console.log('腾讯地图API脚本加载完成');
          console.log('检查TMap是否存在:', !!(window as any).TMap);
          
          // 等待TMap完全初始化
          this.waitForTMapInitialization(resolve, reject);
        };

        script.onerror = (error) => {
          console.error('腾讯地图API加载失败:', error);
          reject(new Error('地图API加载失败'));
        };

        // 添加事件监听器来捕获可能的错误
        script.addEventListener('error', (event) => {
          console.error('脚本加载错误:', event);
        });
        
        // 监听window上的错误事件，以捕获脚本执行期间的错误
        const globalErrorHandler = (errorEvent: ErrorEvent) => {
          console.error('全局错误捕获:', errorEvent);
          if (errorEvent.filename?.includes('map.qq.com')) {
            // 忽略腾讯地图的遥测请求错误
            console.warn('忽略腾讯地图遥测请求错误:', errorEvent);
            return;
          }
        };
        
        window.addEventListener('error', globalErrorHandler);

        // 先添加脚本标签，再执行可能的全局函数
        console.log('即将插入地图API脚本标签');
        document.head.appendChild(script);
        
        // 添加额外的错误处理以应对可能的第三方请求问题
        window.addEventListener('error', (e) => {
          if (e.filename && e.filename.includes('map.qq.com')) {
            // 忽略腾讯地图的遥测请求错误
            console.warn('忽略腾讯地图遥测请求错误:', e);
            return;
          }
        }, true); // 使用捕获阶段
        
        // 移除全局错误监听器
        window.removeEventListener('error', globalErrorHandler);
      } catch (error) {
        console.error('腾讯地图API加载失败:', error);
        reject(new Error('地图API加载失败')); 
      }
    });

    return this.loadingPromise;
  }

  /**
   * 等待TMap完全初始化
   */
  private waitForTMapInitialization(resolve: (value: boolean | PromiseLike<boolean>) => void, reject: (reason?: any) => void): void {
    console.log('开始等待TMap初始化');
    
    // 立即检查TMap是否已经可用
    if ((window as any).TMap) {
      console.log('TMap已初始化');
      this.mapLoaded = true;
      resolve(true);
      return;
    }
    
    // 使用MutationObserver监测DOM变化，可能有助于检测地图库初始化
    const observer = new MutationObserver(() => {
      if ((window as any).TMap) {
        console.log('通过MutationObserver检测到TMap初始化完成');
        cleanupAndResolve();
      }
    });
    
    // 同时使用轮询检查
    const maxAttempts = 120; // 增加等待时间到12秒 (120次 * 100ms)，因为3MB脚本需要更多时间
    let attempts = 0;
    
    const checkTMap = () => {
      attempts++;
      console.log('检查TMap初始化状态，第', attempts, '次尝试');
      
      if ((window as any).TMap) {
        console.log('TMap在第', attempts, '次尝试后初始化完成');
        cleanupAndResolve();
      } else if (attempts >= maxAttempts) {
        console.error('TMap初始化超时，当前window对象内容:', Object.keys(window));
        console.error('检查是否有TMap相关对象:', 'TMap' in window, 'qq' in window);
        cleanupAndReject();
      } else {
        // 继续等待
        setTimeout(checkTMap, 100);
      }
    };
    
    // 清理函数
    const cleanupAndResolve = () => {
      this.mapLoaded = true;
      observer.disconnect();
      resolve(true);
    };
    
    const cleanupAndReject = () => {
      observer.disconnect();
      reject(new Error('地图API初始化超时'));
    };
    
    // 开始观察DOM变化
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // 开始轮询
    setTimeout(checkTMap, 100); // 首次延迟检查
  }
  
  /**
   * 检查地图API是否可用
   */
  public isMapApiAvailable(): boolean {
    return !!(window as any).TMap;
  }

  /**
   * 获取地图实例（确保已加载）
   */
  public async getMapInstance(): Promise<any> {
    await this.loadMapApi();
    
    if (!this.isMapApiAvailable()) {
      throw new Error('地图API未正确加载');
    }

    return (window as any).TMap;
  }

  /**
   * 重置加载状态（用于重新加载）
   */
  public reset(): void {
    this.mapLoaded = false;
    this.loadingPromise = null;
    
    // 移除现有脚本
    const existingScript = document.getElementById('tencent-map-script');
    if (existingScript) {
      existingScript.remove();
    }
  }
}