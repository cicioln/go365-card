<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { SiteConfig } from '../../data/mock'
import { adminApi } from '../../adminApi'
import { useSiteStore } from '../../stores/site'
import { useUiStore } from '../../stores/ui'
import { errorText } from '../../http'

const siteStore = useSiteStore()
const ui = useUiStore()

const site = ref<SiteConfig>({ ...siteStore.site })
const siteError = ref('')
const oldPwd = ref('')
const newPwd = ref('')
const pwdError = ref('')
const busy = ref(false)

onMounted(async () => {
  try {
    site.value = await adminApi.site()
  } catch (e) {
    siteError.value = errorText(e)
  }
})

async function saveSite() {
  siteError.value = ''
  busy.value = true
  try {
    siteStore.site = await adminApi.saveSite(site.value)
    ui.notify('站点设置已保存')
  } catch (e) {
    siteError.value = errorText(e)
  } finally {
    busy.value = false
  }
}

async function changePwd() {
  pwdError.value = ''
  if (newPwd.value.length < 8) return (pwdError.value = '新密码至少 8 位')
  try {
    await adminApi.changePassword(oldPwd.value, newPwd.value)
    oldPwd.value = newPwd.value = ''
    ui.notify('密码已修改，其它设备上的登录已失效')
  } catch (e) {
    pwdError.value = errorText(e)
  }
}
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-2">
    <form class="card space-y-4 p-6" @submit.prevent="saveSite">
      <h2 class="font-bold">站点信息</h2>
      <div><label class="label" for="s-name">站点名称</label><input id="s-name" v-model="site.siteName" class="input" required /></div>
      <div><label class="label" for="s-desc">站点描述</label><input id="s-desc" v-model="site.description" class="input" /></div>
      <div><label class="label" for="s-tg">Telegram 群链接</label><input id="s-tg" v-model="site.telegram" type="url" class="input" /></div>
      <div>
        <label class="label" for="s-cur">货币</label>
        <select id="s-cur" v-model="site.currency" class="input"><option>CNY</option><option>USD</option></select>
        <p class="mt-1.5 text-xs text-zinc-400">只改变显示的货币符号，不做汇率换算，请确保与支付网关结算币种一致</p>
      </div>
      <p v-if="siteError" role="alert" class="text-sm text-red-500">{{ siteError }}</p>
      <button class="btn-primary" :disabled="busy">保存</button>
    </form>

    <form class="card h-fit space-y-4 p-6" @submit.prevent="changePwd">
      <h2 class="font-bold">修改管理员密码</h2>
      <input value="admin" autocomplete="username" class="sr-only" tabindex="-1" aria-hidden="true" readonly />
      <div><label class="label" for="s-old">原密码</label><input id="s-old" v-model="oldPwd" type="password" autocomplete="current-password" class="input" required /></div>
      <div><label class="label" for="s-new">新密码（至少 8 位）</label><input id="s-new" v-model="newPwd" type="password" autocomplete="new-password" class="input" required /></div>
      <p v-if="pwdError" role="alert" class="text-sm text-red-500">{{ pwdError }}</p>
      <button class="btn-primary">修改密码</button>
    </form>
  </div>
</template>
