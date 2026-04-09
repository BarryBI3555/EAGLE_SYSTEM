import { AppRouteRecord } from '@/types/router'

export const testRoutes: AppRouteRecord = {
    path: '/test',
    name: 'test',
    component: '/index/index',
    meta: {
        title: 'menus.test.title',
        icon: 'ri:test-tube-line',
        // roles: ['R_SUPER', 'R_ADMIN']
    },
    children: [
        {
            path: 'test1',
            name: 'test1',
            component: '/test/test1',
            meta: {
                title: 'menus.test.user',
                isHide: false,
                keepAlive: true,
                isHideTab: false
            }
        }
    ]
}
