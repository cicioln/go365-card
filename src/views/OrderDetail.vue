<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { RefreshCw } from 'lucide-vue-next'
import { getOrder, startPay } from '../api'
import type { Order } from '../types'
import { money } from '../utils/money'
import { errorText } from '../http'
import UsdtPay from '../components/UsdtPay.vue'
import CardList from '../components/CardList.vue'

const { t } = useI18n()
const route = useRoute()
const order = ref<Order | null>(null)
const loading = ref(true)
const loadError = ref('')
const payError = ref('')
const paying = ref(false)
const token = computed(() => (typeof route.query.t === 'string' ? route.query.t : undefined))
let timer: number | undefined

async function load(silent = false) {
  if (!silent) loading.value = true
  try {
    order.value = await getOrder(String(route.params.no), token.value)
    loadError.value = ''
  } catch (e) {
    if (!silent) {
      order.value = null
      loadError.value = errorText(e)
    }
  } finally {
    loading.value = false
  }
  // 待支付 / 待人工发货时定时刷新，支付网关回调确认后页面自动更新
  clearTimeout(timer)
  if (order.value && (order.value.status === 'pending' || order.value.status === 'paid'))
    timer = window.setTimeout(() => load(true), order.value.status === 'pending' ? 4000 : 15000)
}

watch(() => route.fullPath, () => load(), { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

async function pay() {
  payError.value = ''
  paying.value = true
  try {
    const { url } = await startPay(order.value!.orderNo, token.value ?? order.value!.token)
    window.location.href = url
  } catch (e) {
    payError.value = errorText(e)
    paying.value = false
    load(true)
  }
}

const hasCards = computed(() => !!order.value?.lines.some((l) => l.cards.length))

const statusClass = {
  pending: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15',
  paid: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15',
  delivered: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15',
  closed: 'bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400',
}
</script>

<template>
  <div class="mx-auto max-w-3xl py-10">
    <h1 class="mb-6 text-3xl font-bold">{{ t('order.title') }}</h1>
    <p v-if="loading" class="card p-10 text-center text-zinc-500">{{ t('common.loading') }}</p>
    <div v-else-if="!order" class="card p-10 text-center text-zinc-500">
      <p>{{ loadError || t('order.notFound') }}</p>
      <RouterLink to="/guest/orders" class="btn-ghost mt-4">{{ t('nav.guestOrders') }}</RouterLink>
    </div>
    <template v-else>
      <dl class="card grid gap-3 p-6 text-sm sm:grid-cols-2">
        <div><dt class="text-zinc-500">{{ t('order.no') }}</dt><dd class="font-mono font-bold break-all">{{ order.orderNo }}</dd></div>
        <div>
          <dt class="text-zinc-500">{{ t('order.status') }}</dt>
          <dd><span class="rounded-md px-2 py-0.5 text-xs font-bold" :class="statusClass[order.status]">{{ t(`order.${order.status}`) }}</span></dd>
        </div>
        <div><dt class="text-zinc-500">{{ t('checkout.email') }}</dt><dd class="break-all">{{ order.email }}</dd></div>
        <div><dt class="text-zinc-500">{{ t('order.created') }}</dt><dd>{{ new Date(order.createdAt).toLocaleString() }}</dd></div>
        <div><dt class="text-zinc-500">{{ t('checkout.channel') }}</dt><dd>{{ order.channel }}</dd></div>
        <div><dt class="text-zinc-500">{{ t('checkout.amount') }}</dt><dd class="font-bold text-price">{{ money(order.amount) }}</dd></div>
      </dl>

      <ul class="card mt-4 divide-y divide-black/5 dark:divide-white/10">
        <li v-for="l in order.lines" :key="l.id" class="flex justify-between gap-4 p-4 text-sm">
          <span>{{ l.title }} × {{ l.qty }}</span><span class="shrink-0 font-bold">{{ money(l.unit * l.qty) }}</span>
        </li>
      </ul>

      <UsdtPay v-if="order.status === 'pending' && order.usdt" :usdt="order.usdt" :expires-at="order.expiresAt" />
      <div v-else-if="order.status === 'pending'" class="card mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
        <p class="text-sm text-zinc-500">{{ t('order.payHint', { time: new Date(order.expiresAt).toLocaleTimeString() }) }}</p>
        <button class="btn-primary" :disabled="paying" @click="pay">{{ t('order.payNow') }}</button>
        <p v-if="payError" role="alert" class="w-full text-sm text-red-500">{{ payError }}</p>
      </div>
      <p v-else-if="order.status === 'paid'" role="status" class="card mt-4 flex items-center gap-2 p-5 text-sm text-sky-600 dark:text-sky-400">
        <RefreshCw class="h-4 w-4 shrink-0 animate-spin [animation-duration:3s]" />{{ t('order.waitManual') }}
      </p>
      <p v-else-if="order.status === 'closed'" class="card mt-4 p-5 text-sm text-zinc-500">{{ t('order.closedHint') }}</p>

      <CardList v-if="hasCards" :order="order" />
    </template>
  </div>
</template>
