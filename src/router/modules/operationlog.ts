import { AppRouteRecord } from '@/types/router'

export const operationLogRoutes: AppRouteRecord = {
    name:'OperationLog',
    path:'/operationLog',
    component:'/index/index',
    meta:{
        title:'menus.operationlog.title',
        icon:'material-symbols-light:document-scanner-outline',
        roles: ['R_SUPER']
    },
    children:[
        {
            path:'table',
            name:'OperationLogTable',
            component:'/operationLog/OperationLogTable',
            meta:{
                title:'menus.operationlog.subtitle',
                keepAlive: false,
                roles: ['R_SUPER']
            }
        }
    ]
}