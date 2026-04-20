import { ref } from 'vue';

interface ComponentMap {
  [key: string]: () => Promise<any>
}

const preloadCache = new Map<string, any>();

export const usePreload = () => {
  const isLoading = ref(false);
  
  const preloadComponents = async (components: ComponentMap) => {
    isLoading.value = true;
    
    try {
      const promises = Object.entries(components).map(async ([key, importFunc]) => {
        if (!preloadCache.has(key)) {
          const component = await importFunc();
          preloadCache.set(key, component.default || component); // 确保获取默认导出
          return component;
        }
        return preloadCache.get(key);
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to preload components:', error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };
  
  const getPreloadedComponent = (key: string) => {
    return preloadCache.get(key);
  };
  
  // 检查组件是否已预加载
  const isPreloaded = (key: string) => {
    return preloadCache.has(key);
  };
  
  return {
    preloadComponents,
    getPreloadedComponent,
    isPreloaded,
    isLoading
  };
};