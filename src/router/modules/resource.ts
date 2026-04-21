import { AppRouteRecord } from '@/types/router'

export const resourceRoutes: AppRouteRecord = {
  name: 'Resource',
  path: '/resource',
  component: '/index/index',
  meta: {
    title: 'menus.resource.title',
    icon: 'ri:database-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'index',
      name: 'ResourceIndex',
      component: '/test/test_index',
      meta: {
        title: 'menus.resource.title',
        keepAlive: false
      }
    }
  ]
}