<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSiteStore } from '../stores/site'

defineProps<{ page: 'about' | 'privacy' | 'terms' | '404' }>()
const { t } = useI18n()
const db = useSiteStore()
</script>

<template>
  <div class="mx-auto max-w-3xl py-16">
    <div v-if="page === '404'" class="text-center">
      <p class="text-7xl font-black text-brand">404</p>
      <p class="mt-4 text-zinc-500">{{ t('common.notFound') }}</p>
      <RouterLink to="/" class="btn-primary mt-8">{{ t('auth.backHome') }}</RouterLink>
    </div>
    <div v-else class="card p-8">
      <h1 class="text-3xl font-bold">{{ page === 'about' ? t('about.title') : t(`legal.${page}`) }}</h1>
      <p class="mt-6 leading-relaxed text-zinc-600 dark:text-zinc-300">{{ page === 'about' ? t('about.body', { site: db.site.siteName }) : t('legal.body') }}</p>
    </div>
  </div>
</template>
