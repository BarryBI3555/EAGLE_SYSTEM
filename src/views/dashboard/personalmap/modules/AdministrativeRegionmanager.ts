import { ref } from 'vue';

/**
 * 行政区划管理类
 * 提供地图上行政区划的显示、隐藏和绘制功能
 */
export class AdministrativeRegionManager {
  private showingDistricts = ref(false);
  private loadingDistricts = ref(false);
  private districtLayer: any = null;
  private labelLayer: any = null;
  private map: any;

  constructor(map: any) {
    this.map = map;
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
    
    try {
      // 获取当前地图中心点
      const center = this.map.getCenter();
      
      // 通过后端代理获取地理位置信息
      const geocoderUrl = `http://localhost:8080/api/map/geocoder?location=${center.lat},${center.lng}`;
      
      const geocodeResponse = await fetch(geocoderUrl);
      const geocodeData = await geocodeResponse.json();
      
      if (geocodeData.status === 0) {
        // 使用城市名称进行搜索
        const addressComponent = geocodeData.result.address_component;
        let areaName =  addressComponent.city;
        
        const searchUrl = `http://localhost:8080/api/map/district/search?keyword=${encodeURIComponent(areaName)}`;
        const searchResponse = await fetch(searchUrl);
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
        const childrenUrl = `http://localhost:8080/api/map/district/getchildren?id=${adcode}`;
        const childrenResponse = await fetch(childrenUrl);
        const childrenData = await childrenResponse.json();
        
        if (childrenData.status === 0 && childrenData.result) {
          // 直接传递整个result数组给drawDistricts
          await this.drawDistricts(childrenData.result);
          this.showingDistricts.value = true;
        } else {
          console.error('获取下级行政区划数据失败:', childrenData.message);
          this.showingDistricts.value = false;
        }
      } else {
        console.error('获取地理位置信息失败:', geocodeData.message);
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
    
    // 生成互补色（颜色反转）
    const borderR = 255 - r;
    const borderG = 255 - g;
    const borderB = 255 - b;
    
    return `rgb(${borderR},${borderG},${borderB})`;
  };


  /**
   * 绘制行政区划
   */
  drawDistricts = async (districts: any): Promise<void> => {
    if (!districts) return;
    
    // 清除现有的行政区划图层
    await this.hideDistricts();
    
    const polygons: any[] = [];
    const labels: any[] = []; // 新增标签数组
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
      
      if (labels.length > 0) {
      this.labelLayer = new (window as any).TMap.MultiLabel({
        map: this.map,
        styles: {
          districtLabel: new (window as any).TMap.LabelStyle({
            color: 'rgba(255, 255, 255, 0.8)', // 白色半透明字体
            size: 16, // 较大字体
            backgroundColor: 'rgba(0, 0, 0, 0.5)', // 半透明白色背景
            borderColor: '#006096', // 边框颜色
            borderWidth: 1, // 边框宽度
            borderRadius: 4, // 圆角
            padding: '4px 8px', // 内边距
            offset: { x: 0, y: 0 }, // 偏移
            angle: 0, // 角度
            alignment: 'center', // 对齐方式
            verticalAlignment: 'middle' // 垂直对齐方式
          })
        },
        geometries: labels
      });
    }
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
      const fillColor = this.generateRandomColor(0.50);
      const borderColor = this.generateBorderColor(fillColor);
      
      styleMap.set(styleId, {
        color: fillColor, // 随机填充颜色
        strokeColor: borderColor, // 互补的边框颜色
        strokeWidth: 2, // 边框宽度
        strokeStyle: 'solid-bold' // 边框样式
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
                this.addDistrictPolygon(subDistrict, polygons);
              });
            }
          });
        } else if (Array.isArray(data)) {
          // 一维数组，直接遍历
          data.forEach(subDistrict => {
            this.addDistrictPolygon(subDistrict, polygons);
          });
        } else if (typeof data === 'object') {
          // 单个对象
          this.addDistrictPolygon(data, polygons);
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