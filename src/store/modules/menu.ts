// 由于无法找到该文件，这里提供一个参考实现
// 如果存在menu store，建议添加一个方法来手动刷新菜单

/*
// 示例实现：

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { MenuProcessor } from '@/router/core/MenuProcessor'
import { useUserStore } from './user'
import { AppRouteRecord } from '@/types/router'

export const useMenuStore = defineStore('menu', () => {
  const menuList = ref<AppRouteRecord[]>([])
  
  // 添加刷新菜单的方法
  const refreshMenuByRoles = async () => {
    const userStore = useUserStore()
    const roles = userStore.info?.roles || []
    
    if (roles.length === 0) {
      console.warn('用户没有角色，无法刷新菜单')
      return
    }
    
    const processor = new MenuProcessor()
    const allMenus = await processor.getMenuList() // 获取所有菜单
    const filteredMenus = processor.filterMenuByRoles(allMenus, roles) // 根据角色过滤
    
    menuList.value = filteredMenus
    console.log('菜单已根据角色刷新', roles)
  }
  
  return {
    menuList,
    refreshMenuByRoles
  }
})
*//**
 * 菜单状态管理模块
 *
 * 提供菜单数据和动态路由的状态管理
 *
 * ## 主要功能
 *
 * - 菜单列表存储和管理
 * - 首页路径配置
 * - 动态路由注册和移除
 * - 路由移除函数管理
 * - 菜单宽度配置
 *
 * ## 使用场景
 *
 * - 动态菜单加载和渲染
 * - 路由权限控制
 * - 首页路径动态设置
 * - 登出时清理动态路由
 *
 * ## 工作流程
 *
 * 1. 获取菜单数据（前端/后端模式）
 * 2. 设置菜单列表和首页路径
 * 3. 注册动态路由并保存移除函数
 * 4. 登出时调用移除函数清理路由
 *
 * @module store/modules/menu
 * @author Art Design Pro Team
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { AppRouteRecord } from '@/types/router'
import { getFirstMenuPath } from '@/utils'
import { HOME_PAGE_PATH } from '@/router'

/**
 * 菜单状态管理
 * 管理应用的菜单列表、首页路径、菜单宽度和动态路由移除函数
 */
export const useMenuStore = defineStore('menuStore', () => {
  /** 首页路径 */
  const homePath = ref(HOME_PAGE_PATH)
  /** 菜单列表 */
  const menuList = ref<AppRouteRecord[]>([])
  /** 菜单宽度 */
  const menuWidth = ref('')
  /** 存储路由移除函数的数组 */
  const removeRouteFns = ref<(() => void)[]>([])

  /**
   * 设置菜单列表
   * @param list 菜单路由记录数组
   */
  const setMenuList = (list: AppRouteRecord[]) => {
    menuList.value = list
    setHomePath(HOME_PAGE_PATH || getFirstMenuPath(list))
  }

  /**
   * 获取首页路径
   * @returns 首页路径字符串
   */
  const getHomePath = () => homePath.value

  /**
   * 设置主页路径
   * @param path 主页路径
   */
  const setHomePath = (path: string) => {
    homePath.value = path
  }

  /**
   * 添加路由移除函数
   * @param fns 要添加的路由移除函数数组
   */
  const addRemoveRouteFns = (fns: (() => void)[]) => {
    removeRouteFns.value.push(...fns)
  }

  /**
   * 移除所有动态路由
   * 执行所有存储的路由移除函数并清空数组
   */
  const removeAllDynamicRoutes = () => {
    removeRouteFns.value.forEach((fn) => fn())
    removeRouteFns.value = []
  }

  /**
   * 清空路由移除函数数组
   */
  const clearRemoveRouteFns = () => {
    removeRouteFns.value = []
  }

  return {
    menuList,
    menuWidth,
    removeRouteFns,
    setMenuList,
    getHomePath,
    setHomePath,
    addRemoveRouteFns,
    removeAllDynamicRoutes,
    clearRemoveRouteFns
  }
})