<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Check, Clock, RefreshCw, Send, CircleAlert, X } from 'lucide-vue-next'
import { getOrder, startPay } from '../api'
import type { Order } from '../types'
import { money } from '../utils/money'
import { errorText } from '../http'
import { useSiteStore } from '../stores/site'
import UsdtPay from '../components/UsdtPay.vue'
import CardList from '../components/CardList.vue'

const { t } = useI18n()
const route = useRoute()
const db = useSiteStore()
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
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString() : '')
const time = (s: string | null) => (s ? new Date(s).toLocaleTimeString() : '')

/** 顶部状态：图标、标题、颜色 */
const head = computed(() => {
  switch (order.value?.status) {
    case 'delivered': return { icon: Check, title: t('order.headDelivered'), cls: 'bg-ok-soft text-ok' }
    case 'paid': return { icon: RefreshCw, title: t('order.headPaid'), cls: 'bg-warn-soft text-warn' }
    case 'closed': return { icon: X, title: t('order.headClosed'), cls: 'bg-surface-2 text-ink-3' }
    default: return { icon: Clock, title: t('order.headPending'), cls: 'bg-accent-soft text-accent' }
  }
})

/** 时间线：下单 → 付款 → 发货 */
const steps = computed(() => {
  const o = order.value
  if (!o) return []
  return [
    { label: t('order.stepCreated'), at: time(o.createdAt), done: true },
    { label: t('order.stepPaid'), at: time(o.paidAt), done: !!o.paidAt },
    { label: t('order.stepDelivered'), at: '', done: o.status === 'delivered' },
  ]
})

const statusChip = {
  pending: 'bg-accent-soft text-accent',
  paid: 'bg-warn-soft text-warn',
  delivered: 'bg-ok-soft text-ok',
  closed: 'bg-surface-2 text-ink-3',
}
</script>

<template>
  <div class="py-7">
    <p v-if="loading" class="card p-10 text-center text-ink-3">{{ t('common.loading') }}</p>
    <div v-else-if="!order" class="card mx-auto max-w-xl p-10 text-center text-ink-3">
      <p>{{ loadError || t('order.notFound') }}</p>
      <RouterLink to="/guest/orders" class="btn-ghost mt-4">{{ t('nav.guestOrders') }}</RouterLink>
    </div>

    <div v-else class="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <div class="min-w-0">
        <section class="card">
          <div class="flex flex-wrap items-center gap-4 p-5 sm:flex-nowrap sm:gap-5 sm:p-7">
            <span class="grid h-14 w-14 shrink-0 place-items-center rounded-[18px]" :class="head.cls">
              <component :is="head.icon" class="h-7 w-7" :class="{ 'animate-spin [animation-duration:3s]': order.status === 'paid' }" />
            </span>
            <div class="min-w-0 flex-1">
              <h1 class="text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">{{ head.title }}</h1>
              <p class="text-ink-3">{{ t('order.no') }} <span class="font-mono break-all">{{ order.orderNo }}</span> · {{ fmt(order.createdAt) }}</p>
            </div>
            <span class="chip" :class="statusChip[order.status]"><span class="h-1.5 w-1.5 rounded-full bg-current" />{{ t(`order.${order.status}`) }}</span>
          </div>
          <ol v-if="order.status !== 'closed'" class="grid grid-cols-3 px-5 pb-6 sm:px-7">
            <li v-for="s in steps" :key="s.label" class="step relative pt-[18px] text-[12.5px] text-ink-3" :class="{ done: s.done }">
              <b class="block text-[13px]" :class="s.done ? 'text-ink' : 'text-ink-3'">{{ s.label }}</b><span class="font-mono">{{ s.at }}</span>
            </li>
          </ol>
        </section>

        <UsdtPay v-if="order.status === 'pending' && order.usdt" :usdt="order.usdt" :expires-at="order.expiresAt" />
        <div v-else-if="order.status === 'pending'" class="card mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
          <p class="text-sm text-ink-2">{{ t('order.payHint', { time: new Date(order.expiresAt).toLocaleTimeString() }) }}</p>
          <button class="btn-primary" :disabled="paying" @click="pay">{{ t('order.payNow') }}</button>
          <p v-if="payError" role="alert" class="w-full text-sm text-red-500">{{ payError }}</p>
        </div>
        <p v-else-if="order.status === 'paid'" role="status" class="card mt-4 flex items-center gap-2 p-5 text-sm text-ink-2">
          <RefreshCw class="h-4 w-4 shrink-0 animate-spin text-warn [animation-duration:3s]" />{{ t('order.waitManual') }}
        </p>
        <p v-else-if="order.status === 'closed'" class="card mt-4 p-5 text-sm text-ink-3">{{ t('order.closedHint') }}</p>

        <CardList v-if="hasCards" :order="order" />
      </div>

      <aside class="card p-[22px]">
        <h2 class="mb-3 text-sm font-extrabold">{{ t('order.info') }}</h2>
        <dl class="grid gap-2.5 text-[13px]">
          <div v-for="l in order.lines" :key="l.id" class="flex justify-between gap-2.5">
            <dt class="min-w-0 text-ink-3">{{ l.title }}</dt>
            <dd class="shrink-0 text-right font-mono font-semibold">{{ money(l.unit) }} × {{ l.qty }}</dd>
          </div>
          <div class="flex justify-between gap-2.5"><dt class="text-ink-3">{{ t('checkout.channel') }}</dt><dd class="text-right font-semibold">{{ order.channel }}</dd></div>
          <div class="flex justify-between gap-2.5"><dt class="text-ink-3">{{ t('checkout.email') }}</dt><dd class="min-w-0 text-right font-semibold break-all">{{ order.email }}</dd></div>
          <div v-if="order.fee" class="flex justify-between gap-2.5"><dt class="text-ink-3">{{ t('checkout.fee') }}</dt><dd class="font-mono font-semibold">{{ money(order.fee) }}</dd></div>
        </dl>
        <div class="my-4 h-px bg-line" />
        <div class="flex items-center justify-between text-[13px]">
          <span class="text-ink-3">{{ order.status === 'pending' ? t('checkout.amount') : t('order.paidAmount') }}</span>
          <b class="price text-xl">{{ money(order.amount) }}</b>
        </div>
        <div class="my-4 h-px bg-line" />
        <div class="flex gap-3 rounded-[14px] bg-accent-soft px-4 py-3.5 text-[12.5px]">
          <CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-accent" /><p>{{ t('order.saveHint') }}</p>
        </div>
        <a v-if="db.site.telegram" :href="db.site.telegram" target="_blank" rel="noopener" class="btn-ghost mt-3.5 h-[42px] w-full"><Send class="h-4 w-4" />{{ t('order.support') }}</a>
        <RouterLink to="/products" class="btn-ink mt-2 w-full">{{ t('order.continue') }}</RouterLink>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.step::before { content: ''; position: absolute; top: 4px; left: 0; right: 0; height: 2px; background: var(--line); }
.step::after { content: ''; position: absolute; top: 0; left: 0; width: 10px; height: 10px; border-radius: 99px; background: var(--line-2); box-shadow: 0 0 0 3px var(--surface); }
.step.done::before, .step.done::after { background: var(--ok); }
</style>
