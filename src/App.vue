<template>
  <ElConfigProvider size="default" :locale="locales[language]" :z-index="3000">
    <RouterView></RouterView>
  </ElConfigProvider>
</template>

<script setup lang="ts">
  import { useUserStore } from './store/modules/user'
  import zh from 'element-plus/es/locale/lang/zh-cn'
  import en from 'element-plus/es/locale/lang/en'
  import { systemUpgrade } from './utils/sys'
  import { toggleTransition } from './utils/ui/animation'
  import { checkStorageCompatibility } from './utils/storage'
  import { initializeTheme } from './hooks/core/useTheme'
import { AnyARecord } from 'dns'

  const userStore = useUserStore()
  const { language } = storeToRefs(userStore)

  const locales = {
    zh: zh,
    en: en
  }

  onBeforeMount(() => {
    toggleTransition(true)
    initializeTheme()
  })

  onMounted(() => {
    checkStorageCompatibility()
    toggleTransition(false)
    systemUpgrade()
  })


  const debounce = (fn:any, delay: any) => {
  let timer: any = null;

   return function (this: any) {
    let context = this;
    let args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(context, args);
 
    }, delay);
  }
}
 
const _ResizeObserver = window.ResizeObserver;
window.ResizeObserver = class ResizeObserver extends _ResizeObserver {
  constructor(callback: any) {
    callback = debounce(callback, 16);
    super(callback);
  }
}
  

</script>
