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
    // // 运营效率
    // {
    //   path: 'personnel',
    //   name: 'Personnel',
    //   component: '/dashboard/personnel',
    //   meta: {
    //     title: 'menus.efficiency.personnel',
    //     keepAlive: false
    //   }
    // },
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
            // ====================== gzl_ss 工作量通报 ======================
            {
              path: 'gzl_bm',
              name: 'CurGzlBm',
              component: '/efficiency/daily/periodic/table_cur_gzl_bm',
              meta: {
                title: '部门当日工作量统计',
                keepAlive: false
              }
            },
            {
              path: 'gzl_group',
              name: 'CurGzlGroup',
              component: '/efficiency/daily/periodic/table_cur_gzl_group',
              meta: {
                title: '小组当日工作量统计',
                keepAlive: false
              }
            },
            // ====================================================================
            {
              path: 'cur_gzl_ry',
              name: 'CurGzlRy',
              component: '/efficiency/daily/periodic/table_cur_gzl_ry',
              meta: {
                title: '人员当日工作量统计',
                keepAlive: false
              }
            },
            {
              path: 'cur_gzl_rs',
              name: 'CurGzlRs',
              component: '/efficiency/daily/periodic/table_cur_gzl_rs',
              meta: {
                title: '人伤当日工作量统计',
                keepAlive: false
              }
            }
          ]
        }
      ]
    }
  ]
}