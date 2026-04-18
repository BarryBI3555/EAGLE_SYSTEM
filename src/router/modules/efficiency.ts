import { AppRouteRecord } from '@/types/router'

export const efficiencyRoutes: AppRouteRecord = {
  name: 'Efficiency',
  path: '/efficiency',
  component: '/index/index',
  meta: {
    title: 'menus.efficiency.title',
    icon: 'ri:time-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    // 运营效率
    {
      path: 'personnel',
      name: 'Personnel',
      component: '/dashboard/personnel',
      meta: {
        title: 'menus.efficiency.personnel',
        keepAlive: false
      }
    },
    // 日常通报
    {
      path: 'daily',
      name: 'DailyReport',
      meta: {
        title: 'menus.efficiency.daily.title',
        keepAlive: false
      },
      children: [
        // 周期通报
        {
          path: 'periodic',
          name: 'PeriodicReport',
          meta: {
            title: 'menus.efficiency.daily.periodic',
            keepAlive: false
          },
          children: [
            // 周期通报详情
            // {
            //   path: 'sichuan',
            //   name: 'SichuanPeriodic',
            //   component: '/efficiency/daily/periodic/table_cur_gzl',
            //   meta: {
            //     title: '四川省周期通报',
            //     keepAlive: false
            //   }
            // },
            // // ====================== 你的 gzl_ss 工作量通报 ======================
            // {
            //   path: 'gzl',
            //   name: 'SichuanGzl',
            //   component: '/efficiency/daily/periodic/table_cur_gzl',
            //   meta: {
            //     title: '四川省工作量通报',
            //     keepAlive: false
            //   }
            // },
            // ====================================================================
            {
              path: 'cur_gzl',
              name: 'CurGzl',
              component: '/efficiency/daily/periodic/table_cur_gzl_ry',
              meta: {
                title: '人员当日工作量统计',
                keepAlive: false
              }
            }
          ]
        }
      ]
    }
  ]
}