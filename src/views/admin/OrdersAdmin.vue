<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Search, Eye, Trash2, Download, XCircle } from 'lucide-vue-next'
import { adminApi } from '../../adminApi'
import type { Order, OrderStatus } from '../../types'
import { useUiStore } from '../../stores/ui'
import { money, statusClass, statusText } from '../../components/admin/status'
import AdminModal from '../../components/admin/AdminModal.vue'
import { errorText } from '../../http'
import { splitCards } from '../../utils/cards'

const ui = useUiStore()
const list = ref<Order[]>([])
const counts = ref<Partial<Record<OrderStatus, number>>>({})
const loading = ref(true)
const keyword = ref('')
const status = ref<'' | OrderStatus>('')
const viewing = ref<Order | null>(null)
/** 按商品行填写的人工发货内容 */
const cardsInput = ref<Record<number, string>>({})
const busy = ref(false)

const tabs: { value: '' | OrderStatus; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'pending', label: statusText.pending },
  { value: 'paid', label: statusText.paid },
  { value: 'delivered', label: statusText.delivered },
  { value: 'closed', label: statusText.closed },
]
const countOf = (s: '' | OrderStatus) => (s ? counts.value[s] ?? 0 : Object.values(counts.value).reduce((a, b) => a + (b ?? 0), 0))

