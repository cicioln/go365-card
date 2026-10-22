<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from './stores/ui'
import { useSiteStore } from './stores/site'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'

const ui = useUiStore()
const route = useRoute()
const blank = computed(() => route.meta.layout === 'blank')

// 浏览器标签标题与 meta 描述跟随站点设置
const db = useSiteStore()
watchEffect(() => {
  const name = db.site.siteName || 'Go365 Card'
  const page = route.meta.title as string | undefined
  if (route.path.startsWith('/admin')) document.title = `${page ? page + ' - ' : ''}${name} 后台`
  else document.title = page ? `${page} - ${name}` : name
  document.querySelector('meta[name="description"]')?.setAttribute('content', db.site.description || name)
})
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <RouterView v-if="blank" />
    <template v-else>
      <AppHeader />
      <main class="mx-auto w-full max-w-[1280px] flex-1 px-4">
        <RouterView />
      </main>
      <AppFooter />
    </template>
    <Transition
      enter-from-class="opacity-0 translate-y-2"
      leave-to-class="opacity-0"
      enter-active-class="transition"
      leave-active-class="transition"
    >
      <div
        v-if="ui.toast"
        :key="ui.toast.id"
        role="status"
        class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-white dark:text-zinc-900"
      >
        {{ ui.toast.text }}
      </div>
    </Transition>
  </div>
</template>
