<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Send } from 'lucide-vue-next'
import { useSiteStore } from '../stores/site'

const { t } = useI18n()
const db = useSiteStore()
const links = [
  { to: '/', key: 'home' },
  { to: '/products', key: 'products' },
  { to: '/notice', key: 'notice' },
  { to: '/about', key: 'about' },
  { to: '/guest/orders', key: 'guestOrders' },
]
</script>

<template>
  <footer class="mt-20 border-t border-black/5 bg-white dark:border-white/10 dark:bg-zinc-950">
    <div class="mx-auto max-w-[1280px] px-4 py-10">
      <div class="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div class="max-w-sm">
          <div class="flex items-center gap-2.5">
            <img :src="db.logo.src" alt="" class="h-8 w-8 rounded-md object-contain" :class="{ 'dark:invert': !db.logo.custom }" />
            <span class="text-lg font-bold">{{ db.site.siteName }}</span>
          </div>
          <p v-if="db.site.description" class="mt-3 text-sm leading-relaxed text-zinc-500">{{ db.site.description }}</p>
          <a
            v-if="db.site.telegram"
            :href="db.site.telegram"
            target="_blank"
            rel="noopener"
            class="btn-ghost mt-4"
          >
            <Send class="h-4 w-4 text-sky-500" />{{ t('footer.tg') }}
          </a>
        </div>
        <nav aria-label="Footer">
          <h2 class="mb-3 text-sm font-bold">{{ t('footer.quick') }}</h2>
          <ul class="grid grid-cols-3 gap-x-8 gap-y-2 text-sm text-zinc-500 sm:grid-cols-3">
            <li v-for="l in links" :key="l.to">
              <RouterLink :to="l.to" class="transition hover:text-zinc-900 dark:hover:text-white">{{ t(`nav.${l.key}`) }}</RouterLink>
            </li>
          </ul>
        </nav>
      </div>

      <div class="mt-8 border-t border-black/5 pt-6 text-xs text-zinc-500 dark:border-white/10">
        <p>© {{ new Date().getFullYear() }} {{ db.site.siteName }}. {{ t('footer.rights') }}</p>
      </div>
    </div>
  </footer>
</template>
