import { defineStore } from 'pinia'
import { ref } from 'vue'
import { adminApi } from '../adminApi'

// 后台鉴权完全由服务端完成，前端只缓存当前管理员用户名用于显示和路由判断
export const useAdminStore = defineStore('admin', () => {
  const username = ref<string | null>(null)
  let checking: Promise<void> | null = null

  function check(force = false) {
    if (!checking || force)
      checking = adminApi.me()
        .then((r) => void (username.value = r.username))
        .catch(() => void (username.value = null))
    return checking
  }

  async function login(name: string, password: string) {
    username.value = (await adminApi.login(name, password)).username
    checking = Promise.resolve()
  }

  async function logout() {
    await adminApi.logout().catch(() => {})
    username.value = null
  }

  /** 会话在服务端失效时调用 */
  function expire() {
    username.value = null
    checking = Promise.resolve()
  }

  return { username, check, login, logout, expire }
})
