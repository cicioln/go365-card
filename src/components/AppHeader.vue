<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Search, ShoppingCart, ClipboardList, Moon, Sun, Languages, User, LogOut } from 'lucide-vue-next'
import { useCartStore } from '../stores/cart'
import { useAuthStore } from '../stores/auth'
import { useUiStore } from '../stores/ui'
import { save } from '../stores/storage'
import { useSiteStore } from '../stores/site'

const { t, locale } = useI18n()
const cart = useCartStore()
const auth = useAuthStore()
const db = useSiteStore()
const ui = useUiStore()
const router = useRouter()
const keyword = ref('')
const searchEl = ref<HTMLInputElement>()

const nav = [
  { to: '/', key: 'home' },
  { to: '/products', key: 'products' },
  { to: '/notice', key: 'notice' },
  { to: '/about', key: 'about' },
]

function toggleLocale() {
  locale.value = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  document.documentElement.lang = locale.value
  save('locale', locale.value)
}

async function logout() {
  await auth.logout()
  router.push('/')
}

function search() {
  const q = keyword.value.trim()
  router.push(q ? { path: '/products', query: { q } } : '/products')
  searchEl.value?.blur()
}

// 按 / 聚焦搜索框（输入框内不拦截）
function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  if (e.key !== '/' || el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
  e.preventDefault()
  searchEl.value?.focus()
}
onMounted(() => addEventListener('keydown', onKey))
onBeforeUnmount(() => removeEventListener('keydown', onKey))

const navLink = 'rounded-[9px] px-3 py-[7px] font-semibold text-ink-2 transition hover:bg-surface hover:text-ink'
const navOn = '!bg-surface !text-ink shadow-[inset_0_0_0_1px_var(--line)]'
const ib = 'relative grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] text-ink-2 transition hover:bg-surface hover:text-ink'
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-[14px]">
    <div class="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:gap-7">
      <RouterLink to="/" class="flex min-w-0 items-center gap-2.5 text-base font-extrabold tracking-[-0.01em]">
        <img :src="db.logo.src" alt="" class="h-[30px] w-[30px] shrink-0 rounded-[9px] object-contain" :class="{ 'dark:invert': !db.logo.custom }" />
        <span class="truncate">{{ db.site.siteName }}</span>
      </RouterLink>

      <nav class="hidden items-center gap-1 text-sm lg:flex" aria-label="Main">
        <RouterLink
          v-for="n in nav"
          :key="n.to"
          :to="n.to"
          :class="navLink"
          :exact-active-class="n.to === '/' ? navOn : ''"
          :active-class="n.to === '/' ? '' : navOn"
        >
          {{ t(`nav.${n.key}`) }}
        </RouterLink>
      </nav>

      <form
        class="ml-auto hidden h-[38px] max-w-[340px] flex-1 items-center gap-2 rounded-[11px] border border-line bg-surface px-3 text-ink-3 focus-within:border-ink-3 lg:flex"
        role="search"
        @submit.prevent="search"
      >
        <Search class="h-4 w-4 shrink-0" />
        <label for="hd-kw" class="sr-only">{{ t('product.search') }}</label>
        <input id="hd-kw" ref="searchEl" v-model="keyword" class="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3" :placeholder="t('nav.searchPh')" />
        <kbd class="rounded-[5px] border border-line-2 px-1.5 font-mono text-[11px]">/</kbd>
      </form>

      <div class="ml-auto flex shrink-0 items-center gap-1 lg:ml-0">
        <RouterLink to="/guest/orders" :class="ib" class="hidden md:grid" :title="t('nav.guestOrders')" :aria-label="t('nav.guestOrders')">
          <ClipboardList class="h-4 w-4" />
        </RouterLink>
        <RouterLink to="/cart" :class="ib" class="hidden md:grid" :title="t('nav.cart')" :aria-label="t('nav.cart')">
          <ShoppingCart class="h-4 w-4" />
          <em v-if="cart.count" class="absolute top-1 right-[3px] h-4 min-w-4 rounded-full bg-accent px-1 text-center font-mono text-[10px] leading-4 font-bold text-white not-italic">{{ cart.count }}</em>
        </RouterLink>
        <button :class="ib" :aria-label="ui.dark ? 'Light mode' : 'Dark mode'" :title="ui.dark ? 'Light mode' : 'Dark mode'" @click="ui.toggleTheme">
          <Sun v-if="ui.dark" class="h-4 w-4" /><Moon v-else class="h-4 w-4" />
        </button>
        <button class="flex h-[38px] shrink-0 items-center gap-1 rounded-[10px] px-2 text-xs font-bold text-ink-2 transition hover:bg-surface hover:text-ink" aria-label="Language" @click="toggleLocale">
          <Languages class="h-4 w-4" />{{ locale === 'zh-CN' ? '简' : 'EN' }}
        </button>
        <template v-if="auth.user">
          <RouterLink to="/me" :class="ib" :title="t('nav.me')" :aria-label="t('nav.me')"><User class="h-4 w-4" /></RouterLink>
          <button :class="ib" class="hidden md:grid" :title="t('nav.logout')" :aria-label="t('nav.logout')" @click="logout"><LogOut class="h-4 w-4" /></button>
        </template>
        <RouterLink v-else to="/auth/login" class="btn-ink ml-1.5 h-[34px] rounded-[10px] px-3 text-[13px]">{{ t('nav.login') }}</RouterLink>
      </div>
    </div>
  </header>
</template>
