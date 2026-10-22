<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ShoppingCart, Zap, Hand, Flame } from 'lucide-vue-next'
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
    class="card group flex flex-col overflow-hidden transition duration-300"
    :class="product.stock > 0 ? 'cursor-pointer hover:-translate-y-1 hover:border-brand/20 hover:shadow-xl hover:shadow-brand/5' : ''"
    @click="open"
  >
    <div class="relative overflow-hidden">
      <ProductCover :product="product" :class="product.stock <= 0 && 'opacity-50 grayscale'" />
      <!-- 角标放在封面左上角，不遮挡封面标题 -->
      <div class="absolute left-2.5 top-2.5 flex flex-wrap gap-1 text-[11px] font-bold">
        <span v-if="product.stock <= 0" class="rounded-md bg-zinc-900/85 px-1.5 py-0.5 text-white">{{ t('product.soldOut') }}</span>
        <span v-else-if="product.recommended" class="flex items-center gap-0.5 rounded-md bg-price px-1.5 py-0.5 text-white shadow-sm">
          <Flame class="h-3 w-3" />{{ t('product.recommend') }}
        </span>
      </div>
    </div>
    <div class="flex flex-1 flex-col p-3 sm:p-4">
      <span
        class="flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold"
        :class="product.fulfillment === 'auto' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15'"
      >
        <Zap v-if="product.fulfillment === 'auto'" class="h-3 w-3" /><Hand v-else class="h-3 w-3" />
        {{ product.fulfillment === 'auto' ? t('product.auto') : t('product.manual') }}
      </span>
      <RouterLink
        :to="`/products/${product.slug}`"
        class="mt-2 line-clamp-2 min-h-[2.75rem] text-sm leading-[1.375rem] font-bold transition group-hover:text-brand sm:text-[15px]"
        @click.stop
      >
        <h3>{{ product.title }}</h3>
      </RouterLink>
      <div class="mt-auto flex items-end justify-between gap-2 pt-3">
        <div class="min-w-0">
          <p class="font-bold leading-none" :class="product.stock > 0 ? 'text-price' : 'text-zinc-400'" :aria-label="`价格 ${money(product.price)}`">
            <span class="text-xs sm:text-sm">{{ currencySymbol() }}</span><span class="text-xl sm:text-2xl">{{ product.price.toFixed(2) }}</span>
          </p>
          <p class="mt-1.5 truncate text-[11px] text-zinc-500">
            {{ t('product.stock') }} {{ product.stock }} · {{ t('product.sold') }} {{ product.sold }}
          </p>
        </div>
        <button
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 sm:h-10 sm:w-10 dark:bg-brand/20 dark:disabled:bg-white/5"
          :disabled="product.stock <= 0"
          :aria-label="t('product.buy')"
          :title="t('product.buy')"
          @click.stop="quickBuy"
        >
          <ShoppingCart class="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  </article>
</template>
