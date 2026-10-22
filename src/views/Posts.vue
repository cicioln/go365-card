<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPosts } from '../api'
import type { Post } from '../data/mock'

const props = defineProps<{ type: 'blog' | 'notice' }>()
const { t } = useI18n()
const list = ref<Post[] | null>(null)

watchEffect(async () => {
  list.value = null
  list.value = await getPosts(props.type)
})
</script>

<template>
  <div class="mx-auto max-w-4xl py-12">
    <h1 class="text-center text-4xl font-black">{{ t(`posts.${type}`) }}</h1>
    <p v-if="!list" class="py-16 text-center text-zinc-500">{{ t('common.loading') }}</p>
    <p v-else-if="!list.length" class="py-16 text-center text-zinc-500">{{ t('posts.empty') }}</p>
    <div v-else class="mt-10 grid gap-5">
      <RouterLink v-for="p in list" :key="p.id" :to="`/posts/${p.slug}`" class="card block p-6 transition hover:shadow-md">
        <time class="text-xs text-zinc-500">{{ p.publishedAt }}</time>
        <h2 class="mt-1 text-xl font-bold">{{ p.title }}</h2>
        <p v-if="p.summary" class="mt-2 text-sm text-zinc-500">{{ p.summary }}</p>
      </RouterLink>
    </div>
  </div>
</template>
