<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, RefreshCw } from 'lucide-vue-next'
import QRCode from 'qrcode'
import type { Order } from '../types'
import { useUiStore } from '../stores/ui'

// 内置 USDT 收款：展示收款地址二维码与唯一金额，链上到账后订单页自动刷新
const props = defineProps<{ usdt: NonNullable<Order['usdt']>; expiresAt: string }>()
const { t } = useI18n()
const ui = useUiStore()
const qr = ref('')

watch(
  () => props.usdt.address,
  async (address) => {
    // 二维码只放地址：各钱包对带金额的支付链接支持不一，金额由买家手动填写
    qr.value = await QRCode.toDataURL(address, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
  },
  { immediate: true },
)

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ui.notify(t('order.copied'))
  } catch {
    /* 剪贴板不可用时忽略 */
  }
}
</script>

<template>
  <div class="card mt-4 p-5">
    <h2 class="font-bold">{{ t('usdt.title') }}</h2>
    <div class="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <img v-if="qr" :src="qr" :alt="t('usdt.qrAlt')" class="h-48 w-48 shrink-0 rounded-xl bg-white p-2 ring-1 ring-black/5" />
      <dl class="grid w-full min-w-0 gap-3 text-sm">
        <div>
          <dt class="text-zinc-500">{{ t('usdt.network') }}</dt>
          <dd class="font-bold">{{ usdt.network }}</dd>
        </div>
        <div>
          <dt class="text-zinc-500">{{ t('usdt.amount') }}</dt>
          <dd class="flex items-center gap-2">
            <span class="font-mono text-2xl font-bold text-price">{{ usdt.amount }}</span><span class="font-bold">USDT</span>
            <button class="text-brand" :aria-label="t('usdt.copyAmount')" @click="copy(usdt.amount)"><Copy class="h-4 w-4" /></button>
          </dd>
        </div>
        <div>
          <dt class="text-zinc-500">{{ t('usdt.address') }}</dt>
          <dd class="flex items-start gap-2">
            <span class="min-w-0 font-mono break-all">{{ usdt.address }}</span>
            <button class="mt-0.5 shrink-0 text-brand" :aria-label="t('usdt.copyAddress')" @click="copy(usdt.address)"><Copy class="h-4 w-4" /></button>
          </dd>
        </div>
      </dl>
    </div>
    <ul class="mt-4 list-disc space-y-1 rounded-xl bg-amber-50 py-3 pr-3 pl-7 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
      <li>{{ t('usdt.exact', { amount: usdt.amount }) }}</li>
      <li>{{ t('usdt.chainOnly', { network: usdt.network }) }}</li>
      <li>{{ t('usdt.deadline', { time: new Date(expiresAt).toLocaleTimeString() }) }}</li>
    </ul>
    <p role="status" class="mt-3 flex items-center gap-2 text-sm text-zinc-500">
      <RefreshCw class="h-4 w-4 shrink-0 animate-spin [animation-duration:3s]" />{{ t('usdt.waiting') }}
    </p>
  </div>
</template>
