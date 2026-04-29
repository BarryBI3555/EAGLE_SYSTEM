const VITE_API_PROXY_PORT_URL = import.meta.env.VITE_API_PROXY_PORT_URL

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

    this.loadingPromise = new Promise((resolve, reject) => {
      // 检查是否已经存在地图脚本
      const existingScript = document.getElementById('tencent-map-script');
      if (existingScript && (window as any).TMap) {
        this.mapLoaded = true;
        resolve(true);
        return;
      }

      // 动态创建脚本
      const script = document.createElement('script');
      script.id = 'tencent-map-script';
      script.charset = 'utf-8';
      script.src = VITE_API_PROXY_PORT_URL + 'api/map/jsapi';
      script.async = true;
      script.defer = true;

      script.onload = () => {
        this.mapLoaded = true;
        resolve(true);
      };

      script.onerror = (error) => {
        console.error('腾讯地图API加载失败:', error);
        reject(new Error('地图API加载失败'));
      };

      document.head.appendChild(script);
    });

    return this.loadingPromise;
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