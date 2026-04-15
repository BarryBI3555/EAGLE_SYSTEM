import App from './App.vue'
import { createApp } from 'vue'
import { initStore } from './store'                 // Store
import { initRouter } from './router'               // Router
import language from './locales'                    // 国际化
import '@styles/core/tailwind.css'                  // tailwind
import '@styles/index.scss'                         // 样式
//import '@utils/sys/console.ts'                      // 控制台输出内容
import { setupGlobDirectives } from './directives'
import { setupErrorHandle } from './utils/sys/error-handle'
import { GlobalAutoRefresh } from './plugins/globalAutoRefresh'
import "@utils/ui/iconify-loader";

document.addEventListener(
  'touchstart',
  function () {},
  { passive: false }
)




const app = createApp(App)

initStore(app)
initRouter(app)
setupGlobDirectives(app)
setupErrorHandle(app)
app.use(GlobalAutoRefresh, {
  interval: 30,//30分钟刷新一次
  enabled: true,
  // callback: () => {
  //   console.log('自动刷新操作');
  // }
})
// app.use(store)
// app.use(router)
app.use(language)

app.mount('#app')
