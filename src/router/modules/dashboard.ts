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
      path: 'console',
      name: 'Console',
      component: '/dashboard/console',
      meta: {
        title: 'menus.dashboard.console',
        keepAlive: false,
        fixedTab: true
      }
    },
    {
      path: 'personnel',
      name: 'Personnel',
      component: '/dashboard/personnel',
      meta: {
        title: 'menus.dashboard.personnel',
        keepAlive: false
      }
    },
    {
      path: 'cases',
      name: 'Cases',
      component: '/dashboard/cases',
      meta: {
        title: 'menus.dashboard.cases',
        keepAlive: false
      }
    },
    {
      path: 'category',
      name: 'Category',
      component: '/dashboard/category',
      meta: {
        title: 'menus.dashboard.category',
        keepAlive: false
      }
    }
  ]
}
