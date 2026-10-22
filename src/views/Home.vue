<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Bell, ChevronRight, X, Search, Send, LayoutGrid } from 'lucide-vue-next'
import { getCategories, getPosts, getProducts } from '../api'
import { useSiteStore } from '../stores/site'
import type { Category, Post, Product } from '../data/mock'
import ProductCard from '../components/ProductCard.vue'
import SkeletonCard from '../components/SkeletonCard.vue'

const { t } = useI18n()
const router = useRouter()
const db = useSiteStore()
const categories = ref<Category[]>([])
const products = ref<Product[]>([])
const posts = ref<Post[]>([])
const loading = ref(true)
const activeCat = ref<number | null>(null)
const showNotice = ref(true)

const notice = computed(() => posts.value.find((p) => p.type === 'notice'))
const filtered = computed(() =>
  activeCat.value ? products.value.filter((p) => p.categoryId === activeCat.value) : products.value,
)

onMounted(async () => {
  ;[categories.value, products.value, posts.value] = await Promise.all([getCategories(), getProducts(), getPosts()])
  loading.value = false
})

const pill =
  'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition'
</script>

<template>
  <section class="pt-6">
    <!-- 公告 + 快捷入口 -->
    <div v-if="showNotice && notice" class="card flex flex-col gap-4 p-6 md:flex-row">
      <div class="flex-1 cursor-pointer" @click="router.push(`/posts/${notice.slug}`)">
        <div class="flex items-center gap-2">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-brand/20">
            <Bell class="h-4 w-4" />
          </span>
          <h2 class="text-lg font-bold">{{ t('home.notice') }}</h2>
          <span class="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand dark:bg-brand/20">NEW</span>
          <RouterLink :to="`/posts/${notice.slug}`" class="ml-auto flex items-center text-sm font-semibold text-brand" @click.stop>
            {{ t('home.detail') }}<ChevronRight class="h-4 w-4" />
          </RouterLink>
          <button
            class="ml-2 rounded-lg p-1.5 text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"
            :aria-label="t('common.close')"
            @click.stop="showNotice = false"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
        <div class="prose-content mt-3 font-medium" v-html="notice.content" />
      </div>
      <div class="flex flex-col gap-3 md:w-[240px] md:border-l md:border-black/5 md:pl-4 dark:md:border-white/10">
        <button class="btn-ghost justify-start py-3" @click="router.push('/guest/orders')">
          <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand dark:bg-brand/20"><Search class="h-4 w-4" /></span>
          <span class="text-left"><span class="block text-sm font-bold">{{ t('home.selfQuery') }}</span><span class="block text-xs text-zinc-500">{{ t('home.noLogin') }}</span></span>
          <ChevronRight class="ml-auto h-4 w-4 text-zinc-400" />
        </button>
        <a v-if="db.site.telegram" :href="db.site.telegram" target="_blank" rel="noopener" class="btn-ghost justify-start py-3">
          <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-500 dark:bg-sky-500/15"><Send class="h-4 w-4" /></span>
          <span class="text-left"><span class="block text-sm font-bold">{{ t('home.tg') }}</span><span class="block text-xs text-zinc-500">{{ t('home.official') }}</span></span>
          <ChevronRight class="ml-auto h-4 w-4 text-zinc-400" />
        </a>
      </div>
    </div>

    <!-- 分类 -->
    <div class="mt-4 flex flex-wrap gap-3" role="tablist">
      <button
        role="tab"
        :aria-selected="activeCat === null"
        :class="[pill, activeCat === null ? 'border-brand/30 bg-brand-soft text-brand dark:bg-brand/20' : 'border-black/5 bg-white dark:border-white/10 dark:bg-zinc-900']"
        @click="activeCat = null"
      >
        <LayoutGrid class="h-3.5 w-3.5" />{{ t('home.all') }}
      </button>
      <button
        v-for="c in categories"
        :key="c.id"
        role="tab"
        :aria-selected="activeCat === c.id"
        :class="[pill, activeCat === c.id ? 'border-brand/30 bg-brand-soft text-brand dark:bg-brand/20' : 'border-black/5 bg-white dark:border-white/10 dark:bg-zinc-900']"
        @click="activeCat = c.id"
      >
        <span class="text-xs" :style="{ color: c.color }">{{ c.glyph }}</span>{{ c.name }}
      </button>
    </div>

    <!-- 商品 -->
    <div class="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      <template v-if="loading"><SkeletonCard v-for="i in 10" :key="i" /></template>
      <ProductCard v-for="p in filtered" v-else :key="p.id" :product="p" />
    </div>
    <p v-if="!loading && !filtered.length" class="py-16 text-center text-zinc-500">{{ t('product.empty') }}</p>

    <hr class="my-16 border-black/5 dark:border-white/10" />

    <!-- 最新动态 -->
    <div class="flex items-end justify-between">
      <div>
        <h2 class="text-2xl font-bold">{{ t('home.news') }}</h2>
        <p class="text-sm text-zinc-500">{{ t('home.newsSub') }}</p>
      </div>
      <div class="flex gap-3 text-sm text-zinc-500">
        <RouterLink to="/blog" class="hover:text-brand">{{ t('nav.blog') }}</RouterLink>
        <RouterLink to="/notice" class="hover:text-brand">{{ t('nav.notice') }}</RouterLink>
      </div>
    </div>
    <div class="mt-6 grid gap-5 md:grid-cols-3">
      <RouterLink v-for="p in posts" :key="p.id" :to="`/posts/${p.slug}`" class="card block p-5 transition hover:shadow-md">
        <h3 class="font-bold">{{ p.title }}</h3>
        <p class="mt-2 line-clamp-2 text-sm text-zinc-500">{{ p.summary }}</p>
        <span class="mt-4 block text-sm text-brand">{{ t('home.readMore') }}</span>
      </RouterLink>
    </div>
    <p v-if="!loading && !posts.length" class="py-10 text-center text-zinc-500">{{ t('posts.empty') }}</p>
  </section>
</template>
