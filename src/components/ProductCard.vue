<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ShoppingCart, Package, Receipt } from 'lucide-vue-next'
import type { Product } from '../data/mock'
import { useCartStore } from '../stores/cart'
import { useUiStore } from '../stores/ui'
import ProductCover from './ProductCover.vue'
import { money, currencySymbol } from '../utils/money'

const props = defineProps<{ product: Product }>()
const { t } = useI18n()
const router = useRouter()
const cart = useCartStore()
const ui = useUiStore()

function open() {
  if (props.product.stock > 0) router.push(`/products/${props.product.slug}`)
}

function quickBuy() {
  cart.add(props.product)
  ui.notify(t('product.added'))
}
</script>

<template>
  <article
    class="card group overflow-hidden transition"
    :class="product.stock > 0 ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg' : 'opacity-90'"
    @click="open"
  >
    <div class="relative">
      <ProductCover :product="product" :class="product.stock <= 0 && 'grayscale brightness-50'" />
      <span
        v-if="product.stock <= 0"
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-800/90 px-4 py-1.5 text-sm font-bold text-white"
      >{{ t('product.soldOut') }}</span>
    </div>
    <div class="p-4">
      <div class="flex gap-1.5 text-[11px] font-bold">
        <span
          class="rounded-md px-1.5 py-0.5"
          :class="product.fulfillment === 'auto' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : 'bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300'"
        >
          {{ product.fulfillment === 'auto' ? t('product.auto') : t('product.manual') }}
        </span>
        <span v-if="product.recommended" class="rounded-md bg-sky-50 px-1.5 py-0.5 text-sky-600 dark:bg-sky-500/15">
          {{ t('product.recommend') }}
        </span>
      </div>
      <RouterLink
        :to="`/products/${product.slug}`"
        class="mt-2 line-clamp-2 min-h-[3rem] font-bold leading-6"
        @click.stop
      >
        <h3>{{ product.title }}</h3>
      </RouterLink>
      <div class="mt-3 flex items-center justify-between">
        <p class="font-bold" :class="product.stock > 0 ? 'text-price' : 'text-zinc-300'" :aria-label="`价格 ${money(product.price)}`">
          <span class="text-sm">{{ currencySymbol() }}</span><span class="text-2xl">{{ product.price.toFixed(2) }}</span>
        </p>
        <button
          class="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 text-zinc-600 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-zinc-300"
          :disabled="product.stock <= 0"
          :aria-label="t('product.buy')"
          :title="t('product.buy')"
          @click.stop="quickBuy"
        >
          <ShoppingCart class="h-5 w-5" />
        </button>
      </div>
      <div class="mt-3 flex justify-between border-t border-black/5 pt-3 text-xs font-semibold dark:border-white/10">
        <span class="flex items-center gap-1 text-brand"><Package class="h-3.5 w-3.5" />{{ t('product.stock') }}: {{ product.stock }}</span>
        <span class="flex items-center gap-1 text-orange-500"><Receipt class="h-3.5 w-3.5" />{{ t('product.sold') }}: {{ product.sold }}</span>
      </div>
    </div>
  </article>
</template>
