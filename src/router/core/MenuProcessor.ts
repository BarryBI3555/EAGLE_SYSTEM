/**
 * 菜单处理器
 *
 * 负责菜单数据的获取、过滤和处理
 *
 * @module router/core/MenuProcessor
 * @author Art Design Pro Team
 */

import type { AppRouteRecord } from '@/types/router'
import { useUserStore } from '@/store/modules/user'
import { useAppMode } from '@/hooks/core/useAppMode'
import { fetchGetMenuList } from '@/api/system-manage'
import { asyncRoutes } from '../routes/asyncRoutes'
import { RoutesAlias } from '../routesAlias'
import { formatMenuTitle } from '@/utils'

export class MenuProcessor {
  /**
   * 获取菜单数据
   */
  async getMenuList(): Promise<AppRouteRecord[]> {
    const { isFrontendMode } = useAppMode()

    // console.log('[MenuProcessor] 当前应用模式:', isFrontendMode.value ? '前端模式' : '后端模式')
    
    let menuList: AppRouteRecord[]
    if (isFrontendMode.value) {
      // console.log('[MenuProcessor] 执行前端模式菜单处理')
      menuList = await this.processFrontendMenu()
    } else {
      // console.log('[MenuProcessor] 执行后端模式菜单处理')
      menuList = await this.processBackendMenu()
    }

    // console.log('[MenuProcessor] 处理后的菜单列表长度:', menuList.length)
    // console.log('[MenuProcessor] 处理后的菜单路径:', menuList.map(m => m.path))
    
    // 在规范化路径之前，验证原始路径配置
    this.validateMenuPaths(menuList)

    // 规范化路径（将相对路径转换为完整路径）
    return this.normalizeMenuPaths(menuList)
  }

  /**
   * 处理前端控制模式的菜单
   */
  private async processFrontendMenu(): Promise<AppRouteRecord[]> {
    const userStore = useUserStore()
    const roles = userStore.info?.roles

    // console.log('[MenuProcessor] 前端模式处理菜单，用户角色:', roles, '角色类型:', typeof roles, '角色长度:', roles?.length)
    // console.log('[MenuProcessor] 完整用户信息:', userStore.info)
    
    let menuList = [...asyncRoutes]

    // 根据角色过滤菜单
    if (roles && roles.length > 0) {
      // console.log('[MenuProcessor] 用户有角色，开始过滤菜单，角色列表:', roles)
      menuList = this.filterMenuByRoles(menuList, roles)
    } else {
      // console.log('[MenuProcessor] 用户没有角色或角色为空，返回所有菜单')
    }

    // console.log('[MenuProcessor] 过滤后菜单数量:', menuList.length)
    return this.filterEmptyMenus(menuList)
  }

  /**
   * 处理后端控制模式的菜单
   */
  private async processBackendMenu(): Promise<AppRouteRecord[]> {
    const list = await fetchGetMenuList()
    
    // 即使在后端模式下，也根据用户角色进行额外的前端过滤
    const userStore = useUserStore()
    const roles = userStore.info?.roles
    
    if (roles && roles.length > 0) {
      // console.log('[MenuProcessor] 后端模式下进行前端角色过滤，用户角色:', roles)
      return this.filterEmptyMenus(this.filterMenuByRoles(list, roles))
    }
    
    return this.filterEmptyMenus(list)
  }

  /**
   * 根据角色过滤菜单
   */
  private filterMenuByRoles(menu: AppRouteRecord[], roles: string[]): AppRouteRecord[] {
    // 添加调试日志
    // console.log('[MenuProcessor] 开始过滤菜单，用户角色:', roles)
    // console.log('[MenuProcessor] 原始菜单数量:', menu.length)
    
    const filtered = menu.reduce((acc: AppRouteRecord[], item) => {
      const itemRoles = item.meta?.roles
      
      // console.log('[MenuProcessor] 检查菜单项:', item.name, '路径:', item.path, '所需角色:', itemRoles)
      
      // 检查是否需要进行权限验证
      const hasPermission = this.checkPermission(itemRoles, roles)

      if (hasPermission) {
        // console.log('[MenuProcessor] 保留菜单项:', item.name)
        const filteredItem = { ...item }
        if (filteredItem.children && filteredItem.children.length > 0) {
          filteredItem.children = this.filterMenuByRoles(filteredItem.children, roles)
          // 如果子菜单经过过滤后还有内容，则保留该项
          if (filteredItem.children.length > 0) {
            acc.push(filteredItem)
          } else {
            // 如果子菜单被过滤后为空，但该项目本身不需要特定角色，则仍可保留
            if (!itemRoles || itemRoles.length === 0) {
              // 创建不带children的副本，避免空children
              const itemWithoutEmptyChildren = { ...filteredItem }
              delete itemWithoutEmptyChildren.children
              acc.push(itemWithoutEmptyChildren)
            } else {
              acc.push(filteredItem)
            }
          }
        } else {
          acc.push(filteredItem)
        }
      } else {
        // console.log('[MenuProcessor] 过滤掉菜单项:', item.name, '所需角色:', itemRoles, '用户角色:', roles)
      }

      return acc
    }, [])
    
    // console.log('[MenuProcessor] 过滤后菜单数量:', filtered.length)
    // console.log('[MenuProcessor] 过滤后菜单路径列表:', filtered.map(item => ({ name: item.name, path: item.path })))
    return filtered
  }

