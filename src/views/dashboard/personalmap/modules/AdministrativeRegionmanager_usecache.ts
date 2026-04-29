import { ref } from 'vue';
const VITE_API_PROXY_PORT_URL = import.meta.env.VITE_API_PROXY_PORT_URL

/**
 * 行政区划管理类
 * 提供地图上行政区划的显示、隐藏和绘制功能
 */
export class AdministrativeRegionManager {
  private static readonly CACHE_KEY = 'administrative_district_cache';
  private static readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30天的毫秒数

  private showingDistricts = ref(false);
  private loadingDistricts = ref(false);
  private districtLayer: any = null;
  private labelLayer: any = null;
  private map: any;

  constructor(map: any) {
    this.map = map;
  }

  /**
   * 从缓存获取行政区划数据
   */
  private getCachedDistricts(): any {
    try {
      const cachedData = localStorage.getItem(AdministrativeRegionManager.CACHE_KEY);
      if (!cachedData) return null;

      const parsed = JSON.parse(cachedData);
      const now = Date.now();
      
      // 检查缓存是否过期
      if (now - parsed.timestamp > AdministrativeRegionManager.CACHE_DURATION) {
        // 缓存过期，清除它
        localStorage.removeItem(AdministrativeRegionManager.CACHE_KEY);
        return null;
      }

      console.log('使用缓存的行政区划数据');
      return parsed.data;
    } catch (error) {
      console.error('读取缓存数据失败:', error);
      localStorage.removeItem(AdministrativeRegionManager.CACHE_KEY);
      return null;
    }
  }

  /**
   * 缓存行政区划数据
   */
  private setCachedDistricts(data: any): void {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(AdministrativeRegionManager.CACHE_KEY, JSON.stringify(cacheData));
      console.log('行政区划数据已缓存');
    } catch (error) {
      console.error('缓存行政区划数据失败:', error);
    }
  }

  /**
   * 清除行政区划缓存
   */
  public clearCache(): void {
    localStorage.removeItem(AdministrativeRegionManager.CACHE_KEY);
    console.log('行政区划缓存已清除');
  }
  /**
   * 切换行政区划显示状态
   */
