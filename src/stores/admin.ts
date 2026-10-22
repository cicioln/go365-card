import { defineStore } from 'pinia'
import { ref } from 'vue'
import { adminApi } from '../adminApi'

// 后台鉴权完全由服务端完成，前端只缓存当前管理员用户名用于显示和路由判断
export const useAdminStore = defineStore('admin', () => {
  const username = ref<string | null>(null)
  /** 尚未创建管理员，需要走首次安装向导 */
  const needsSetup = ref(false)
  /** 是否仍在使用模拟支付（后台顶部显示警告） */
  const mockPay = ref(false)
  let checking: Promise<void> | null = null

  function check(force = false) {
    if (!checking || force)
      checking = adminApi.me()
        .then((r) => {
          username.value = r.username
          needsSetup.value = r.needsSetup
        })
        .catch(() => void (username.value = null))
    return checking
  }

  async function login(name: string, password: string) {
    username.value = (await adminApi.login(name, password)).username
    checking = Promise.resolve()
  }

  async function setup(code: string, name: string, password: string) {
    username.value = (await adminApi.setup(code, name, password)).username
    needsSetup.value = false
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

  async function refreshPayMode() {
    try {
      mockPay.value = (await adminApi.payment()).provider === 'mock'
    } catch {
      /* 忽略 */
    }
  }

  return { username, needsSetup, mockPay, check, login, setup, logout, expire, refreshPayMode }
})
