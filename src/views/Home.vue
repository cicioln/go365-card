<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ChevronRight, Search, Send, ClipboardList, LayoutGrid } from 'lucide-vue-next'
import { getCategories, getFeed, getPosts, getProducts, type Feed } from '../api'
import { useSiteStore } from '../stores/site'
import type { Category, Post, Product } from '../data/mock'
import ProductCard from '../components/ProductCard.vue'
import SkeletonCard from '../components/SkeletonCard.vue'
import { avatarOf } from '../utils/brand'
import { money } from '../utils/money'

const { t, locale } = useI18n()
const router = useRouter()
const db = useSiteStore()
const categories = ref<Category[]>([])
const products = ref<Product[]>([])
const posts = ref<Post[]>([])
const feed = ref<Feed | null>(null)
const loading = ref(true)
const activeCat = ref<number | null>(null)
const sort = ref<'default' | 'sold' | 'price' | 'new'>('default')
const keyword = ref('')

const notice = computed(() => posts.value.find((p) => p.type === 'notice'))
// 公告条只显示一行纯文本：优先摘要，否则取正文文字
const noticeText = computed(() => {
  const n = notice.value
  if (!n) return ''
  if (n.summary) return n.summary
  const text = new DOMParser().parseFromString(n.content, 'text/html').body.textContent ?? ''
  return text.replace(/\s+/g, ' ').trim() || n.title
})

const filtered = computed(() => {
  const list = activeCat.value ? products.value.filter((p) => p.categoryId === activeCat.value) : [...products.value]
  // 售罄商品始终排在后面
  const rank = (p: Product) => (p.stock > 0 ? 0 : 1)
  const by = {
    default: () => 0,
    sold: (a: Product, b: Product) => b.sold - a.sold,
    price: (a: Product, b: Product) => a.price - b.price,
    new: (a: Product, b: Product) => b.id - a.id,
  }[sort.value]
  return list.sort((a, b) => rank(a) - rank(b) || by(a, b))
})
const countOf = (id: number) => products.value.filter((p) => p.categoryId === id).length
const sorts = ['default', 'sold', 'price', 'new'] as const

/** 实时发货：有真实成交显示脱敏订单，否则显示热销商品 */
const hot = computed(() => [...products.value].sort((a, b) => b.sold - a.sold).slice(0, 4))
const totalSold = computed(() => feed.value?.sold ?? products.value.reduce((n, p) => n + p.sold, 0))

const steps = [1, 2, 3, 4]
const faqs = [1, 2, 3]

onMounted(async () => {
  getFeed().then((f) => (feed.value = f)).catch(() => {})
  ;[categories.value, products.value, posts.value] = await Promise.all([getCategories(), getProducts(), getPosts()])
  loading.value = false
})

function search() {
  const q = keyword.value.trim()
  router.push(q ? { path: '/products', query: { q } } : '/products')
}

/** 「12 秒前」「3 分钟前」 */
function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  if (s < 60) return rtf.format(-s, 'second')
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute')
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour')
  return rtf.format(-Math.round(s / 86400), 'day')
}

const quick = 'flex items-center gap-2.5 rounded-[14px] border border-line bg-surface-2 p-3 text-[13px] font-bold transition hover:border-line-2'
</script>

