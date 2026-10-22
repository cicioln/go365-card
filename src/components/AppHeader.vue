<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Home, LayoutGrid, Bell, Info, ShoppingCart, ClipboardList, LogIn, Moon, Sun, Languages, Menu, X, User, LogOut,
} from 'lucide-vue-next'
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
const open = ref(false)

const nav = [
  { to: '/', key: 'home', icon: Home },
  { to: '/products', key: 'products', icon: LayoutGrid },
  { to: '/notice', key: 'notice', icon: Bell },
  { to: '/about', key: 'about', icon: Info },
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

const link =
  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-zinc-600 transition hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10'
const active = '!bg-brand-soft !text-brand dark:!bg-brand/20'
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-black/5 bg-white/85 backdrop-blur dark:border-white/10 dark:bg-zinc-950/85">
    <div class="mx-auto flex h-16 max-w-[1280px] items-center gap-2 px-4 sm:gap-4">
      <RouterLink
        to="/"
        class="flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1.5 font-bold tracking-tight transition hover:bg-black/5 dark:hover:bg-white/10"
      >
        <img :src="db.logo.src" alt="" class="h-7 w-7 shrink-0 rounded-md object-contain" :class="{ 'dark:invert': !db.logo.custom }" />
        <span class="truncate">{{ db.site.siteName }}</span>
      </RouterLink>

      <nav class="mx-auto hidden items-center gap-1 lg:flex" aria-label="Main">
        <RouterLink
          v-for="n in nav"
          :key="n.to"
          :to="n.to"
          :class="link"
          :exact-active-class="n.to === '/' ? active : ''"
          :active-class="n.to === '/' ? '' : active"
        >
          <component :is="n.icon" class="h-4 w-4" />{{ t(`nav.${n.key}`) }}
        </RouterLink>
      </nav>

      <div class="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 lg:ml-0">
        <RouterLink to="/cart" :class="link" :active-class="active" class="relative">
          <ShoppingCart class="h-4 w-4" />
          <span class="hidden sm:inline">{{ t('nav.cart') }}</span>
          <span
            v-if="cart.count"
            class="absolute -top-1 left-5 rounded-full bg-price px-1.5 text-[10px] font-bold leading-4 text-white"
          >{{ cart.count }}</span>
        </RouterLink>
        <RouterLink to="/guest/orders" :class="link" :active-class="active" class="hidden md:flex">
          <ClipboardList class="h-4 w-4" />{{ t('nav.guestOrders') }}
        </RouterLink>
        <template v-if="auth.user">
          <RouterLink to="/me" :class="link" :active-class="active" class="hidden md:flex">
            <User class="h-4 w-4" />{{ t('nav.me') }}
          </RouterLink>
          <button :class="link" class="hidden md:flex" @click="logout">
            <LogOut class="h-4 w-4" />{{ t('nav.logout') }}
          </button>
        </template>
        <RouterLink v-else to="/auth/login" :class="link" :active-class="active" class="hidden md:flex">
          <LogIn class="h-4 w-4" />{{ t('nav.login') }}
        </RouterLink>
        <button :class="link" :aria-label="ui.dark ? 'Light mode' : 'Dark mode'" @click="ui.toggleTheme">
          <Sun v-if="ui.dark" class="h-4 w-4" /><Moon v-else class="h-4 w-4" />
        </button>
        <button :class="link" aria-label="Language" @click="toggleLocale">
          <Languages class="h-4 w-4" />{{ locale === 'zh-CN' ? '简' : 'EN' }}
        </button>
        <button :class="link" class="lg:hidden" :aria-expanded="open" aria-label="Menu" @click="open = !open">
          <X v-if="open" class="h-5 w-5" /><Menu v-else class="h-5 w-5" />
        </button>
      </div>
    </div>

    <nav v-if="open" class="border-t border-black/5 px-4 py-2 lg:hidden dark:border-white/10" @click="open = false">
      <RouterLink v-for="n in nav" :key="n.to" :to="n.to" :class="link" class="py-2.5">
        <component :is="n.icon" class="h-4 w-4" />{{ t(`nav.${n.key}`) }}
      </RouterLink>
      <RouterLink to="/guest/orders" :class="link" class="py-2.5"><ClipboardList class="h-4 w-4" />{{ t('nav.guestOrders') }}</RouterLink>
      <template v-if="auth.user">
        <RouterLink to="/me" :class="link" class="py-2.5"><User class="h-4 w-4" />{{ t('nav.me') }}</RouterLink>
        <button :class="link" class="w-full py-2.5" @click="logout"><LogOut class="h-4 w-4" />{{ t('nav.logout') }}</button>
      </template>
      <RouterLink v-else to="/auth/login" :class="link" class="py-2.5"><LogIn class="h-4 w-4" />{{ t('nav.login') }}</RouterLink>
    </nav>
  </header>
</template>
