<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Bell, ChevronRight, X, Search, Send, LayoutGrid, Zap, Clock, ShieldCheck, Headphones, ArrowRight, Newspaper,
} from 'lucide-vue-next'
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
const keyword = ref('')

const notice = computed(() => posts.value.find((p) => p.type === 'notice'))
const filtered = computed(() =>
  activeCat.value ? products.value.filter((p) => p.categoryId === activeCat.value) : products.value,
)
// 公告条只显示一行纯文本：优先摘要，否则取正文文字
const noticeText = computed(() => {
  const n = notice.value
  if (!n) return ''
  if (n.summary) return n.summary
  const text = new DOMParser().parseFromString(n.content, 'text/html').body.textContent ?? ''
  return text.replace(/\s+/g, ' ').trim() || n.title
})
const news = computed(() => posts.value.slice(0, 3))
const countOf = (id: number) => products.value.filter((p) => p.categoryId === id).length

const perks = [
  { icon: Zap, key: 'perkAuto', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/15' },
  { icon: Clock, key: 'perk24', color: 'text-brand bg-brand-soft dark:bg-brand/20' },
  { icon: ShieldCheck, key: 'perkSafe', color: 'text-violet-500 bg-violet-50 dark:bg-violet-500/15' },
  { icon: Headphones, key: 'perkAfter', color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/15' },
]

onMounted(async () => {
  ;[categories.value, products.value, posts.value] = await Promise.all([getCategories(), getProducts(), getPosts()])
  loading.value = false
})

function search() {
  const q = keyword.value.trim()
  router.push(q ? { path: '/products', query: { q } } : '/products')
}

const fmtDate = (s: string) => (s ? s.slice(0, 10) : '')

const pill =
  'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition'
const pillOn = 'border-brand bg-brand text-white shadow-sm shadow-brand/30'
const pillOff = 'border-black/5 bg-white text-zinc-700 hover:border-brand/30 hover:text-brand dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300'
</script>

<template>
  <section class="pt-6">
    <!-- 欢迎区：站点名 + 搜索 + 快捷入口 -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b1b3a] via-[#0f2c5c] to-[#0071e3] p-6 text-white sm:p-10">
      <div class="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-sky-400/30 blur-3xl" />
      <div class="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />
      <div class="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div class="max-w-xl">
          <h1 class="text-3xl font-black tracking-tight sm:text-4xl">{{ db.site.siteName }}</h1>
          <p class="mt-3 text-sm leading-relaxed text-white/75 sm:text-base">{{ db.site.description || t('home.heroSub') }}</p>
          <form class="mt-6 flex max-w-md items-center gap-2 rounded-2xl bg-white/10 p-1.5 ring-1 ring-white/20 backdrop-blur focus-within:ring-white/50" role="search" @submit.prevent="search">
            <Search class="ml-2.5 h-4 w-4 shrink-0 text-white/60" />
            <label for="home-kw" class="sr-only">{{ t('product.search') }}</label>
            <input
              id="home-kw"
              v-model="keyword"
              class="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/50"
              :placeholder="t('product.searchPh')"
            />
            <button class="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#0f2c5c] transition hover:bg-white/90">{{ t('product.search') }}</button>
          </form>
        </div>
        <div class="grid gap-2.5 sm:grid-cols-2 lg:w-[380px]">
          <RouterLink to="/guest/orders" class="flex items-center gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15 transition hover:bg-white/15">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Search class="h-4 w-4" /></span>
            <span class="min-w-0"><span class="block text-sm font-bold">{{ t('home.selfQuery') }}</span><span class="block text-xs text-white/60">{{ t('home.noLogin') }}</span></span>
            <ChevronRight class="ml-auto h-4 w-4 text-white/50" />
          </RouterLink>
          <a v-if="db.site.telegram" :href="db.site.telegram" target="_blank" rel="noopener" class="flex items-center gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15 transition hover:bg-white/15">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><Send class="h-4 w-4" /></span>
            <span class="min-w-0"><span class="block text-sm font-bold">{{ t('home.tg') }}</span><span class="block text-xs text-white/60">{{ t('home.official') }}</span></span>
            <ChevronRight class="ml-auto h-4 w-4 text-white/50" />
          </a>
          <RouterLink v-else to="/products" class="flex items-center gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15 transition hover:bg-white/15">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><LayoutGrid class="h-4 w-4" /></span>
            <span class="min-w-0"><span class="block text-sm font-bold">{{ t('product.allProducts') }}</span><span class="block text-xs text-white/60">{{ t('product.centerSub') }}</span></span>
            <ChevronRight class="ml-auto h-4 w-4 text-white/50" />
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- 服务保障 -->
    <ul class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <li v-for="p in perks" :key="p.key" class="card flex items-center gap-3 p-3.5 sm:p-4">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :class="p.color"><component :is="p.icon" class="h-5 w-5" /></span>
        <span class="min-w-0">
          <span class="block truncate text-sm font-bold">{{ t(`home.${p.key}`) }}</span>
          <span class="block truncate text-xs text-zinc-500">{{ t(`home.${p.key}Sub`) }}</span>
        </span>
      </li>
    </ul>

    <!-- 公告条 -->
    <div v-if="showNotice && notice" class="card mt-4 flex items-start gap-3 p-4 sm:items-center sm:px-5">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-brand/20">
        <Bell class="h-4 w-4" />
      </span>
      <RouterLink :to="`/posts/${notice.slug}`" class="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
        <span class="flex items-center gap-2">
          <span class="text-sm font-bold">{{ t('home.notice') }}</span>
          <span class="rounded-full bg-price/10 px-1.5 text-[10px] font-bold text-price">NEW</span>
        </span>
        <span class="mt-0.5 block truncate text-sm text-zinc-600 sm:mt-0 dark:text-zinc-300">{{ noticeText }}</span>
      </RouterLink>
      <RouterLink :to="`/posts/${notice.slug}`" class="hidden shrink-0 items-center text-sm font-semibold text-brand sm:flex">
        {{ t('home.detail') }}<ChevronRight class="h-4 w-4" />
      </RouterLink>
      <button
        class="btn-icon shrink-0"
        :aria-label="t('common.close')"
        @click="showNotice = false"
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <!-- 分类 + 商品 -->
    <div class="mt-10 flex items-end justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold sm:text-2xl">{{ t('home.hot') }}</h2>
        <p class="mt-1 text-sm text-zinc-500">{{ t('home.hotSub') }}</p>
      </div>
      <RouterLink to="/products" class="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline">
        {{ t('home.viewAll') }}<ArrowRight class="h-4 w-4" />
      </RouterLink>
    </div>
    <div class="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist">
      <button role="tab" :aria-selected="activeCat === null" :class="[pill, activeCat === null ? pillOn : pillOff]" @click="activeCat = null">
        <LayoutGrid class="h-3.5 w-3.5" />{{ t('home.all') }}
        <span class="text-xs opacity-60">{{ products.length }}</span>
      </button>
      <button
        v-for="c in categories"
        :key="c.id"
        role="tab"
        :aria-selected="activeCat === c.id"
        :class="[pill, activeCat === c.id ? pillOn : pillOff]"
        @click="activeCat = c.id"
      >
        <span class="text-xs" :style="activeCat === c.id ? undefined : { color: c.color }">{{ c.glyph }}</span>{{ c.name }}
        <span class="text-xs opacity-60">{{ countOf(c.id) }}</span>
      </button>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-5">
      <template v-if="loading"><SkeletonCard v-for="i in 10" :key="i" /></template>
      <ProductCard v-for="p in filtered" v-else :key="p.id" :product="p" />
    </div>
    <p v-if="!loading && !filtered.length" class="card mt-5 py-16 text-center text-zinc-500">{{ t('product.empty') }}</p>

    <!-- 最新动态 -->
    <template v-if="news.length">
      <div class="mt-14 flex items-end justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold sm:text-2xl">{{ t('home.news') }}</h2>
          <p class="mt-1 text-sm text-zinc-500">{{ t('home.newsSub') }}</p>
        </div>
        <div class="flex shrink-0 gap-3 text-sm font-semibold text-zinc-500">
          <RouterLink to="/blog" class="hover:text-brand">{{ t('nav.blog') }}</RouterLink>
          <RouterLink to="/notice" class="hover:text-brand">{{ t('nav.notice') }}</RouterLink>
        </div>
      </div>
      <div class="mt-5 grid gap-4 md:grid-cols-3">
        <RouterLink
          v-for="p in news"
          :key="p.id"
          :to="`/posts/${p.slug}`"
          class="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div class="flex items-center gap-2 text-xs text-zinc-500">
            <span
              class="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold"
              :class="p.type === 'notice' ? 'bg-brand-soft text-brand dark:bg-brand/20' : 'bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300'"
            >
              <Bell v-if="p.type === 'notice'" class="h-3 w-3" /><Newspaper v-else class="h-3 w-3" />
              {{ p.type === 'notice' ? t('nav.notice') : t('nav.blog') }}
            </span>
            <time :datetime="p.publishedAt">{{ fmtDate(p.publishedAt) }}</time>
          </div>
          <h3 class="mt-3 line-clamp-1 font-bold transition group-hover:text-brand">{{ p.title }}</h3>
          <p class="mt-1.5 line-clamp-2 flex-1 text-sm text-zinc-500">{{ p.summary }}</p>
          <span class="mt-4 flex items-center gap-1 text-sm font-semibold text-brand">
            {{ t('home.readMore') }}<ArrowRight class="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </RouterLink>
      </div>
    </template>
  </section>
</template>