async function load() {
  try {
    const r = await adminApi.orders(status.value, keyword.value)
    list.value = r.list
    counts.value = r.counts
  } catch (e) {
    ui.notify(errorText(e))
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(status, load)
let timer: number | undefined
watch(keyword, () => {
  clearTimeout(timer)
  timer = window.setTimeout(load, 300)
})

// 发货内容：只需 1 条时整段作为一条（可以多行）；多条时有空行就按空行分隔，否则每行一条
const parse = (s = '', qty = 1) => {
  if (qty === 1) {
    const one = splitCards(s, 'line').join('\n')
    return one ? [one] : []
  }
  return splitCards(s, /\n[ \t]*\n/.test(s.trim()) ? 'blank' : 'line')
}

async function view(o: Order) {
  cardsInput.value = {}
  try {
    viewing.value = await adminApi.order(o.orderNo)
  } catch (e) {
    ui.notify(errorText(e))
  }
}

async function act(fn: () => Promise<unknown>, msg: string) {
  busy.value = true
  try {
    await fn()
    ui.notify(msg)
    if (viewing.value) viewing.value = await adminApi.order(viewing.value.orderNo).catch(() => null)
    load()
  } catch (e) {
    ui.notify(errorText(e))
  } finally {
    busy.value = false
  }
}

function markPaid() {
  if (!confirm('确认已在支付平台核实到账？标记后将自动发出卡密。')) return
  act(() => adminApi.markPaid(viewing.value!.orderNo), '已标记为支付')
}

const deliver = (lineId: number) =>
  act(() => adminApi.deliver(viewing.value!.orderNo, lineId, parse(cardsInput.value[lineId], viewing.value!.lines.find((l) => l.id === lineId)?.qty)), '已发货')

function closeOrder(o: Order) {
  if (!confirm(`关闭订单 ${o.orderNo}？锁定的库存会被释放。`)) return
  act(() => adminApi.closeOrder(o.orderNo), '订单已关闭')
}

function remove(o: Order) {
  if (!confirm(`确定删除订单 ${o.orderNo}？`)) return
  act(async () => {
    await adminApi.deleteOrder(o.orderNo)
    if (viewing.value?.orderNo === o.orderNo) viewing.value = null
  }, '已删除')
}

// 导出当前筛选结果为 CSV
function exportCsv() {
  // 以 = + - @ 开头的单元格会被 Excel 当公式执行，前置单引号转为纯文本
  const esc = (v: string | number) => {
    const s = typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }
  const rows = [['订单号', '邮箱', '商品', '金额', '手续费', '支付方式', '状态', '下单时间', '支付时间']].concat(
    list.value.map((o) => [
      o.orderNo, o.email, o.lines.map((l) => `${l.title}×${l.qty}`).join('; '),
      o.amount.toFixed(2), o.fee.toFixed(2), o.channel, statusText[o.status],
      new Date(o.createdAt).toLocaleString(), o.paidAt ? new Date(o.paidAt).toLocaleString() : '',
    ]),
  )
  const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `orders-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div class="card overflow-hidden">
    <div class="flex flex-wrap items-center gap-3 p-4">
      <div class="flex flex-wrap rounded-xl bg-zinc-100 p-1 dark:bg-white/5" role="tablist" aria-label="订单状态">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          role="tab"
          :aria-selected="status === tab.value"
          class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
          :class="status === tab.value ? 'bg-white shadow-sm dark:bg-zinc-800' : 'text-zinc-500'"
          @click="status = tab.value"
        >
          {{ tab.label }} <span class="text-xs text-zinc-400">{{ countOf(tab.value) }}</span>
        </button>
      </div>
      <div class="relative w-full sm:w-64">
        <Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input v-model="keyword" class="input pl-9" placeholder="订单号 / 邮箱" aria-label="搜索订单" />
      </div>
      <button class="btn-ghost ml-auto" :disabled="!list.length" @click="exportCsv"><Download class="h-4 w-4" />导出 CSV</button>
    </div>
    <div class="overflow-x-auto">
      <table class="tbl">
        <thead><tr><th>订单号</th><th>邮箱</th><th>商品</th><th>金额</th><th>支付方式</th><th>状态</th><th>时间</th><th class="text-right">操作</th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="8" class="py-10 text-center text-zinc-500">加载中…</td></tr>
          <tr v-else-if="!list.length"><td colspan="8" class="py-10 text-center text-zinc-500">暂无订单</td></tr>
          <tr v-for="o in list" :key="o.orderNo">
            <td class="font-mono text-xs whitespace-nowrap">{{ o.orderNo }}</td>
            <td>{{ o.email }}</td>
            <td class="max-w-56"><p class="truncate">{{ o.lines.map((l) => `${l.title} ×${l.qty}`).join('，') }}</p></td>
            <td class="font-semibold">{{ money(o.amount) }}</td>
            <td class="whitespace-nowrap">{{ o.channel }}</td>
            <td><span class="badge" :class="statusClass[o.status]">{{ statusText[o.status] }}</span></td>
            <td class="whitespace-nowrap text-zinc-500">{{ new Date(o.createdAt).toLocaleString() }}</td>
            <td>
              <div class="flex justify-end gap-1">
                <button class="btn-icon" aria-label="查看" @click="view(o)"><Eye class="h-4 w-4" /></button>
                <button v-if="o.status === 'pending'" class="btn-icon hover:text-amber-500" aria-label="关闭订单" :disabled="busy" @click="closeOrder(o)"><XCircle class="h-4 w-4" /></button>
                <button v-if="o.status === 'pending' || o.status === 'closed'" class="btn-icon hover:text-red-500" aria-label="删除" :disabled="busy" @click="remove(o)"><Trash2 class="h-4 w-4" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <AdminModal v-if="viewing" title="订单详情" wide @close="viewing = null">
    <dl class="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt class="text-zinc-500">订单号</dt><dd class="font-mono font-bold">{{ viewing.orderNo }}</dd></div>
      <div><dt class="text-zinc-500">状态</dt><dd><span class="badge" :class="statusClass[viewing.status]">{{ statusText[viewing.status] }}</span></dd></div>
      <div><dt class="text-zinc-500">邮箱</dt><dd>{{ viewing.email }}</dd></div>
      <div><dt class="text-zinc-500">下单时间</dt><dd>{{ new Date(viewing.createdAt).toLocaleString() }}</dd></div>
      <div><dt class="text-zinc-500">支付方式</dt><dd>{{ viewing.channel }}（手续费 {{ money(viewing.fee) }}）</dd></div>
      <div><dt class="text-zinc-500">实付</dt><dd class="font-bold text-price">{{ money(viewing.amount) }}</dd></div>
      <div v-if="viewing.usdt" class="sm:col-span-2"><dt class="text-zinc-500">USDT 收款</dt><dd class="font-mono break-all">{{ viewing.usdt.amount }} USDT · {{ viewing.usdt.network }} · {{ viewing.usdt.address }}</dd></div>
      <div v-if="viewing.tradeNo" class="sm:col-span-2"><dt class="text-zinc-500">支付流水 / 交易哈希</dt><dd class="font-mono break-all">{{ viewing.tradeNo }}</dd></div>
      <div v-if="viewing.paidAt"><dt class="text-zinc-500">支付时间</dt><dd>{{ new Date(viewing.paidAt).toLocaleString() }}</dd></div>
    </dl>
    <ul class="mt-4 divide-y divide-black/5 rounded-xl border border-black/5 text-sm dark:divide-white/10 dark:border-white/10">
      <li v-for="l in viewing.lines" :key="l.id" class="p-3">
        <div class="flex justify-between gap-4">
          <span>
            {{ l.title }} × {{ l.qty }}
            <span class="badge ml-1" :class="l.fulfillment === 'manual' ? 'bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15'">
              {{ l.fulfillment === 'manual' ? '人工' : '自动' }}
            </span>
          </span>
          <span class="shrink-0 font-semibold">{{ money(l.unit * l.qty) }}</span>
        </div>
        <ul v-if="l.cards.length" class="mt-2 grid gap-1.5 font-mono text-xs">
          <li v-for="(c, j) in l.cards" :key="j" class="rounded-lg bg-zinc-50 px-3 py-2 whitespace-pre-wrap break-all dark:bg-zinc-800">{{ c }}</li>
        </ul>
        <form v-else-if="viewing.status === 'paid' && !l.delivered" class="mt-2" @submit.prevent="deliver(l.id)">
          <label class="label" :for="`o-cards-${l.id}`">
            {{ l.fulfillment === 'auto' ? '卡密库存不足，请手动补发' : '人工发货' }}（{{ l.qty > 1 ? '多行卡密之间空一行，' : '' }}共需 {{ l.qty }} 条，当前 {{ parse(cardsInput[l.id], l.qty).length }} 条）
          </label>
          <textarea :id="`o-cards-${l.id}`" v-model="cardsInput[l.id]" rows="3" class="input font-mono text-xs" placeholder="卡密 / 账号密码 / 兑换链接" />
          <div class="mt-2 flex justify-end"><button class="btn-primary py-2" :disabled="busy || parse(cardsInput[l.id], l.qty).length !== l.qty">确认发货</button></div>
        </form>
      </li>
    </ul>

    <div v-if="viewing.status === 'pending'" class="mt-5 flex flex-wrap items-center justify-end gap-2">
      <p class="mr-auto text-xs text-zinc-500">正常情况下由支付网关回调自动确认，仅在核实线下到账时手动标记</p>
      <button class="btn-ghost" :disabled="busy" @click="closeOrder(viewing)">关闭订单</button>
      <button class="btn-primary" :disabled="busy" @click="markPaid">标记为已支付</button>
    </div>
  </AdminModal>
</template>
