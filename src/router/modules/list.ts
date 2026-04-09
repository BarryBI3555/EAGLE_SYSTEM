import { AppRouteRecord } from '@/types/router'

export const listRoutes: AppRouteRecord = {
  name: 'List',
  path: '/list',
  component: '/index/index',
  meta: {
    title: 'menus.list.title',
    icon: 'ri:file-list-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'index',
      name: 'ListIndex',
      component: '/dashboard/console',
      meta: {
        title: 'menus.list.title',
        keepAlive: false
      }
    }
  ]
}