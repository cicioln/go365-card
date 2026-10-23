<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Plus, Zap, Hand } from 'lucide-vue-next'
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

const out = computed(() => props.product.stock <= 0)
/** 库存不多于 5 件时进度条与文字变橙色 */
const low = computed(() => !out.value && props.product.stock <= 5)
// 库存条以 50 件为满格
const pct = computed(() => (out.value ? 0 : Math.max(4, Math.min(100, props.product.stock * 2))))

function open() {
  if (!out.value) router.push(`/products/${props.product.slug}`)
}

function quickBuy() {
  cart.add(props.product)
  ui.notify(t('product.added'))
}
</script>

<template>
  <article
    class="group flex flex-col overflow-hidden rounded-[18px] border border-line bg-surface transition duration-200 sm:rounded-[22px]"
    :class="out ? '' : 'cursor-pointer hover:-translate-y-[3px] hover:border-line-2 hover:shadow-[0_18px_40px_-20px_rgb(20_20_30/30%)]'"
    @click="open"
  >
    <div class="px-[5px] pt-[5px] sm:px-2 sm:pt-2">
      <ProductCover :product="product" :out="out">
        <span v-if="out" class="chip absolute top-2 right-2 bg-ink text-paper sm:top-3 sm:right-3">{{ t('product.soldOut') }}</span>
        <span v-else-if="product.recommended" class="chip absolute top-2 right-2 bg-accent text-white sm:top-3 sm:right-3">{{ t('product.recommend') }}</span>
      </ProductCover>
    </div>
    <div class="flex flex-1 flex-col px-[11px] pt-2.5 pb-3 sm:px-4 sm:pt-3.5 sm:pb-4">
      <span class="chip" :class="product.fulfillment === 'auto' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'">
        <Zap v-if="product.fulfillment === 'auto'" class="h-3 w-3" /><Hand v-else class="h-3 w-3" />
        {{ product.fulfillment === 'auto' ? t('product.auto') : t('product.manual') }}
      </span>
      <RouterLink
        :to="`/products/${product.slug}`"
        class="mt-1.5 mb-2 line-clamp-2 min-h-[38px] text-[13px] leading-[1.45] font-bold sm:mt-2.5 sm:mb-3.5 sm:min-h-[42px] sm:text-[14.5px]"
        @click.stop
      >
        <h3>{{ product.title }}</h3>
      </RouterLink>
      <div class="mt-auto flex items-end justify-between gap-2">
        <p class="price" :class="{ '!text-ink-3': out }" :aria-label="`价格 ${money(product.price)}`">
          <span class="text-xs sm:text-[13px]">{{ currencySymbol() }}</span><span class="text-[19px] sm:text-2xl">{{ product.price.toFixed(2) }}</span>
        </p>
        <button
          class="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-ink text-paper transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3 disabled:shadow-[inset_0_0_0_1px_var(--line)] sm:h-10 sm:w-10 sm:rounded-xl"
          :disabled="out"
          :aria-label="t('product.addCart')"
          :title="t('product.addCart')"
          @click.stop="quickBuy"
        >
          <Plus class="h-4 w-4" />
        </button>
      </div>
      <div class="mt-3">
        <div class="h-1 overflow-hidden rounded-full bg-surface-2 shadow-[inset_0_0_0_1px_var(--line)]">
          <i class="block h-full rounded-full" :class="low ? 'bg-accent' : 'bg-ink'" :style="{ width: `${pct}%` }" />
        </div>
        <div class="mt-1.5 flex justify-between gap-2 text-[11px] text-ink-3 sm:text-[11.5px]">
          <span v-if="out">{{ t('product.restock') }}</span>
          <span v-else-if="low" class="font-semibold text-accent">{{ t('product.only', { n: product.stock }) }}</span>
          <span v-else>{{ t('product.stock') }} <span class="font-mono text-ink-2">{{ product.stock }}</span></span>
          <span class="truncate">{{ t('product.sold') }} <span class="font-mono text-ink-2">{{ product.sold.toLocaleString() }}</span></span>
        </div>
      </div>
    </div>
  </article>
</template>
