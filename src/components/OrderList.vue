<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Order } from '../types'
import { orderLink } from '../api'
import { money } from '../utils/money'

defineProps<{ orders: Order[] }>()
const { t } = useI18n()
</script>

<template>
  <ul class="card divide-y divide-black/5 dark:divide-white/10">
    <li v-for="o in orders" :key="o.orderNo">
      <RouterLink :to="orderLink(o)" class="flex flex-wrap items-center justify-between gap-2 p-4 text-sm hover:bg-black/[0.02] dark:hover:bg-white/5">
        <span class="font-mono font-bold">{{ o.orderNo }}</span>
        <span class="text-zinc-500">{{ o.lines.map((l) => l.title).join('，') }}</span>
        <span class="font-bold text-price">{{ money(o.amount) }}</span>
        <span class="text-xs font-semibold">{{ t(`order.${o.status}`) }}</span>
      </RouterLink>
    </li>
  </ul>
</template>
