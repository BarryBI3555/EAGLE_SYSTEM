import { AppRouteRecord } from '@/types/router'

export const profileRoutes: AppRouteRecord = {
  name: 'Profile',
  path: '/profile',
  component: '/index/index',
  meta: {
    title: 'menus.profile.title',
    icon: 'ri:user-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'index',
      name: 'ProfileIndex',
      component: '/dashboard/personnel',
      meta: {
        title: 'menus.profile.title',
        keepAlive: false
      }
    }
  ]
}