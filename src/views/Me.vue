<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { UserRound, LogOut } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { getMyOrders } from '../api'
import type { Order } from '../types'
import OrderList from '../components/OrderList.vue'
import { errorText } from '../http'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const mine = ref<Order[] | null>(null)
const error = ref('')

onMounted(async () => {
  try {
    mine.value = await getMyOrders()
  } catch (e) {
    error.value = errorText(e)
  }
})

async function logout() {
  await auth.logout()
  router.push('/')
}
</script>

<template>
  <div class="mx-auto max-w-3xl py-10">
    <div class="card flex items-center gap-4 p-6">
      <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand dark:bg-brand/20"><UserRound class="h-7 w-7" /></span>
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-bold">{{ t('me.title') }}</h1>
        <p class="truncate text-sm text-ink-3">{{ auth.user }}</p>
      </div>
      <button class="btn-ghost" @click="logout"><LogOut class="h-4 w-4" />{{ t('nav.logout') }}</button>
    </div>
    <h2 class="mb-3 mt-8 text-lg font-bold">{{ t('me.orders') }}</h2>
    <p v-if="error" role="alert" class="card p-8 text-center text-red-500">{{ error }}</p>
    <p v-else-if="!mine" class="card p-8 text-center text-ink-3">{{ t('common.loading') }}</p>
    <p v-else-if="!mine.length" class="card p-8 text-center text-ink-3">{{ t('me.none') }}</p>
    <OrderList v-else :orders="mine" />
  </div>
</template>
