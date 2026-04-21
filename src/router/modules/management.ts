import { AppRouteRecord } from '@/types/router'

export const managementRoutes: AppRouteRecord = {
  name: 'Management',
  path: '/management',
  component: '/index/index',
  meta: {
    title: 'menus.management.title',
    icon: 'ri:dashboard-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'index',
      name: 'ManagementIndex',
      component: '/test/test_index',
      meta: {
        title: 'menus.management.title',
        keepAlive: false
      }
    }
  ]
}