<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Wallet, Receipt, Package, Users, AlertTriangle } from 'lucide-vue-next'
import { adminApi } from '../../adminApi'
import type { AdminStats } from '../../types'
import { money, statusClass, statusText } from '../../components/admin/status'
import { errorText } from '../../http'

const data = ref<AdminStats | null>(null)
const error = ref('')

onMounted(async () => {
  try {
    data.value = await adminApi.stats()
  } catch (e) {
    error.value = errorText(e)
  }
})

const stats = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: '累计收入', value: money(d.revenue), sub: `今日 ${money(d.todayRevenue)}`, icon: Wallet, color: 'bg-emerald-500' },
    { label: '订单总数', value: d.orders, sub: `待发货 ${d.toShip}`, icon: Receipt, color: 'bg-brand' },
    { label: '商品数', value: d.products, sub: `库存预警 ${d.lowStock.length}`, icon: Package, color: 'bg-violet-500' },
    { label: '注册用户', value: d.users, sub: '前台账号', icon: Users, color: 'bg-amber-500' },
  ]
})

// 近 7 天收入柱状图（按支付时间统计）
const week = computed(() => {
  const days = data.value?.week ?? []
  const max = Math.max(1, ...days.map((d) => d.value))
  return days.map((d) => {
    const dt = new Date(d.date)
    return { key: d.date, label: `${dt.getMonth() + 1}/${dt.getDate()}`, value: d.value, pct: (d.value / max) * 100 }
  })
})
</script>

<template>
  <p v-if="error" role="alert" class="card p-10 text-center text-red-500">{{ error }}</p>
  <p v-else-if="!data" class="card p-10 text-center text-zinc-500">加载中…</p>
  <div v-else class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="s in stats" :key="s.label" class="card flex items-center gap-4 p-5">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white" :class="s.color"><component :is="s.icon" class="h-6 w-6" /></span>
        <div class="min-w-0">
          <p class="text-sm text-zinc-500">{{ s.label }}</p>
          <p class="truncate text-2xl font-bold">{{ s.value }}</p>
          <p class="text-xs text-zinc-400">{{ s.sub }}</p>
        </div>
      </div>
    </div>

    <div class="grid gap-6 xl:grid-cols-3">
      <section class="card p-5 xl:col-span-2">
        <h2 class="mb-4 font-bold">近 7 天收入</h2>
        <div class="flex h-48 items-end gap-3" role="img" :aria-label="week.map((d) => `${d.label} ${money(d.value)}`).join('，')">
          <div v-for="d in week" :key="d.key" class="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <span class="text-[11px] text-zinc-400">{{ d.value ? d.value.toFixed(0) : '' }}</span>
            <div class="w-full max-w-10 rounded-t-lg bg-brand/80" :style="{ height: `${Math.max(d.pct, 2)}%` }" />
            <span class="text-xs text-zinc-500">{{ d.label }}</span>
          </div>
        </div>
      </section>

      <section class="card p-5">
        <h2 class="mb-4 flex items-center gap-2 font-bold"><AlertTriangle class="h-4 w-4 text-amber-500" />库存预警</h2>
        <p v-if="!data.lowStock.length" class="text-sm text-zinc-500">库存充足</p>
        <ul v-else class="space-y-2">
          <li v-for="p in data.lowStock" :key="p.id">
            <RouterLink :to="`/admin/products/${p.id}`" class="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-white/5">
              <span class="truncate">{{ p.title }}</span>
              <span class="badge" :class="p.stock === 0 ? 'bg-red-50 text-red-600 dark:bg-red-500/15' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15'">{{ p.stock }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </div>

    <section class="card overflow-hidden">
      <div class="flex items-center justify-between p-5 pb-3">
        <h2 class="font-bold">最近订单</h2>
        <RouterLink to="/admin/orders" class="text-sm text-brand">查看全部</RouterLink>
      </div>
      <p v-if="!data.recent.length" class="px-5 pb-6 text-sm text-zinc-500">暂无订单</p>
      <div v-else class="overflow-x-auto">
        <table class="tbl">
          <thead><tr><th>订单号</th><th>邮箱</th><th>金额</th><th>状态</th><th>时间</th></tr></thead>
          <tbody>
            <tr v-for="o in data.recent" :key="o.orderNo">
              <td class="font-mono text-xs">{{ o.orderNo }}</td>
              <td>{{ o.email }}</td>
              <td class="font-semibold">{{ money(o.amount) }}</td>
              <td><span class="badge" :class="statusClass[o.status]">{{ statusText[o.status] }}</span></td>
              <td class="whitespace-nowrap text-zinc-500">{{ new Date(o.createdAt).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