  /**
   * 检查用户是否有权限访问指定菜单项
   * @param itemRoles 菜单项所需角色
   * @param userRoles 用户拥有的角色
   * @returns 是否有权限
   */
  private checkPermission(itemRoles: string[] | undefined, userRoles: string[]): boolean {
    // 如果菜单项没有设置角色要求，或者用户没有角色，允许访问
    if (!itemRoles || itemRoles.length === 0) {
      // console.log('[MenuProcessor] 菜单项无角色要求，允许访问')
      return true
    }
    
    // 如果用户没有任何角色，拒绝访问需要特定角色的菜单项
    if (!userRoles || userRoles.length === 0) {
      console.warn('[MenuProcessor] 用户没有分配任何角色')
      return false
    }
    
    // console.log('[MenuProcessor] 检查权限:', { requiredRoles: itemRoles, userRoles })
    
    // 检查用户角色是否包含菜单项所需的任一角色
    const hasPermission = itemRoles.some((role) => {
      const roleExists = userRoles.includes(role);
      // console.log(`[MenuProcessor] 角色检查: 需要 '${role}', 用户拥有:`, userRoles, '结果:', roleExists);
      return roleExists;
    });
    
    // console.log('[MenuProcessor] 权限检查结果:', { requiredRoles: itemRoles, userRoles, hasPermission })
    
    return hasPermission
  }

  /**
   * 递归过滤空菜单项
   */
  private filterEmptyMenus(menuList: AppRouteRecord[]): AppRouteRecord[] {
    return menuList
      .map((item) => {
        // 如果有子菜单，先递归过滤子菜单
        if (item.children && item.children.length > 0) {
          const filteredChildren = this.filterEmptyMenus(item.children)
          return {
            ...item,
            children: filteredChildren
          }
        }
        return item
      })
      .filter((item) => {
        // 如果定义了 children 属性（即使是空数组），说明这是一个目录菜单，应该保留
        if ('children' in item) {
          return true
        }

        // 如果有外链或 iframe，保留
        if (item.meta?.isIframe === true || item.meta?.link) {
          return true
        }

        // 如果有有效的 component，保留
        if (item.component && item.component !== '' && item.component !== RoutesAlias.Layout) {
          return true
        }

        // 其他情况过滤掉
        return false
      })
  }

  /**
   * 验证菜单列表是否有效
   */
  validateMenuList(menuList: AppRouteRecord[]): boolean {
    return Array.isArray(menuList) && menuList.length > 0
  }

  /**
   * 规范化菜单路径
   * 将相对路径转换为完整路径，确保菜单跳转正确
   */
  private normalizeMenuPaths(menuList: AppRouteRecord[], parentPath = ''): AppRouteRecord[] {
    return menuList.map((item) => {
      // 构建完整路径
      const fullPath = this.buildFullPath(item.path || '', parentPath)

      // 递归处理子菜单
      const children = item.children?.length
        ? this.normalizeMenuPaths(item.children, fullPath)
        : item.children

      return {
        ...item,
        path: fullPath,
        children
      }
    })
  }

  /**
   * 验证菜单路径配置
   * 检测非一级菜单是否错误使用了 / 开头的路径
   */
  /**
   * 验证菜单路径配置
   * 检测非一级菜单是否错误使用了 / 开头的路径
   */
  private validateMenuPaths(menuList: AppRouteRecord[], level = 1): void {
    menuList.forEach((route) => {
      if (!route.children?.length) return

      const parentName = String(route.name || route.path || '未知路由')

      route.children.forEach((child) => {
        const childPath = child.path || ''

        // 跳过合法的绝对路径：外部链接和 iframe 路由
        if (this.isValidAbsolutePath(childPath)) return

        // 检测非法的绝对路径
        if (childPath.startsWith('/')) {
          this.logPathError(child, childPath, parentName, level)
        }
      })

      // 递归检查更深层级的子路由
      this.validateMenuPaths(route.children, level + 1)
    })
  }

  /**
   * 判断是否为合法的绝对路径
   */
  private isValidAbsolutePath(path: string): boolean {
    return (
      path.startsWith('http://') ||
      path.startsWith('https://') ||
      path.startsWith('/outside/iframe/')
    )
  }

  /**
   * 输出路径配置错误日志
   */
  private logPathError(
    route: AppRouteRecord,
    path: string,
    parentName: string,
    level: number
  ): void {
    const routeName = String(route.name || path || '未知路由')
    const menuTitle = route.meta?.title || routeName
    const suggestedPath = path.split('/').pop() || path.slice(1)

    console.error(
      `[路由配置错误] 菜单 "${formatMenuTitle(menuTitle)}" (name: ${routeName}, path: ${path}) 配置错误\n` +
        `  位置: ${parentName} > ${routeName}\n` +
        `  问题: ${level + 1}级菜单的 path 不能以 / 开头\n` +
        `  当前配置: path: '${path}'\n` +
        `  应该改为: path: '${suggestedPath}'`
    )
  }

  /**
   * 构建完整路径
   */
  private buildFullPath(path: string, parentPath: string): string {
    if (!path) return ''

    // 外部链接直接返回
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }

    // 如果已经是绝对路径，直接返回
    if (path.startsWith('/')) {
      return path
    }

    // 拼接父路径和当前路径
    if (parentPath) {
      // 移除父路径末尾的斜杠，移除子路径开头的斜杠，然后拼接
      const cleanParent = parentPath.replace(/\/$/, '')
      const cleanChild = path.replace(/^\//, '')
      return `${cleanParent}/${cleanChild}`
    }

    // 没有父路径，添加前导斜杠
    return `/${path}`
  }
}