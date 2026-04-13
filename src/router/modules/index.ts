import {AppRouteRecord} from '@/types/router'
import {dashboardRoutes} from './dashboard'
import {managementRoutes} from './management'
import {costRoutes} from './cost'
import {efficiencyRoutes} from './efficiency'
import {complaintRoutes} from './complaint'
import {resourceRoutes} from './resource'
import {profileRoutes} from './profile'
import {listRoutes} from './list'
import { indicatorRoutes } from './indicator'
import { dataTableRoutes } from './datatable'

// import { testRoutes } from './test'
/**
 * 导出所有模块化路由
 */
export const routeModules: AppRouteRecord[] = [
    
    dashboardRoutes,
    managementRoutes,
    costRoutes,
    efficiencyRoutes,
    complaintRoutes,
    resourceRoutes,
    profileRoutes,
    listRoutes,
    // indicatorRoutes,
    dataTableRoutes,
    // testRoutes
]
