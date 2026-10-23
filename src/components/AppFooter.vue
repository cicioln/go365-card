<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSiteStore } from '../stores/site'

const { t } = useI18n()
const db = useSiteStore()
const links = [
  { to: '/notice', key: 'notice' },
  { to: '/about', key: 'about' },
  { to: '/guest/orders', key: 'guestOrders' },
]
</script>

<template>
  <footer class="mt-16 border-t border-line">
    <div class="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-3 px-4 py-6 text-[12.5px] text-ink-3 sm:h-[72px] sm:flex-row sm:px-6 sm:py-0">
      <span>© {{ new Date().getFullYear() }} {{ db.site.siteName }}</span>
      <nav class="flex flex-wrap justify-center gap-5" aria-label="Footer">
        <RouterLink v-for="l in links" :key="l.to" :to="l.to" class="transition hover:text-ink">{{ t(`nav.${l.key}`) }}</RouterLink>
        <a v-if="db.site.telegram" :href="db.site.telegram" target="_blank" rel="noopener" class="transition hover:text-ink">Telegram</a>
      </nav>
    </div>
  </footer>
</template>
