<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Home, ShoppingBag, Newspaper, Info, Send, MessageCircle } from 'lucide-vue-next'
import { useSiteStore } from '../stores/site'

const { t } = useI18n()
const db = useSiteStore()
const links = [
  { to: '/', key: 'home', icon: Home },
  { to: '/products', key: 'products', icon: ShoppingBag },
  { to: '/blog', key: 'blog', icon: Newspaper },
  { to: '/about', key: 'about', icon: Info },
]
</script>

<template>
  <footer class="mt-20 border-t border-black/5 bg-white py-14 dark:border-white/10 dark:bg-zinc-950">
    <div class="mx-auto max-w-[1100px] px-4">
      <div class="flex items-center gap-4">
        <img src="/logo.svg" alt="" class="h-14 w-14 sm:h-20 sm:w-20 dark:invert" />
        <h2 class="text-4xl font-bold tracking-tight sm:text-6xl">{{ db.site.siteName }}</h2>
      </div>
      <p class="mt-4 text-zinc-500">{{ db.site.description }}</p>

      <div class="mt-12 grid gap-10 sm:grid-cols-2">
        <div>
          <h3 class="mb-4 text-lg font-bold">{{ t('footer.quick') }}</h3>
          <nav aria-label="Footer" class="flex flex-col gap-3">
            <RouterLink
              v-for="l in links"
              :key="l.to"
              :to="l.to"
              class="flex items-center gap-3 text-zinc-500 transition hover:text-zinc-900 dark:hover:text-white"
            >
              <component :is="l.icon" class="h-4 w-4" />{{ t(`nav.${l.key}`) }}
            </RouterLink>
          </nav>
        </div>
        <div>
          <h3 class="mb-4 text-lg font-bold">{{ t('footer.tg') }}</h3>
          <a :href="db.site.telegram" target="_blank" rel="noopener" class="btn-ghost px-4 py-3">
            <Send class="h-5 w-5 text-sky-500" />{{ t('footer.tg') }}
          </a>
          <div class="mt-4 flex gap-3 text-zinc-500">
            <a href="#" aria-label="WhatsApp" class="hover:text-zinc-900 dark:hover:text-white"><MessageCircle class="h-5 w-5" /></a>
          </div>
        </div>
      </div>

      <div class="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-6 text-xs text-zinc-500 dark:border-white/10">
        <p>© 2026 {{ db.site.siteName }}. {{ t('footer.rights') }}</p>
        <div class="flex gap-4">
          <RouterLink to="/privacy" class="hover:text-zinc-900 dark:hover:text-white">{{ t('footer.privacy') }}</RouterLink>
          <RouterLink to="/terms" class="hover:text-zinc-900 dark:hover:text-white">{{ t('footer.terms') }}</RouterLink>
          <RouterLink to="/admin" class="hover:text-zinc-900 dark:hover:text-white">Admin</RouterLink>
        </div>
      </div>
    </div>
  </footer>
</template>
