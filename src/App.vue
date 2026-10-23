<script setup lang="ts">
import { computed, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from './stores/ui'
import { useSiteStore } from './stores/site'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import TabBar from './components/TabBar.vue'
import { resolveMeta } from './utils/seo'

const ui = useUiStore()
const route = useRoute()
const blank = computed(() => route.meta.layout === 'blank')
// 商品详情页底部是固定购买栏，不显示 Tab 栏
const tabbar = computed(() => !route.path.startsWith('/products/'))

// 浏览器标签标题与 meta 描述、关键词跟随后台 SEO 设置
const db = useSiteStore()
// 离开详情页时清掉详情标题
watch(() => route.path, () => (db.detail = null))

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!content) return el?.remove()
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

watchEffect(() => {
  const name = db.site.siteName
  if (route.path.startsWith('/admin')) {
    const page = route.meta.title as string | undefined
    document.title = `${page ? page + ' - ' : ''}${name} 后台`
    return
  }
  const meta = resolveMeta(db.site, route.path, db.detail)
  document.title = meta.title
  setMeta('name', 'description', meta.description)
  setMeta('name', 'keywords', meta.keywords)
  setMeta('name', 'robots', meta.noindex ? 'noindex' : '')
  setMeta('property', 'og:title', meta.title)
  setMeta('property', 'og:description', meta.description)
})

// 浏览器标签图标：优先后台设置的图标，其次 Logo，最后默认 Logo
watchEffect(() => {
  const href = db.site.favicon || db.logo.src
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  if (link.getAttribute('href') === href) return
  link.removeAttribute('type')
  link.href = href
})
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <RouterView v-if="blank" />
    <template v-else>
      <AppHeader />
      <main class="mx-auto w-full max-w-[1240px] flex-1 px-4 sm:px-6">
        <RouterView />
      </main>
      <AppFooter class="mb-[72px] md:mb-0" />
      <TabBar v-if="tabbar" />
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
        class="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap text-paper shadow-[0_10px_30px_-10px_rgb(0_0_0/40%)] md:bottom-7"
      >
        {{ ui.toast.text }}
      </div>
    </Transition>
  </div>
</template>