toggleDistricts = (): void => {
    if (this.showingDistricts.value) {
      this.hideDistricts();
    } else {
      this.showDistricts();
    }
  };

  /**
   * 显示行政区划
   */
  showDistricts = async (): Promise<void> => {
    if (!this.map) {
      console.error('地图未初始化');
      this.showingDistricts.value = false;
      return;
    }

    this.showingDistricts.value = true;
    this.loadingDistricts.value = true;
    
    try {
      // 首先尝试从缓存获取数据
      let districtsData = this.getCachedDistricts();
      
      if (!districtsData) {
        // 缓存中没有数据或已过期，需要从API获取
        console.log('缓存未命中，从API获取行政区划数据');
        
        // 获取当前地图中心点
        const center = this.map.getCenter();
        
        // 通过后端代理获取地理位置信息
        const geocoderUrl = `${VITE_API_PROXY_PORT_URL}api/map/geocoder?location=${center.lat},${center.lng}`;
        
        const geocodeResponse = await fetch(geocoderUrl);
        
        // 检查响应状态和内容类型
        if (!geocodeResponse.ok) {
          console.error('获取地理位置信息失败:', geocodeResponse.status, geocodeResponse.statusText);
          this.showingDistricts.value = false;
          return;
        }
        
        const contentType = geocodeResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('API返回非JSON数据:', contentType, await geocodeResponse.text());
          this.showingDistricts.value = false;
          return;
        }
        
        const geocodeData = await geocodeResponse.json();
        
        if (geocodeData.status === 0) {
          // 使用城市名称进行搜索
          const addressComponent = geocodeData.result.address_component;
          let areaName =  addressComponent.city;
          
          const searchUrl = `${VITE_API_PROXY_PORT_URL}api/map/district/search?keyword=${encodeURIComponent(areaName)}`;
          const searchResponse = await fetch(searchUrl);
          
          // 检查响应状态和内容类型
          if (!searchResponse.ok) {
            console.error('搜索行政区划失败:', searchResponse.status, searchResponse.statusText);
            this.showingDistricts.value = false;
            return;
          }
          
          const searchContentType = searchResponse.headers.get('content-type');
          if (!searchContentType || !searchContentType.includes('application/json')) {
            console.error('搜索API返回非JSON数据:', searchContentType, await searchResponse.text());
            this.showingDistricts.value = false;
            return;
          }
          
          const searchData = await searchResponse.json();
          
          let adcode = null;
          if (searchData.status === 0 && searchData.result && Array.isArray(searchData.result)) {
            // 尝试从结果中找到合适的地区ID
            if (searchData.result.length > 0) {
              // 寻找最匹配的结果，增加安全检查防止undefined错误
              const matchedResult = searchData.result.find(item => 
                item && 
                Array.isArray(item) && 
                item[0] && 
                item[0].title && 
                typeof item[0].title === 'string' &&
                typeof areaName === 'string' &&
                (item[0].title.includes(areaName) || areaName.includes(item[0].title))
              );
              
              if (matchedResult && matchedResult[0]) {
                adcode = matchedResult[0].id;
              } else {
                // 如果没找到精确匹配，使用第一个结果
                adcode = searchData.result[0][0]?.id;
              }
            }
          }
          
          if (!adcode) {
            console.error('未能获取到有效的地区ID', searchData);
            this.showingDistricts.value = false;
            return;
          }
          
          // 通过后端代理获取下级行政区划
          const childrenUrl = `${VITE_API_PROXY_PORT_URL}api/map/district/getchildren?id=${adcode}`;
          const childrenResponse = await fetch(childrenUrl);
          
          // 检查响应状态和内容类型
          if (!childrenResponse.ok) {
            console.error('获取下级行政区划数据失败:', childrenResponse.status, childrenResponse.statusText);
            this.showingDistricts.value = false;
            return;
          }
          
          const childrenContentType = childrenResponse.headers.get('content-type');
          if (!childrenContentType || !childrenContentType.includes('application/json')) {
            console.error('获取子区划API返回非JSON数据:', childrenContentType, await childrenResponse.text());
            this.showingDistricts.value = false;
            return;
          }
          
          const childrenData = await childrenResponse.json();
          
          if (childrenData.status === 0 && childrenData.result) {
            districtsData = childrenData.result;
            // 将数据缓存起来
            this.setCachedDistricts(districtsData);
          } else {
            console.error('获取下级行政区划数据失败:', childrenData.message);
            this.showingDistricts.value = false;
            return;
          }
        } else {
          console.error('获取地理位置信息失败:', geocodeData.message);
          this.showingDistricts.value = false;
          return;
        }
      } else {
        console.log('使用缓存数据绘制行政区划');
      }
      
      // 使用获取到的数据（来自缓存或API）绘制行政区划
      if (districtsData) {
        await this.drawDistricts(districtsData);
        this.showingDistricts.value = true;
      } else {
        console.error('未能获取到行政区划数据');
        this.showingDistricts.value = false;
      }
    } catch (error) {
      console.error('获取行政区划数据出错:', error);
      this.showingDistricts.value = false;
    } finally {
      // 确保无论成功还是失败都重置加载状态
      this.loadingDistricts.value = false;
    }
  };

  /**
   * 隐藏行政区划
   */
  hideDistricts = async (): Promise<void> => {
    if (this.districtLayer) {
      this.districtLayer.setMap(null);
      this.districtLayer = null;
    }
    
    this.showingDistricts.value = false;
    this.loadingDistricts.value = false; // 确保加载状态也被重置
    
    // 返回一个Promise以确保调用方可以await
    return Promise.resolve();
  };

  /**
   * 强制刷新行政区划数据（忽略缓存）
   */
  public async refreshDistricts(): Promise<void> {
    // 清除缓存
    this.clearCache();
    // 重新显示（这将强制从API获取新数据）
    if (this.showingDistricts.value) {
      await this.hideDistricts();
      await this.showDistricts();
    }
  };

  /**
   * 获取缓存状态
   */
  public isCacheValid(): boolean {
    const cachedData = this.getCachedDistricts();
    return cachedData !== null;
  };

  /**
   * 获取缓存过期时间
   */
  public getCacheExpiryTime(): Date | null {
    try {
      const cachedData = localStorage.getItem(AdministrativeRegionManager.CACHE_KEY);
      if (!cachedData) return null;

      const parsed = JSON.parse(cachedData);
      const expiryTime = new Date(parsed.timestamp + AdministrativeRegionManager.CACHE_DURATION);
      return expiryTime;
    } catch (error) {
      console.error('获取缓存过期时间失败:', error);
      return null;
    }
  };
   /**
   * 生成随机颜色
   */
  private generateRandomColor = (alpha: number = 0.3): string => {
    const r = Math.floor(Math.random() * 156) + 50; // 50-205
    const g = Math.floor(Math.random() * 156) + 50;
    const b = Math.floor(Math.random() * 156) + 50;
    return `rgba(${r},${g},${b},${alpha})`;
  };
  /**
   * 生成互补的边框颜色
   */
  private generateBorderColor = (fillColor: string): string => {
    // 从rgba字符串中提取RGB值
    const match = fillColor.match(/rgba\((\d+),(\d+),(\d+)/);
    if (!match) return '#000000';
    
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    
    // 生成更明显的对比色
    // 如果填充色较亮，使用深色边框；如果填充色较暗，使用亮色边框
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    if (brightness >0) {
      // 亮色填充，使用深色边框
      return `rgb(${Math.max(0, r - 100)},${Math.max(0, g - 100)},${Math.max(0, b - 100)})`;
    } else {
      // 暗色填充，使用亮色边框
      return `rgb(${Math.min(255, r + 100)},${Math.min(255, g + 100)},${Math.min(255, b + 100)})`;
    }
  };


  /**
   * 绘制行政区划
   */
  drawDistricts = async (districts: any): Promise<void> => {
    if (!districts) return;
    
    // 清除现有的行政区划图层
    await this.hideDistricts();
    
    const polygons: any[] = [];
    const styleMap = new Map(); // 存储每个区域的样式
    // 递归处理行政区划数据
    const processDistricts = (data: any) => {
      if (!data) return;
      
      // 检查是否是二维数组结构 [[{...}, {...}]]
      if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
        // 二维数组，遍历内部数组
        data.forEach(innerArray => {
          if (Array.isArray(innerArray)) {
            innerArray.forEach(district => {
              this.addDistrictPolygon(district, polygons, styleMap);
            });
          }
        });
      } else if (Array.isArray(data)) {
        // 一维数组，直接遍历
        data.forEach(district => {
          this.addDistrictPolygon(district, polygons, styleMap);
        });
      } else if (typeof data === 'object') {
        // 单个对象
        this.addDistrictPolygon(data, polygons, styleMap);
      }
    };
    
    // 开始处理传入的数据
    processDistricts(districts);
    
    // 创建行政区划图层
    if (polygons.length > 0) {
      const styles: any = {};
      styleMap.forEach((style, styleId) => {
        styles[styleId] = new (window as any).TMap.PolygonStyle(style);
      });
      
      this.districtLayer = new (window as any).TMap.MultiPolygon({
        map: this.map,
        styles: styles,
        geometries: polygons
      });
      this.showingDistricts.value = true;
    } else {
      console.warn('没有找到有效的行政区划数据用于绘制');
      this.showingDistricts.value = false;
    }
  };

  /**
   * 添加单个行政区划多边形
   */
  private addDistrictPolygon = (district: any, polygons: any[], styleMap: Map<string, any>): void => {
    if (!district || !district.polygon) {
      console.warn('跳过无效的区划数据:', district);
      return;
    }
     // 为每个区域生成唯一的样式ID
    const styleId = `districtStyle_${district.id || Math.random().toString(36).substr(2, 9)}`;
    
    // 如果样式不存在，则创建新的样式
    if (!styleMap.has(styleId)) {
      const fillColor = this.generateRandomColor(0.40);
      const borderColor = this.generateBorderColor(fillColor);
      
      styleMap.set(styleId, {
        color: fillColor, // 随机填充颜色
        borderColor: borderColor, // 互补的边框颜色
        borderWidth: 10, // 增加边框宽度
        borderStyle: 'solid', // 使用标准边框样式
        showBorder: true
      });
    }
    
    // district.polygon 是一个二维数组 [[lng, lat, lng, lat, ...]]
    if (Array.isArray(district.polygon)) {
      district.polygon.forEach((polygonRing, ringIndex) => {
        if (!Array.isArray(polygonRing) || polygonRing.length < 6) { // 至少3个点（6个坐标值）
          console.warn('跳过无效的多边形环:', polygonRing);
          return;
        }
        
        // 将一维坐标数组转换为经纬度对 [[lat, lng], [lat, lng], ...]
        const paths = [];
        // polygonRing 格式是 [lng, lat, lng, lat, ...]
        for (let i = 0; i < polygonRing.length; i += 2) {
          if (i + 1 < polygonRing.length) {
            const lng = polygonRing[i];
            const lat = polygonRing[i + 1];
            paths.push(new (window as any).TMap.LatLng(lat, lng));
          }
        }
        
        if (paths.length >= 3) { // 至少需要3个点才能构成一个多边形
          polygons.push({
            id: `${district.id || 'district'}_${ringIndex}`,
            styleId: styleId,
            paths: [paths],
            properties: {
              name: district.fullname || district.name || district.title || '未知区域',
              id: district.id
            }
          });
        } else {
          console.warn(`区划 ${district.fullname || district.id} 的多边形环点数不足:`, paths.length);
        }
      });


    }
    
    // 递归处理子区划
    if (district.districts) {
      const processDistricts = (data: any) => {
        if (!data) return;
        
        // 检查是否是二维数组结构 [[{...}, {...}]]
        if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
          // 二维数组，遍历内部数组
          data.forEach(innerArray => {
            if (Array.isArray(innerArray)) {
              innerArray.forEach(subDistrict => {
                this.addDistrictPolygon(subDistrict, polygons, styleMap);
              });
            }
          });
        } else if (Array.isArray(data)) {
          // 一维数组，直接遍历
          data.forEach(subDistrict => {
            this.addDistrictPolygon(subDistrict, polygons, styleMap);
          });
        } else if (typeof data === 'object') {
          // 单个对象
          this.addDistrictPolygon(data, polygons, styleMap);
        }
      };
      processDistricts(district.districts);
    }
  };

  /**
   * 获取当前显示状态
   */
  isShowing = (): boolean => {
    return this.showingDistricts.value;
  };

  /**
   * 获取加载状态
   */
  isLoading = (): boolean => {
    return this.loadingDistricts.value;
  };

  /**
   * 获取当前地图实例
   */
  getMap = (): any => {
    return this.map;
  };

  /**
   * 设置新的地图实例
   */
  setMap = (map: any): void => {
    this.map = map;
  };
}