<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { User, Lock, ShieldCheck, KeyRound } from 'lucide-vue-next'
import { useAdminStore } from '../../stores/admin'
import { useSiteStore } from '../../stores/site'
import { errorText } from '../../http'

const admin = useAdminStore()
const db = useSiteStore()
const route = useRoute()
const router = useRouter()
const code = ref('')
const username = ref('')
const password = ref('')
const password2 = ref('')
const error = ref('')
const busy = ref(false)

onMounted(() => admin.check(true))

function next() {
  const r = route.query.redirect
  router.replace(typeof r === 'string' && r.startsWith('/admin') ? r : '/admin')
}

async function submit() {
  error.value = ''
  if (admin.needsSetup) {
    if (password.value.length < 8) return (error.value = '密码至少 8 位')
    if (password.value !== password2.value) return (error.value = '两次输入的密码不一致')
  }
  busy.value = true
  try {
    if (admin.needsSetup) {
      await admin.setup(code.value, username.value, password.value)
      // 首次安装后直接去配置支付
      return router.replace('/admin/payments')
    }
    await admin.login(username.value, password.value)
    next()
  } catch (e) {
    error.value = errorText(e)
    // 已被他人初始化等情况，刷新状态
    admin.check(true)
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
          <h1 class="text-xl font-bold">{{ admin.needsSetup ? '初始化后台' : '管理后台' }}</h1>
          <p class="text-xs text-zinc-500">{{ db.site.siteName }} Admin</p>
        </div>
      </div>

      <template v-if="admin.needsSetup">
        <p class="mb-4 rounded-xl bg-brand-soft p-3 text-xs leading-relaxed text-brand dark:bg-brand/15">
          首次使用，请创建管理员账号。安装码显示在服务器日志中，可运行 <code class="font-mono">docker compose logs</code> 查看。
        </p>
        <label class="label" for="a-code"><KeyRound class="h-4 w-4" />安装码</label>
        <input id="a-code" v-model="code" class="input mb-4 font-mono uppercase" placeholder="XXXX-XXXX-XXXX" autocomplete="off" required />
      </template>

      <label class="label" for="a-user"><User class="h-4 w-4" />用户名</label>
      <input id="a-user" v-model="username" class="input mb-4" autocomplete="username" required />
      <label class="label" for="a-pwd"><Lock class="h-4 w-4" />{{ admin.needsSetup ? '密码（至少 8 位）' : '密码' }}</label>
      <input id="a-pwd" v-model="password" type="password" class="input" :autocomplete="admin.needsSetup ? 'new-password' : 'current-password'" required />
      <template v-if="admin.needsSetup">
        <label class="label mt-4" for="a-pwd2"><Lock class="h-4 w-4" />确认密码</label>
        <input id="a-pwd2" v-model="password2" type="password" class="input" autocomplete="new-password" required />
      </template>

      <p v-if="error" role="alert" class="mt-3 text-sm text-red-500">{{ error }}</p>
      <button class="btn-primary mt-6 w-full" :disabled="busy">{{ admin.needsSetup ? '创建管理员并进入后台' : '登录' }}</button>
      <RouterLink to="/" class="mt-4 block text-center text-sm text-zinc-500 hover:text-brand">返回前台</RouterLink>
    </form>
  </div>
</template>
