<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, ChevronRight, ClipboardList, Clock, Hand, ShieldCheck, ShoppingCart, Zap } from 'lucide-vue-next'
import { getCategories, getProduct, unitPriceFor } from '../api'
import type { Category, Product } from '../data/mock'
import { useCartStore } from '../stores/cart'
import { useUiStore } from '../stores/ui'
import { useSiteStore } from '../stores/site'
import ProductCover from '../components/ProductCover.vue'
import { money, currencySymbol } from '../utils/money'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const cart = useCartStore()
const ui = useUiStore()
const site = useSiteStore()
const product = ref<Product | null>(null)
const categories = ref<Category[]>([])
const loading = ref(true)
const qty = ref(1)

getCategories().then((c) => (categories.value = c)).catch(() => {})

watchEffect(async () => {
  loading.value = true
  product.value = await getProduct(String(route.params.slug))
  if (product.value) site.detail = { title: product.value.title, description: product.value.description }
  qty.value = 1
  loading.value = false
})

const out = computed(() => (product.value?.stock ?? 0) <= 0)
const category = computed(() => categories.value.find((c) => c.id === product.value?.categoryId))
const unit = computed(() => (product.value ? unitPriceFor(product.value, qty.value) : 0))
const saved = computed(() => (product.value ? (product.value.price - unit.value) * qty.value : 0))

/** 批发价阶梯：1 – 4 件、5 – 9 件、10 件以上 */
const tiers = computed(() => {
  const p = product.value
  if (!p?.wholesale.length) return []
  const list = [...p.wholesale].sort((a, b) => a.minQty - b.minQty)
  const rows = [{ min: 1, price: p.price }, ...list.map((w) => ({ min: w.minQty, price: w.unitPrice }))]
  return rows.map((r, i) => {
    const next = rows[i + 1]
    return {
      ...r,
      label: next ? (next.min - 1 > r.min ? `${r.min} – ${next.min - 1}` : `${r.min}`) : `${r.min}+`,
      on: qty.value >= r.min && (!next || qty.value < next.min),
    }
  })
})

function clamp(n: number) {
  if (!product.value) return
  qty.value = Math.max(1, Math.min(product.value.stock, Math.floor(n) || 1))
}

function addCart() {
  if (!product.value) return
  cart.add(product.value, qty.value)
  ui.notify(t('product.added'))
}

function buyNow() {
  if (!product.value) return
  router.push({ path: '/checkout', query: { pid: product.value.id, qty: qty.value } })
}

const qtyBtn = 'h-full w-10 font-mono text-base font-bold text-ink-2 disabled:opacity-40'
</script>

