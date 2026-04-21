import { AppRouteRecord } from '@/types/router'

export const complaintRoutes: AppRouteRecord = {
  name: 'Complaint',
  path: '/complaint',
  component: '/index/index',
  meta: {
    title: 'menus.complaint.title',
    icon: 'ri:message-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'index',
      name: 'ComplaintIndex',
      component: '/test/test_index',
      meta: {
        title: 'menus.complaint.title',
        keepAlive: false
      }
    }
  ]
}