<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Minus, Plus, ShoppingCart, Zap } from 'lucide-vue-next'
import { getProduct, unitPriceFor } from '../api'
import type { Product } from '../data/mock'
import { useCartStore } from '../stores/cart'
import { useUiStore } from '../stores/ui'
import ProductCover from '../components/ProductCover.vue'
import { money, currencySymbol } from '../utils/money'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const cart = useCartStore()
const ui = useUiStore()
const product = ref<Product | null>(null)
const loading = ref(true)
const qty = ref(1)

watchEffect(async () => {
  loading.value = true
  product.value = await getProduct(String(route.params.slug))
  qty.value = 1
  loading.value = false
})

const unit = computed(() => (product.value ? unitPriceFor(product.value, qty.value) : 0))

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
</script>

<template>
  <div class="py-8">
    <button class="mb-6 flex items-center gap-1 text-sm text-zinc-500 hover:text-brand" @click="router.back()">
      <ArrowLeft class="h-4 w-4" />{{ t('product.back') }}
    </button>

    <p v-if="loading" class="py-20 text-center text-zinc-500">{{ t('common.loading') }}</p>
    <p v-else-if="!product" class="py-20 text-center text-zinc-500">{{ t('product.empty') }}</p>

    <template v-else>
      <div class="grid gap-8 lg:grid-cols-2">
        <div class="card h-fit overflow-hidden"><ProductCover :product="product" large /></div>
        <div class="card p-6">
          <div class="flex gap-1.5 text-xs font-bold">
            <span v-if="product.fulfillment === 'auto'" class="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-600 dark:bg-emerald-500/15">{{ t('product.auto') }}</span>
            <span v-else class="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300">{{ t('product.manual') }}</span>
            <span v-if="product.recommended" class="rounded-md bg-sky-50 px-2 py-0.5 text-sky-600 dark:bg-sky-500/15">{{ t('product.recommend') }}</span>
          </div>
          <h1 class="mt-3 text-2xl font-bold">{{ product.title }}</h1>
          <p class="mt-2 text-zinc-500">{{ product.description }}</p>
          <p class="mt-5 font-bold text-price"><span>{{ currencySymbol() }}</span><span class="text-4xl">{{ unit.toFixed(2) }}</span></p>

          <div v-if="product.wholesale.length" class="mt-4 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
            <p class="font-bold text-amber-700 dark:text-amber-300">{{ t('product.wholesale') }}</p>
            <p v-for="w in product.wholesale" :key="w.minQty" class="text-amber-700/80 dark:text-amber-200/80">
              {{ t('product.wholesaleRow', { n: w.minQty, p: money(w.unitPrice) }) }}
            </p>
          </div>

          <div class="mt-5 flex gap-6 text-sm text-zinc-500">
            <span>{{ t('product.stock') }}: <b class="text-brand">{{ product.stock }}</b></span>
            <span>{{ t('product.sold') }}: <b class="text-orange-500">{{ product.sold }}</b></span>
          </div>

          <div class="mt-6">
            <label for="qty" class="label">{{ t('product.qty') }}</label>
            <div class="flex w-fit items-center rounded-xl border border-black/10 dark:border-white/10">
              <button class="p-3 disabled:opacity-40" :disabled="qty <= 1" aria-label="-" @click="clamp(qty - 1)"><Minus class="h-4 w-4" /></button>
              <input
                id="qty"
                :value="qty"
                type="number"
                min="1"
                :max="product.stock"
                class="w-16 bg-transparent text-center outline-none"
                @change="clamp(+($event.target as HTMLInputElement).value)"
              />
              <button class="p-3 disabled:opacity-40" :disabled="qty >= product.stock" aria-label="+" @click="clamp(qty + 1)"><Plus class="h-4 w-4" /></button>
            </div>
            <p class="mt-2 text-sm text-zinc-500">{{ t('cart.total') }}: <b class="text-price">{{ money(unit * qty) }}</b></p>
          </div>

          <div class="mt-6 flex flex-wrap gap-3">
            <button class="btn-ghost px-6 py-3" :disabled="product.stock <= 0" @click="addCart">
              <ShoppingCart class="h-4 w-4" />{{ t('product.addCart') }}
            </button>
            <button class="btn-primary px-6 py-3" :disabled="product.stock <= 0" @click="buyNow">
              <Zap class="h-4 w-4" />{{ product.stock > 0 ? t('product.buyNow') : t('product.soldOut') }}
            </button>
          </div>
        </div>
      </div>

      <div class="card mt-8 p-6">
        <h2 class="mb-4 text-xl font-bold">{{ t('product.detail') }}</h2>
        <div class="prose-content" v-html="product.content" />
      </div>
    </template>
  </div>
</template>