<template>
  <section class="grid gap-7 pt-8 pb-7 lg:grid-cols-[1.25fr_1fr] lg:pt-11">
    <div>
      <span class="eyebrow">● {{ t('home.status') }}</span>
      <h1 class="mt-3.5 mb-4 text-[30px] leading-[1.1] font-extrabold tracking-[-0.035em] sm:text-[42px] lg:text-[54px] lg:leading-[1.06]">
        {{ t('home.title1') }}<br /><span class="text-accent">{{ t('home.title2') }}</span>
      </h1>
      <p class="max-w-[470px] text-[15px] text-ink-2 sm:text-base">{{ db.site.description || t('home.heroSub') }}</p>
      <form class="mt-6 flex max-w-[500px] items-center gap-2 rounded-2xl border border-line bg-surface p-1.5 shadow-panel" role="search" @submit.prevent="search">
        <Search class="ml-2.5 h-4 w-4 shrink-0 text-ink-3" />
        <label for="home-kw" class="sr-only">{{ t('product.search') }}</label>
        <input id="home-kw" v-model="keyword" class="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-ink-3" :placeholder="t('home.searchPh')" />
        <button class="btn-primary">{{ t('product.search') }}</button>
      </form>
      <dl class="mt-8 flex max-w-[500px] gap-6 border-t border-dashed border-line-2 pt-5 sm:gap-9">
        <div><dd class="font-mono text-[22px] leading-tight font-bold tracking-tight">{{ totalSold.toLocaleString() }}</dd><dt class="text-[12.5px] text-ink-3">{{ t('home.statSold') }}</dt></div>
        <div><dd class="font-mono text-[22px] leading-tight font-bold tracking-tight">{{ products.length || '—' }}</dd><dt class="text-[12.5px] text-ink-3">{{ t('home.statProducts') }}</dt></div>
        <div><dd class="font-mono text-[22px] leading-tight font-bold tracking-tight">7×24</dd><dt class="text-[12.5px] text-ink-3">{{ t('home.statAuto') }}</dt></div>
      </dl>
    </div>

    <aside class="card flex flex-col p-5">
      <div class="mb-3.5 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="pulse h-2 w-2 rounded-full bg-ok" />
          <b>{{ feed?.recent.length ? t('home.live') : t('home.hotNow') }}</b>
        </div>
        <span class="eyebrow">Live</span>
      </div>
      <ul class="flex flex-1 flex-col gap-0.5">
        <template v-if="feed?.recent.length">
          <li v-for="(o, i) in feed.recent.slice(0, 4)" :key="i" class="grid grid-cols-[34px_1fr_auto] items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
            <span class="grid h-[34px] w-[34px] place-items-center rounded-[10px] font-mono text-[11px] font-bold text-white" :style="{ background: avatarOf(o.title).color }">{{ avatarOf(o.title).text }}</span>
            <div class="min-w-0">
              <b class="block truncate text-[13.5px]">{{ o.title }}</b>
              <small class="text-xs text-ink-3">{{ o.email }} · ×{{ o.qty }}</small>
            </div>
            <div class="text-right text-xs leading-normal text-ink-3">
              <b class="font-mono" :class="o.delivered ? 'text-ok' : 'text-warn'">{{ o.delivered ? t('order.delivered') : t('order.paid') }}</b><br />{{ ago(o.at) }}
            </div>
          </li>
        </template>
        <template v-else>
          <li v-for="p in hot" :key="p.id">
            <RouterLink :to="`/products/${p.slug}`" class="grid grid-cols-[34px_1fr_auto] items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface-2">
              <span class="grid h-[34px] w-[34px] place-items-center rounded-[10px] font-mono text-[11px] font-bold text-white" :style="{ background: avatarOf(p.title).color }">{{ avatarOf(p.title).text }}</span>
              <div class="min-w-0">
                <b class="block truncate text-[13.5px]">{{ p.title }}</b>
                <small class="text-xs text-ink-3">{{ t('product.sold') }} <span class="font-mono">{{ p.sold.toLocaleString() }}</span></small>
              </div>
              <span class="price text-sm">{{ money(p.price) }}</span>
            </RouterLink>
          </li>
        </template>
      </ul>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <RouterLink to="/guest/orders" :class="quick">
          <ClipboardList class="h-4 w-4 shrink-0" />
          <span class="min-w-0">{{ t('nav.guestOrders') }}<small class="block truncate text-[11.5px] font-medium text-ink-3">{{ t('home.queryHint') }}</small></span>
        </RouterLink>
        <a v-if="db.site.telegram" :href="db.site.telegram" target="_blank" rel="noopener" :class="quick">
          <Send class="h-4 w-4 shrink-0" />
          <span class="min-w-0">{{ t('home.tg') }}<small class="block truncate text-[11.5px] font-medium text-ink-3">{{ t('home.tgHint') }}</small></span>
        </a>
        <RouterLink v-else to="/products" :class="quick">
          <LayoutGrid class="h-4 w-4 shrink-0" />
          <span class="min-w-0">{{ t('product.allProducts') }}<small class="block truncate text-[11.5px] font-medium text-ink-3">{{ t('product.centerSub') }}</small></span>
        </RouterLink>
      </div>
    </aside>
  </section>

  <!-- 公告条 -->
  <RouterLink v-if="notice" :to="`/posts/${notice.slug}`" class="flex items-center gap-3.5 rounded-[14px] border border-line bg-surface px-4 py-3 transition hover:border-line-2">
    <span class="shrink-0 rounded-md bg-accent-soft px-2 py-[3px] font-mono text-[11px] font-bold tracking-[0.06em] text-accent">{{ t('nav.notice') }}</span>
    <p class="min-w-0 flex-1 truncate text-ink-2">{{ noticeText }}</p>
    <span class="btn-ghost hidden h-[34px] rounded-[10px] px-3 text-[13px] sm:inline-flex">{{ t('home.view') }}<ChevronRight class="h-4 w-4" /></span>
  </RouterLink>

  <!-- 分类 + 商品 -->
  <div class="mt-10 mb-4 flex flex-col items-start justify-between gap-4 sm:mt-12 sm:flex-row sm:items-end">
    <div>
      <span class="eyebrow">Catalog</span>
      <h2 class="text-[26px] font-extrabold tracking-[-0.02em]">{{ t('product.allProducts') }}</h2>
    </div>
    <div class="flex gap-0.5 rounded-[11px] border border-line bg-surface p-[3px]" role="group" :aria-label="t('home.sort')">
      <button
        v-for="s in sorts"
        :key="s"
        class="h-[30px] rounded-lg px-3 text-[12.5px] font-bold transition"
        :class="sort === s ? 'bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--line)]' : 'text-ink-3 hover:text-ink'"
        :aria-pressed="sort === s"
        @click="sort = s"
      >
        {{ t(`home.sort_${s}`) }}
      </button>
    </div>
  </div>
  <div class="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist">
    <button role="tab" :aria-selected="activeCat === null" class="cat" :class="{ on: activeCat === null }" @click="activeCat = null">
      {{ t('home.all') }} <em>{{ products.length }}</em>
    </button>
    <button
      v-for="c in categories"
      :key="c.id"
      role="tab"
      :aria-selected="activeCat === c.id"
      class="cat"
      :class="{ on: activeCat === c.id }"
      @click="activeCat = c.id"
    >
      <img v-if="c.icon" :src="c.icon" alt="" class="h-[18px] w-[18px] rounded-md object-contain" />
      <span v-else class="grid h-[18px] w-[18px] place-items-center rounded-md text-[10px] text-white" :style="{ background: c.color }">{{ c.glyph }}</span>{{ c.name }}
      <em>{{ countOf(c.id) }}</em>
    </button>
  </div>

  <div class="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
    <template v-if="loading"><SkeletonCard v-for="i in 8" :key="i" /></template>
    <ProductCard v-for="p in filtered" v-else :key="p.id" :product="p" />
  </div>
  <p v-if="!loading && !filtered.length" class="card mt-5 py-16 text-center text-ink-3">{{ t('product.empty') }}</p>

  <!-- 购买流程 -->
  <section class="mt-14 grid overflow-hidden rounded-[22px] border border-line bg-surface sm:grid-cols-2 lg:grid-cols-4">
    <div v-for="n in steps" :key="n" class="border-b border-line p-6 last:border-0 sm:[&:nth-child(odd)]:border-r lg:border-r lg:border-b-0">
      <span class="font-mono text-xs font-bold text-accent">0{{ n }}</span>
      <b class="mt-2.5 mb-1 block text-[15px]">{{ t(`home.step${n}`) }}</b>
      <p class="text-[13px] text-ink-3">{{ t(`home.step${n}Sub`) }}</p>
    </div>
  </section>

  <div class="mt-4 grid gap-4" :class="{ 'lg:grid-cols-2': db.site.telegram }">
    <div class="card px-[22px] py-2">
      <details v-for="n in faqs" :key="n" class="faq border-b border-line py-3.5 last:border-0" :open="n === 1">
        <summary class="flex cursor-pointer list-none justify-between gap-4 font-bold">{{ t(`home.faq${n}`) }}</summary>
        <p class="mt-2 text-[13.5px] text-ink-2">{{ t(`home.faq${n}A`) }}</p>
      </details>
    </div>
    <div v-if="db.site.telegram" class="tg relative flex flex-col justify-between overflow-hidden rounded-[22px] bg-ink p-7 text-paper">
      <div class="relative">
        <h3 class="max-w-[300px] text-2xl font-extrabold tracking-[-0.02em]">{{ t('home.tgTitle') }}</h3>
        <p class="mt-2 max-w-[320px] opacity-65">{{ t('home.tgSub') }}</p>
      </div>
      <div class="relative"><a :href="db.site.telegram" target="_blank" rel="noopener" class="btn-primary mt-6"><Send class="h-4 w-4" />{{ t('home.tgJoin') }}</a></div>
    </div>
  </div>
</template>

<style scoped>
.pulse { box-shadow: 0 0 0 0 rgb(18 161 80 / 50%); animation: pulse 2s infinite; }
@keyframes pulse {
  70% { box-shadow: 0 0 0 8px rgb(18 161 80 / 0%); }
  100% { box-shadow: 0 0 0 0 rgb(18 161 80 / 0%); }
}
.cat {
  display: inline-flex; flex-shrink: 0; align-items: center; gap: 8px; height: 36px; padding: 0 14px;
  border-radius: 99px; border: 1px solid var(--line); background: var(--surface);
  font-weight: 700; font-size: 13px; color: var(--ink-2); transition: border-color .15s;
}
.cat:hover { border-color: var(--line-2); }
.cat em { font: 500 11.5px var(--font-mono); font-style: normal; color: var(--ink-3); }
.cat.on { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.cat.on em { color: color-mix(in srgb, var(--paper) 60%, transparent); }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: '+'; font-family: var(--font-mono); color: var(--ink-3); }
.faq[open] summary::after { content: '–'; }
.tg::before {
  content: ''; position: absolute; right: -60px; top: -60px; width: 220px; height: 220px;
  border-radius: 99px; border: 40px solid rgb(255 90 31 / 25%);
}
</style>
