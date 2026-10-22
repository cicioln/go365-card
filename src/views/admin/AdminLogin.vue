<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { User, Lock, ShieldCheck } from 'lucide-vue-next'
import { useAdminStore } from '../../stores/admin'
import { useSiteStore } from '../../stores/site'
import { errorText } from '../../http'

const admin = useAdminStore()
const db = useSiteStore()
const route = useRoute()
const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await admin.login(username.value, password.value)
    const r = route.query.redirect
    router.replace(typeof r === 'string' && r.startsWith('/admin') ? r : '/admin')
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-10">
    <form class="card w-full max-w-sm p-8" @submit.prevent="submit">
      <div class="mb-6 flex items-center gap-3">
        <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white"><ShieldCheck class="h-6 w-6" /></span>
        <div>
          <h1 class="text-xl font-bold">管理后台</h1>
          <p class="text-xs text-zinc-500">{{ db.site.siteName }} Admin</p>
        </div>
      </div>
      <label class="label" for="a-user"><User class="h-4 w-4" />用户名</label>
      <input id="a-user" v-model="username" class="input mb-4" autocomplete="username" required />
      <label class="label" for="a-pwd"><Lock class="h-4 w-4" />密码</label>
      <input id="a-pwd" v-model="password" type="password" class="input" autocomplete="current-password" required />
      <p v-if="error" role="alert" class="mt-3 text-sm text-red-500">{{ error }}</p>
      <button class="btn-primary mt-6 w-full" :disabled="busy">登录</button>
      <RouterLink to="/" class="mt-4 block text-center text-sm text-zinc-500 hover:text-brand">返回前台</RouterLink>
    </form>
  </div>
</template>
