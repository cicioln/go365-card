<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Trash2, ShoppingCart } from 'lucide-vue-next'
import { useCartStore } from '../stores/cart'
import ProductCover from '../components/ProductCover.vue'
import CheckoutPanel from '../components/CheckoutPanel.vue'
import { money } from '../utils/money'
import { errorText } from '../http'

const { t } = useI18n()
const cart = useCartStore()
const loading = ref(true)
const error = ref('')
const lines = computed(() => cart.detailed.map((i) => ({ productId: i.productId, qty: i.qty, unit: i.unit })))

// 每次打开购物车都从服务端刷新价格与库存
onMounted(async () => {
  try {
    await cart.refresh()
  } catch (e) {
    error.value = errorText(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto max-w-4xl py-10">
    <h1 class="mb-6 text-3xl font-bold">{{ t('cart.title') }}</h1>

    <p v-if="loading && cart.items.length" class="card py-20 text-center text-ink-3">{{ t('common.loading') }}</p>
    <p v-else-if="error" role="alert" class="card py-20 text-center text-red-500">{{ error }}</p>
    <div v-else-if="!cart.detailed.length" class="card flex flex-col items-center py-20 text-ink-3">
      <ShoppingCart class="h-12 w-12 opacity-40" />
      <p class="mt-4">{{ t('cart.empty') }}</p>
      <RouterLink to="/products" class="btn-primary mt-6">{{ t('cart.go') }}</RouterLink>
    </div>

    <template v-else>
      <ul class="card divide-y divide-line">
        <li v-for="i in cart.detailed" :key="i.productId" class="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
          <RouterLink :to="`/products/${i.product.slug}`" class="w-28 shrink-0 overflow-hidden rounded-xl">
            <ProductCover :product="i.product" size="sm" />
          </RouterLink>
          <div class="min-w-0 flex-1">
            <RouterLink :to="`/products/${i.product.slug}`" class="line-clamp-2 font-semibold">{{ i.product.title }}</RouterLink>
            <p class="mt-1 text-sm text-ink-3">{{ t('cart.unit') }}: {{ money(i.unit) }}</p>
          </div>
          <input
            :value="i.qty"
            type="number"
            min="1"
            :max="i.product.stock"
            :aria-label="t('product.qty')"
            class="input w-20 text-center"
            @change="cart.setQty(i.productId, +($event.target as HTMLInputElement).value)"
          />
          <p class="w-24 text-right font-bold text-price">{{ money(i.subtotal) }}</p>
          <button class="rounded-lg p-2 text-ink-3 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10" :aria-label="t('cart.remove')" @click="cart.remove(i.productId)">
            <Trash2 class="h-4 w-4" />
          </button>
        </li>
      </ul>
      <div class="card mt-4 p-5 sm:p-6">
        <CheckoutPanel :lines="lines" from-cart />
      </div>
    </template>
  </div>
</template>
