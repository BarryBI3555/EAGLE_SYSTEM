import { AppRouteRecord } from '@/types/router'

export const dashboardRoutes: AppRouteRecord = {
  name: 'Dashboard',
  path: '/dashboard',
  component: '/index/index',
  meta: {
    title: 'menus.dashboard.title',
    icon: 'ri:pie-chart-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'personalmap',
      name: 'PersonalMap',
      component: '/dashboard/personalmap',
      meta: {
        title: 'menus.dashboard.personalmap',
        keepAlive: false,
        fixedTab: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'hotmap',
      name: 'HotMap',
      component: '/dashboard/hotmap',
      meta: {
        title: 'menus.dashboard.hotmap',
        keepAlive: false
      }
    },
  ]
}
