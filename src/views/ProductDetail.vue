<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ChevronRight, ClipboardList, Clock, Flame, Hand, Package, ShieldCheck, ShoppingCart, Zap } from 'lucide-vue-next'
import { getCategories, getProduct, unitPriceFor } from '../api'
import type { Category, Product } from '../data/mock'
import { useCartStore } from '../stores/cart'
import { useUiStore } from '../stores/ui'
import { useSiteStore } from '../stores/site'
import ProductCover from '../components/ProductCover.vue'
import CheckoutPanel from '../components/CheckoutPanel.vue'
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

/** 图片下方的发货 / 库存 / 销量三格 */
const stats = computed(() => {
  const p = product.value
  if (!p) return []
  const auto = p.fulfillment === 'auto'
  return [
    {
      label: t('product.delivery'), icon: auto ? Zap : Hand, badge: auto ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn',
      value: auto ? t('product.autoShort') : t('product.manualShort'), cls: auto ? 'text-ok' : 'text-warn',
      hint: auto ? t('product.autoHint') : t('product.manualHint'),
    },
    {
      label: t('product.stock'), icon: Package, badge: 'bg-surface-2 text-ink-2', value: String(p.stock), cls: '',
      hint: p.stock <= 0 ? t('product.soldOut') : p.stock <= 5 ? t('product.only', { n: p.stock }) : t('product.inStock'),
      hintCls: p.stock <= 0 ? 'text-ink-3' : p.stock <= 5 ? 'text-price' : 'text-ok',
    },
    {
      label: t('product.sold'), icon: Flame, badge: 'bg-price/10 text-price', value: p.sold.toLocaleString(), cls: '',
      hint: t('product.soldHint'),
    },
  ]
})

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

// 下单表单直接嵌在购买面板里，不再跳确认订单页
const panel = ref<InstanceType<typeof CheckoutPanel>>()
const lines = computed(() => (product.value && !out.value ? [{ productId: product.value.id, qty: qty.value, unit: unit.value }] : []))

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
        <div class="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div v-for="s in stats" :key="s.label" class="card flex items-center gap-3 p-3 sm:p-4">
            <span class="hidden h-10 w-10 shrink-0 place-items-center rounded-xl sm:grid" :class="s.badge"><component :is="s.icon" class="h-[18px] w-[18px]" /></span>
            <div class="min-w-0">
              <span class="block text-xs text-ink-3">{{ s.label }}</span>
              <b class="block truncate font-mono text-[15px] sm:text-base" :class="s.cls">{{ s.value }}</b>
              <span class="block truncate text-[11.5px]" :class="s.hintCls ?? 'text-ink-3'">{{ s.hint }}</span>
            </div>
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

        <CheckoutPanel
          ref="panel"
          class="mt-[22px]"
          :lines="lines"
          :disabled="out"
          :label="out ? t('product.soldOut') : t('product.buyNow')"
          mobile-bar
        >
          <template #subtotal-label>{{ t('cart.total') }}<template v-if="saved > 0.001"> · {{ t('product.saved', { p: money(saved) }) }}</template></template>
          <template #actions>
            <button type="button" class="btn-ghost h-[50px] w-[50px] p-0" :disabled="out" :title="t('product.addCart')" :aria-label="t('product.addCart')" @click="addCart">
              <ShoppingCart class="h-4 w-4" />
            </button>
          </template>
        </CheckoutPanel>
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
      <button class="btn-primary h-12 flex-1" :disabled="out || panel?.busy" @click="panel?.submit()">
        {{ out ? t('product.soldOut') : `${t('product.buy')} · ${money(panel?.total ?? unit * qty)}` }}
      </button>
    </div>
  </div>
</template>
