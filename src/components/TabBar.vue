<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { House, LayoutGrid, ShoppingCart, ClipboardList } from 'lucide-vue-next'
import { useCartStore } from '../stores/cart'

// 手机端底部导航，替代汉堡菜单
const { t } = useI18n()
const cart = useCartStore()
const tabs = [
  { to: '/', key: 'home', icon: House, exact: true },
  { to: '/products', key: 'tabProducts', icon: LayoutGrid },
  { to: '/cart', key: 'cart', icon: ShoppingCart, badge: true },
  { to: '/guest/orders', key: 'tabOrders', icon: ClipboardList },
]
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface/92 px-2 pt-2 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
    aria-label="Tabs"
  >
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="relative flex flex-col items-center gap-[3px] text-[10.5px] font-bold text-ink-3"
      :exact-active-class="tab.exact ? '!text-ink' : ''"
      :active-class="tab.exact ? '' : '!text-ink'"
    >
      <component :is="tab.icon" class="h-[21px] w-[21px]" :stroke-width="1.9" />
      <em
        v-if="tab.badge && cart.count"
        class="absolute -top-[3px] left-[52%] h-[15px] min-w-[15px] rounded-full bg-accent px-[3px] text-center font-mono text-[9px] leading-[15px] font-bold text-white not-italic"
      >{{ cart.count }}</em>
      {{ t(`nav.${tab.key}`) }}
    </RouterLink>
  </nav>
</template>
