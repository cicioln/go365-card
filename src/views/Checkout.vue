<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Mail, Lock, CreditCard } from 'lucide-vue-next'
import { createOrder, getPaymentChannels, getProductsByIds, orderLink, unitPriceFor } from '../api'
import type { PaymentChannel, Product } from '../data/mock'
import { useCartStore } from '../stores/cart'
import { useAuthStore } from '../stores/auth'
import { money } from '../utils/money'
import { errorText } from '../http'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const cart = useCartStore()
const auth = useAuthStore()

const email = ref(auth.user ?? '')
const password = ref('')
const channels = ref<PaymentChannel[]>([])
const channelId = ref<number>(0)
const error = ref('')
const busy = ref(false)
const loading = ref(true)

// 立即购买走 query 参数，否则结算购物车
const isDirect = computed(() => route.query.pid != null)
const directProduct = ref<Product | null>(null)
const direct = computed(() => {
  const p = directProduct.value
  if (!p || p.stock <= 0) return null
  const qty = Math.max(1, Math.min(p.stock, Math.floor(Number(route.query.qty)) || 1))
  return { productId: p.id, title: p.title, qty, unit: unitPriceFor(p, qty) }
})
const lines = computed(() =>
  isDirect.value
    ? (direct.value ? [direct.value] : [])
    : cart.detailed.map((i) => ({ productId: i.productId, title: i.product.title, qty: i.qty, unit: i.unit })),
)
// 页面上的金额仅供参考，实际金额由服务端计算
const subtotal = computed(() => +lines.value.reduce((s, l) => s + l.unit * l.qty, 0).toFixed(2))
const channel = computed(() => channels.value.find((c) => c.id === channelId.value))
const fee = computed(() => +((subtotal.value * (channel.value?.feeRate ?? 0)) / 100).toFixed(2))

onMounted(async () => {
  try {
    const [chs] = await Promise.all([
      getPaymentChannels(),
      isDirect.value
        ? getProductsByIds([Number(route.query.pid)]).then((r) => void (directProduct.value = r[0] ?? null))
        : cart.refresh(),
      auth.init(),
    ])
    channels.value = chs
    if (chs.length) channelId.value = chs[0].id
    if (!email.value && auth.user) email.value = auth.user
  } catch (e) {
    error.value = errorText(e)
  } finally {
    loading.value = false
  }
  if (!error.value && !lines.value.length) router.replace('/cart')
})

async function submit() {
  error.value = ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return (error.value = t('checkout.invalidEmail'))
  if (password.value.length < 4) return (error.value = t('checkout.invalidPwd'))
  if (!channel.value) return (error.value = t('checkout.noChannel'))
  if (!lines.value.length) return router.replace('/cart')
  busy.value = true
  try {
    const order = await createOrder({
      email: email.value.trim(),
      queryPassword: password.value,
      channelId: channel.value.id,
      lines: lines.value.map((l) => ({ productId: l.productId, qty: l.qty })),
    })
    if (!isDirect.value) cart.clear()
    router.push(orderLink(order))
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl py-10">
    <h1 class="mb-6 text-3xl font-bold">{{ t('checkout.title') }}</h1>
    <p v-if="loading" class="card py-16 text-center text-zinc-500">{{ t('common.loading') }}</p>
    <form v-else class="grid gap-6" novalidate @submit.prevent="submit">
      <div class="card divide-y divide-black/5 dark:divide-white/10">
        <div v-for="l in lines" :key="l.productId" class="flex justify-between gap-4 p-4 text-sm">
          <span class="font-medium">{{ l.title }} × {{ l.qty }}</span>
          <span class="shrink-0 font-bold">{{ money(l.unit * l.qty) }}</span>
        </div>
      </div>

      <div class="card grid gap-5 p-6">
        <div>
          <label for="email" class="label"><Mail class="h-4 w-4" />{{ t('checkout.email') }}</label>
          <input id="email" v-model="email" type="email" autocomplete="email" class="input" :placeholder="t('checkout.emailPh')" required />
        </div>
        <div>
          <label for="qpwd" class="label"><Lock class="h-4 w-4" />{{ t('checkout.password') }}</label>
          <input id="qpwd" v-model="password" type="password" autocomplete="new-password" class="input" :placeholder="t('checkout.passwordPh')" required />
        </div>
        <fieldset>
          <legend class="label"><CreditCard class="h-4 w-4" />{{ t('checkout.channel') }}</legend>
          <p v-if="!channels.length" class="text-sm text-red-500">{{ t('checkout.noChannel') }}</p>
          <div class="grid gap-3 sm:grid-cols-3">
            <label
              v-for="c in channels"
              :key="c.id"
              class="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm transition"
              :class="channelId === c.id ? 'border-brand bg-brand-soft dark:bg-brand/20' : 'border-black/10 dark:border-white/10'"
            >
              <input v-model="channelId" type="radio" name="channel" :value="c.id" class="accent-brand" />
              {{ c.name }}
            </label>
          </div>
        </fieldset>
      </div>

      <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>

      <div class="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div class="text-sm text-zinc-500">
          <p>{{ t('checkout.fee') }}: {{ money(fee) }}</p>
          <p>{{ t('checkout.amount') }}: <b class="text-2xl text-price">{{ money(subtotal + fee) }}</b></p>
        </div>
        <button type="submit" class="btn-primary px-8 py-3" :disabled="busy || !lines.length">{{ t('checkout.pay') }}</button>
      </div>
    </form>
  </div>
</template>
