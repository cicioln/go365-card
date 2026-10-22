import { defineStore } from 'pinia'
import { ref } from 'vue'
import { get, post } from '../http'

// 用户会话由服务端 HttpOnly Cookie 维护，前端只记录当前登录的邮箱
export const useAuthStore = defineStore('auth', () => {
  const user = ref<string | null>(null)
  let checking: Promise<void> | null = null

  /** 向服务端确认登录状态（只请求一次，force 时重新请求） */
  function init(force = false) {
    if (!checking || force)
      checking = get<{ user: string | null }>('/api/auth/me')
        .then((r) => void (user.value = r.user))
        .catch(() => void (user.value = null))
    return checking
  }

  async function register(data: { email: string; password: string; captchaId: string; captcha: string }) {
    user.value = (await post<{ user: string }>('/api/auth/register', data)).user
  }

  async function login(data: { email: string; password: string; captchaId: string; captcha: string; remember: boolean }) {
    user.value = (await post<{ user: string }>('/api/auth/login', data)).user
  }

  async function logout() {
    await post('/api/auth/logout').catch(() => {})
    user.value = null
  }

  return { user, init, register, login, logout }
})