<template>
  <div class="pb-28 md:pb-0">
    <nav class="flex items-center gap-2 py-5 text-[13px] text-ink-3" aria-label="Breadcrumb">
      <button class="grid h-8 w-8 place-items-center rounded-[10px] border border-line bg-surface text-ink md:hidden" :aria-label="t('product.back')" @click="router.back()">
        <ArrowLeft class="h-4 w-4" />
      </button>
      <RouterLink to="/" class="hidden hover:text-ink md:inline">{{ t('nav.home') }}</RouterLink>
      <template v-if="category">
        <ChevronRight class="hidden h-3.5 w-3.5 md:block" />
        <RouterLink to="/products" class="hidden hover:text-ink md:inline">{{ category.name }}</RouterLink>
      </template>
      <template v-if="product">
        <ChevronRight class="hidden h-3.5 w-3.5 md:block" />
        <b class="truncate font-semibold text-ink">{{ product.title }}</b>
      </template>
    </nav>

    <p v-if="loading" class="py-20 text-center text-ink-3">{{ t('common.loading') }}</p>
    <p v-else-if="!product" class="py-20 text-center text-ink-3">{{ t('product.empty') }}</p>

    <div v-else class="grid items-start gap-7 lg:grid-cols-[1.05fr_1fr]">
      <div class="min-w-0">
        <ProductCover :product="product" size="lg" :out="out" />
        <div class="card mt-4 grid grid-cols-3">
          <div class="border-r border-line px-[18px] py-4">
            <span class="block text-xs text-ink-3">{{ t('product.delivery') }}</span>
            <b class="font-mono text-base" :class="product.fulfillment === 'auto' ? 'text-ok' : 'text-warn'">{{ product.fulfillment === 'auto' ? t('product.autoShort') : t('product.manualShort') }}</b>
          </div>
          <div class="border-r border-line px-[18px] py-4">
            <span class="block text-xs text-ink-3">{{ t('product.stock') }}</span><b class="font-mono text-base">{{ product.stock }}</b>
          </div>
          <div class="px-[18px] py-4">
            <span class="block text-xs text-ink-3">{{ t('product.sold') }}</span><b class="font-mono text-base">{{ product.sold.toLocaleString() }}</b>
          </div>
        </div>

        <!-- 桌面端说明在左栏；手机端放到购买面板下面 -->
        <section class="mt-7 hidden lg:block">
          <h2 class="-mb-px w-fit border-b-2 border-ink pb-3 font-bold">{{ t('product.detail') }}</h2>
          <div class="border-t border-line py-5"><div class="prose-content text-[14.5px]" v-html="product.content" /></div>
        </section>
      </div>

      <aside class="card p-5 sm:p-7 lg:sticky lg:top-20">
        <div class="flex gap-1.5">
          <span class="chip" :class="product.fulfillment === 'auto' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'">
            <Zap v-if="product.fulfillment === 'auto'" class="h-3 w-3" /><Hand v-else class="h-3 w-3" />
            {{ product.fulfillment === 'auto' ? t('product.auto') : t('product.manual') }}
          </span>
          <span v-if="product.recommended" class="chip bg-ink text-paper">{{ t('product.recommend') }}</span>
          <span v-if="out" class="chip bg-surface-2 text-ink-3">{{ t('product.soldOut') }}</span>
        </div>
        <h1 class="mt-3 mb-1.5 text-[19px] leading-[1.35] font-extrabold tracking-[-0.02em] sm:text-[26px] sm:leading-[1.3]">{{ product.title }}</h1>
        <p v-if="product.description" class="text-ink-2">{{ product.description }}</p>

        <p class="price mt-[18px]" :class="{ '!text-ink-3': out }">
          <span class="text-lg">{{ currencySymbol() }}</span><span class="text-[30px] sm:text-[40px]">{{ unit.toFixed(2) }}</span>
          <s v-if="unit < product.price" class="ml-1.5 text-xs font-medium text-ink-3">{{ money(product.price) }}</s>
        </p>

        <div v-if="tiers.length" class="mt-[18px] grid grid-cols-3 gap-2" :aria-label="t('product.wholesale')">
          <button
            v-for="r in tiers"
            :key="r.min"
            type="button"
            class="rounded-xl border px-3 py-2.5 text-left transition"
            :class="r.on ? 'border-ink bg-surface shadow-[inset_0_0_0_1px_var(--ink)]' : 'border-line bg-surface-2 hover:border-line-2'"
            :disabled="out || r.min > product.stock"
            @click="clamp(r.min)"
          >
            <span class="block text-xs text-ink-3">{{ t('product.tier', { r: r.label }) }}</span>
            <b class="font-mono text-[15px]">{{ money(r.price) }}</b>
          </button>
        </div>

        <div class="mt-[22px] hidden md:block">
          <label for="qty" class="label">{{ t('product.qty') }}</label>
          <div class="flex h-11 w-fit items-center rounded-xl border border-line-2 bg-surface-2">
            <button :class="qtyBtn" :disabled="qty <= 1" aria-label="-" @click="clamp(qty - 1)">−</button>
            <input
              id="qty"
              :value="qty"
              type="number"
              min="1"
              :max="product.stock"
              class="w-[52px] bg-transparent text-center font-mono text-[15px] font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              @change="clamp(+($event.target as HTMLInputElement).value)"
            />
            <button :class="qtyBtn" :disabled="qty >= product.stock" aria-label="+" @click="clamp(qty + 1)">+</button>
          </div>
        </div>

        <div class="mt-[22px] mb-3.5 hidden items-center justify-between border-t border-dashed border-line-2 pt-[18px] md:flex">
          <span class="text-ink-3">{{ t('cart.total') }}<template v-if="saved > 0.001"> · {{ t('product.saved', { p: money(saved) }) }}</template></span>
          <b class="font-mono text-[22px]">{{ money(unit * qty) }}</b>
        </div>
        <div class="hidden grid-cols-[1fr_auto] gap-2 md:grid">
          <button class="btn-primary h-[50px] text-[15px]" :disabled="out" @click="buyNow">
            {{ out ? t('product.soldOut') : t('product.buyNow') }}<ArrowRight v-if="!out" class="h-4 w-4" />
          </button>
          <button class="btn-ghost h-[50px] w-[50px] p-0" :disabled="out" :title="t('product.addCart')" :aria-label="t('product.addCart')" @click="addCart">
            <ShoppingCart class="h-4 w-4" />
          </button>
        </div>
        <div class="mt-[18px] flex flex-wrap gap-4 text-[12.5px] text-ink-3">
          <span class="inline-flex items-center gap-1.5"><ShieldCheck class="h-3.5 w-3.5" />{{ t('product.assure1') }}</span>
          <span class="inline-flex items-center gap-1.5"><Clock class="h-3.5 w-3.5" />{{ t('product.assure2') }}</span>
          <span class="inline-flex items-center gap-1.5"><ClipboardList class="h-3.5 w-3.5" />{{ t('product.assure3') }}</span>
        </div>
      </aside>

      <section class="lg:hidden">
        <h2 class="-mb-px w-fit border-b-2 border-ink pb-3 font-bold">{{ t('product.detail') }}</h2>
        <div class="border-t border-line py-5"><div class="prose-content text-[14.5px]" v-html="product.content" /></div>
      </section>
    </div>

    <!-- 手机端固定购买栏 -->
    <div v-if="product" class="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 border-t border-line bg-surface px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] md:hidden">
      <div class="flex h-12 items-center rounded-xl border border-line-2 bg-surface-2">
        <button :class="qtyBtn" class="!w-9" :disabled="qty <= 1 || out" aria-label="-" @click="clamp(qty - 1)">−</button>
        <span class="w-8 text-center font-mono text-[15px] font-bold" aria-live="polite">{{ qty }}</span>
        <button :class="qtyBtn" class="!w-9" :disabled="qty >= product.stock || out" aria-label="+" @click="clamp(qty + 1)">+</button>
      </div>
      <button class="btn-ghost h-12 w-12 shrink-0 p-0" :disabled="out" :aria-label="t('product.addCart')" @click="addCart"><ShoppingCart class="h-4 w-4" /></button>
      <button class="btn-primary h-12 flex-1" :disabled="out" @click="buyNow">
        {{ out ? t('product.soldOut') : `${t('product.buy')} · ${money(unit * qty)}` }}
      </button>
    </div>
  </div>
</template>
