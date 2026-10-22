<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { Mail, Lock, ShieldCheck, ArrowLeft } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import Captcha from '../components/Captcha.vue'
import { errorText } from '../http'

const props = defineProps<{ mode: 'login' | 'register' }>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const captcha = ref('')
const remember = ref(true)
const error = ref('')
const busy = ref(false)
const captchaId = ref('')
const captchaRef = ref<InstanceType<typeof Captcha>>()
const isLogin = computed(() => props.mode === 'login')

async function submit() {
  error.value = ''
  if (password.value.length < 6) return (error.value = t('auth.pwdShort'))
  busy.value = true
  try {
    const data = { email: email.value, password: password.value, captchaId: captchaId.value, captcha: captcha.value }
    await (isLogin.value ? auth.login({ ...data, remember: remember.value }) : auth.register(data))
    // 只允许站内路径，防止 ?redirect=//evil.com 跳到外站
    const r = route.query.redirect
    router.push(typeof r === 'string' && r.startsWith('/') && !r.startsWith('//') ? r : '/me')
  } catch (e) {
    // 验证码一次性使用，失败后刷新
    error.value = errorText(e)
    captcha.value = ''
    captchaRef.value?.refresh()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[70vh] items-center justify-center py-12">
    <form class="card w-full max-w-md p-8" @submit.prevent="submit">
      <h1 class="text-2xl font-bold">{{ isLogin ? t('auth.login') : t('auth.register') }}</h1>
      <p class="mt-1 text-sm text-zinc-500">{{ isLogin ? t('auth.loginSub') : t('auth.registerSub') }}</p>

      <div class="mt-6 grid gap-4">
        <div>
          <label for="ae" class="label"><Mail class="h-4 w-4" />{{ t('auth.email') }}</label>
          <input id="ae" v-model="email" type="email" autocomplete="email" class="input" :placeholder="t('auth.emailPh')" required />
        </div>
        <div>
          <label for="ap" class="label"><Lock class="h-4 w-4" />{{ t('auth.password') }}</label>
          <input
            id="ap"
            v-model="password"
            type="password"
            :autocomplete="isLogin ? 'current-password' : 'new-password'"
            class="input"
            :placeholder="t('auth.passwordPh')"
            required
          />
        </div>
        <div>
          <label for="ac" class="label"><ShieldCheck class="h-4 w-4" />{{ t('auth.captcha') }}</label>
          <div class="flex gap-3">
            <input id="ac" v-model="captcha" class="input" :placeholder="t('auth.captchaPh')" autocomplete="off" required />
            <Captcha ref="captchaRef" :title="t('auth.refresh')" @change="captchaId = $event" />
          </div>
        </div>
        <label v-if="isLogin" class="flex items-center gap-2 text-sm">
          <input v-model="remember" type="checkbox" class="accent-brand" />{{ t('auth.remember') }}
        </label>
      </div>

      <p v-if="error" role="alert" class="mt-4 text-sm text-red-500">{{ error }}</p>

      <button type="submit" class="btn-primary mt-6 w-full py-3" :disabled="busy">
        {{ isLogin ? t('auth.login') : t('auth.register') }}
      </button>

      <p class="mt-5 text-center text-sm text-zinc-500">
        {{ isLogin ? t('auth.noAccount') : t('auth.hasAccount') }}
        <RouterLink :to="isLogin ? '/auth/register' : '/auth/login'" class="font-semibold text-brand">
          {{ isLogin ? t('auth.toRegister') : t('auth.toLogin') }}
        </RouterLink>
      </p>
      <RouterLink to="/" class="mt-3 flex items-center justify-center gap-1 text-sm text-zinc-500 hover:text-brand">
        <ArrowLeft class="h-4 w-4" />{{ t('auth.backHome') }}
      </RouterLink>
    </form>
  </div>
</template>
