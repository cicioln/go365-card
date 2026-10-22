<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { getPost } from '../api'
import type { Post } from '../data/mock'

const { t } = useI18n()
const route = useRoute()
const post = ref<Post | null>(null)
const loading = ref(true)

watchEffect(async () => {
  loading.value = true
  post.value = await getPost(String(route.params.slug))
  loading.value = false
})
</script>

<template>
  <article class="mx-auto max-w-3xl py-12">
    <p v-if="loading" class="py-16 text-center text-zinc-500">{{ t('common.loading') }}</p>
    <p v-else-if="!post" class="py-16 text-center text-zinc-500">{{ t('common.notFound') }}</p>
    <div v-else class="card p-8">
      <time class="text-xs text-zinc-500">{{ post.publishedAt }}</time>
      <h1 class="mt-1 text-3xl font-bold">{{ post.title }}</h1>
      <div class="prose-content mt-6" v-html="post.content" />
    </div>
  </article>
</template>
