<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard, Package, FolderTree, Receipt, FileText, CreditCard, Users, Settings,
  LogOut, Menu, X, Sun, Moon, ExternalLink,
} from 'lucide-vue-next'
import { useAdminStore } from '../../stores/admin'
import { useUiStore } from '../../stores/ui'
import { useSiteStore } from '../../stores/site'

const admin = useAdminStore()
const db = useSiteStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const open = ref(false)
watch(() => route.fullPath, () => (open.value = false))

const menu = [
  { to: '/admin', label: '仪表盘', icon: LayoutDashboard, exact: true },
  { to: '/admin/products', label: '商品管理', icon: Package },
  { to: '/admin/categories', label: '分类管理', icon: FolderTree },
  { to: '/admin/orders', label: '订单管理', icon: Receipt },
  { to: '/admin/posts', label: '文章管理', icon: FileText },
  { to: '/admin/payments', label: '支付渠道', icon: CreditCard },
  { to: '/admin/users', label: '用户管理', icon: Users },
  { to: '/admin/settings', label: '系统设置', icon: Settings },
]

const isActive = (m: (typeof menu)[number]) => (m.exact ? route.path === m.to : route.path.startsWith(m.to))

async function logout() {
  await admin.logout()
  router.replace('/admin/login')
}
</script>

<template>
  <div class="flex min-h-screen">
    <!-- 侧边栏 -->
    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-black/5 bg-white transition-transform lg:translate-x-0 dark:border-white/10 dark:bg-zinc-950"
      :class="open ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-16 items-center gap-2.5 px-5">
        <img src="/logo.svg" alt="" class="h-8 w-8 dark:invert" />
        <span class="truncate font-bold">{{ db.site.siteName }} 后台</span>
        <button class="btn-icon ml-auto lg:hidden" aria-label="关闭菜单" @click="open = false"><X class="h-5 w-5" /></button>
      </div>
      <nav aria-label="后台菜单" class="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <RouterLink
          v-for="m in menu"
          :key="m.to"
          :to="m.to"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
          :class="isActive(m) ? 'bg-brand-soft text-brand dark:bg-brand/15' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5'"
          :aria-current="isActive(m) ? 'page' : undefined"
        >
          <component :is="m.icon" class="h-[18px] w-[18px]" />{{ m.label }}
        </RouterLink>
      </nav>
      <div class="border-t border-black/5 p-3 dark:border-white/10">
        <RouterLink to="/" target="_blank" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5">
          <ExternalLink class="h-[18px] w-[18px]" />访问前台
        </RouterLink>
      </div>
    </aside>
    <div v-if="open" class="fixed inset-0 z-30 bg-black/30 lg:hidden" aria-hidden="true" @click="open = false" />

    <div class="flex min-w-0 flex-1 flex-col lg:pl-60">
      <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-black/5 bg-white/80 px-4 backdrop-blur sm:px-6 dark:border-white/10 dark:bg-zinc-950/80">
        <button class="btn-icon lg:hidden" aria-label="打开菜单" @click="open = true"><Menu class="h-5 w-5" /></button>
        <h1 class="text-lg font-bold">{{ route.meta.title }}</h1>
        <div class="ml-auto flex items-center gap-1">
          <button class="btn-icon" :aria-label="ui.dark ? '浅色模式' : '深色模式'" @click="ui.toggleTheme()">
            <Sun v-if="ui.dark" class="h-5 w-5" /><Moon v-else class="h-5 w-5" />
          </button>
          <span class="hidden px-2 text-sm text-zinc-500 sm:inline">{{ admin.username }}</span>
          <button class="btn-icon" aria-label="退出登录" @click="logout"><LogOut class="h-5 w-5" /></button>
        </div>
      </header>
      <main class="flex-1 p-4 sm:p-6">
        <!-- 按路径重建页面，避免 /products/42 与 /products/new 之间复用旧表单 -->
        <RouterView :key="route.path" />
      </main>
    </div>
  </div>
</template>
