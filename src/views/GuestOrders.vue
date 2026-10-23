<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { lookupOrders } from '../api'
import type { Order } from '../types'
import OrderList from '../components/OrderList.vue'
import { errorText } from '../http'

const { t } = useI18n()
const keyword = ref('')
const password = ref('')
const result = ref<Order[] | null>(null)
const error = ref('')
const busy = ref(false)

async function query() {
  if (!keyword.value.trim() || !password.value) return
  error.value = ''
  busy.value = true
  try {
    result.value = await lookupOrders(keyword.value, password.value)
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl py-12">
    <div class="text-center">
      <h1 class="text-3xl font-black">{{ t('guest.title') }}</h1>
      <p class="mt-2 text-ink-3">{{ t('guest.sub') }}</p>
    </div>
    <form class="card mt-8 grid gap-4 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end" @submit.prevent="query">
      <div>
        <label for="gk" class="label">{{ t('guest.keyword') }}</label>
        <input id="gk" v-model="keyword" class="input" required />
      </div>
      <div>
        <label for="gp" class="label">{{ t('guest.password') }}</label>
        <input id="gp" v-model="password" type="password" class="input" required />
      </div>
      <button type="submit" class="btn-primary h-[46px]" :disabled="busy"><Search class="h-4 w-4" />{{ t('guest.query') }}</button>
    </form>
    <p v-if="error" role="alert" class="mt-4 text-center text-sm text-red-500">{{ error }}</p>
    <div v-if="result" class="mt-6">
      <p v-if="!result.length" class="card p-8 text-center text-ink-3">{{ t('guest.none') }}</p>
      <OrderList v-else :orders="result" />
    </div>
  </div>
</template>
