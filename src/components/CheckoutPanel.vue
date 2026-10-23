<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Mail, Lock, CreditCard, Wallet, MessageCircle, Coins, CircleCheck, ArrowRight } from 'lucide-vue-next'
import { createOrder, getPaymentChannels, orderLink, startPay } from '../api'
import { openPayWindow } from '../utils/payWindow'
import type { PaymentChannel } from '../data/mock'
import { useCartStore } from '../stores/cart'
import { useAuthStore } from '../stores/auth'
import { money } from '../utils/money'
import { errorText } from '../http'

/** 下单表单：商品详情页「立即购买」和购物车结算共用 */
const props = defineProps<{
  lines: { productId: number; qty: number; unit: number }[]
  /** 结算购物车：下单成功后清空购物车 */
  fromCart?: boolean
  disabled?: boolean
  /** 按钮文字，默认「提交订单」 */
  label?: string
  /** 手机端由页面底部固定栏提交，隐藏面板里的按钮 */
  mobileBar?: boolean
}>()

const { t } = useI18n()
const router = useRouter()
const cart = useCartStore()
const auth = useAuthStore()

const chIcon: Record<string, { icon: unknown; cls: string }> = {
  alipay: { icon: Wallet, cls: 'bg-warn-soft text-warn' },
  wechat: { icon: MessageCircle, cls: 'bg-ok-soft text-ok' },
  usdt: { icon: Coins, cls: 'bg-teal-50 text-teal-600 dark:bg-teal-500/15' },
}

const EMAIL_KEY = 'checkout-email'
function savedEmail() {
  try {
    return localStorage.getItem(EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

const root = ref<HTMLElement>()
const email = ref(auth.user ?? savedEmail())
const password = ref('')
const channels = ref<PaymentChannel[]>([])
const channelId = ref<number>(0)
const error = ref('')
const busy = ref(false)
const loaded = ref(false)

// 页面上的金额仅供参考，实际金额由服务端计算
const subtotal = computed(() => +props.lines.reduce((s, l) => s + l.unit * l.qty, 0).toFixed(2))
const channel = computed(() => channels.value.find((c) => c.id === channelId.value))
const fee = computed(() => +((subtotal.value * (channel.value?.feeRate ?? 0)) / 100).toFixed(2))
const total = computed(() => subtotal.value + fee.value)

onMounted(async () => {
  try {
    const [chs] = await Promise.all([getPaymentChannels(), auth.init()])
    channels.value = chs
    if (chs.length) channelId.value = chs[0].id
    if (!email.value && auth.user) email.value = auth.user
  } catch (e) {
    error.value = errorText(e)
  } finally {
    loaded.value = true
  }
})

function fail(msg: string) {
  error.value = msg
  root.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function submit() {
  if (busy.value || props.disabled || !props.lines.length) return
  error.value = ''
  const mail = email.value.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return fail(t('checkout.invalidEmail'))
  if (password.value.length < 4) return fail(t('checkout.invalidPwd'))
  if (!channel.value) return fail(t('checkout.noChannel'))
  busy.value = true
  // 跳网关的渠道：提交时就开新窗口（内置 USDT 在订单页扫码转账，不开窗口）
  const win = channel.value.chain ? null : openPayWindow()
  try {
    const order = await createOrder({
      email: mail,
      queryPassword: password.value,
      channelId: channel.value.id,
      lines: props.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
    })
    try {
      localStorage.setItem(EMAIL_KEY, mail)
    } catch {
      /* 无痕模式等 */
    }
    if (props.fromCart) cart.clear()
    // 当前页进入订单页等待回调到账，新窗口去支付；网关下单失败时关掉窗口，订单页可再点「去支付」
    if (win && !order.usdt) {
      try {
        const { url } = await startPay(order.orderNo, order.token)
        if (!win.go(url)) return
      } catch {
        win.close()
      }
    } else win?.close()
    router.push(orderLink(order))
  } catch (e) {
    win?.close()
    fail(errorText(e))
  } finally {
    busy.value = false
  }
}

defineExpose({ submit, total, busy })
</script>

<template>
  <form ref="root" class="grid gap-4" novalidate @submit.prevent="submit">
    <div class="grid gap-3 sm:grid-cols-2">
      <div>
        <label for="co-email" class="label"><Mail class="h-4 w-4" />{{ t('checkout.email') }}</label>
        <input id="co-email" v-model="email" type="email" autocomplete="email" class="input" :placeholder="t('checkout.emailPh')" required />
      </div>
      <div>
        <label for="co-pwd" class="label"><Lock class="h-4 w-4" />{{ t('checkout.password') }}</label>
        <input id="co-pwd" v-model="password" type="password" autocomplete="new-password" class="input" :placeholder="t('checkout.passwordPh')" minlength="4" required />
      </div>
    </div>

    <fieldset>
      <legend class="label"><CreditCard class="h-4 w-4" />{{ t('checkout.channel') }}</legend>
      <p v-if="loaded && !channels.length" class="text-sm text-red-500">{{ t('checkout.noChannel') }}</p>
      <div v-else-if="!loaded" class="grid grid-cols-2 gap-2">
        <span v-for="i in 2" :key="i" class="h-[54px] animate-pulse rounded-xl bg-surface-2" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <label
          v-for="c in channels"
          :key="c.id"
          class="flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-sm transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-zinc-500/20"
          :class="channelId === c.id ? 'border-brand bg-brand-soft dark:bg-brand/20' : 'border-line-2 hover:border-brand/40'"
        >
          <input v-model="channelId" type="radio" name="channel" :value="c.id" class="sr-only" />
          <img v-if="c.icon" :src="c.icon" alt="" class="h-8 w-8 shrink-0 rounded-lg object-contain" />
          <span v-else class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" :class="chIcon[c.type]?.cls">
            <component :is="chIcon[c.type]?.icon ?? CreditCard" class="h-4 w-4" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">{{ c.name }}</span>
            <span v-if="c.feeRate" class="block text-xs text-ink-3">{{ t('checkout.fee') }} {{ c.feeRate }}%</span>
          </span>
          <CircleCheck v-if="channelId === c.id" class="h-4 w-4 shrink-0 text-ink" />
        </label>
      </div>
    </fieldset>

    <div class="grid gap-1 border-t border-dashed border-line-2 pt-4 text-sm">
      <div class="flex items-center justify-between text-ink-3">
        <span><slot name="subtotal-label">{{ t('cart.total') }}</slot></span>
        <span class="font-mono">{{ money(subtotal) }}</span>
      </div>
      <div v-if="fee > 0" class="flex items-center justify-between text-ink-3">
        <span>{{ t('checkout.fee') }} ({{ channel?.feeRate }}%)</span>
        <span class="font-mono">+{{ money(fee) }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-ink-2">{{ t('checkout.amount') }}</span>
        <b class="font-mono text-[22px]">{{ money(total) }}</b>
      </div>
    </div>

    <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>

    <div class="gap-2" :class="mobileBar ? 'hidden md:flex' : 'flex'">
      <button type="submit" class="btn-primary h-[50px] flex-1 text-[15px]" :disabled="busy || disabled || !lines.length">
        {{ label ?? t('checkout.pay') }}<ArrowRight v-if="!disabled" class="h-4 w-4" />
      </button>
      <slot name="actions" />
    </div>
  </form>
</template>
