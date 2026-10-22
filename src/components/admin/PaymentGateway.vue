<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Copy, Lock } from 'lucide-vue-next'
import { adminApi, type PaymentInput, type PaymentSettings } from '../../adminApi'
import { useAdminStore } from '../../stores/admin'
import { useUiStore } from '../../stores/ui'
import { errorText } from '../../http'

// 支付网关设置：保存后立即生效；被环境变量锁定的项只读
const admin = useAdminStore()
const ui = useUiStore()
const data = ref<PaymentSettings | null>(null)
const form = ref<PaymentInput>({ provider: 'epay', epayUrl: '', epayPid: '', epayKey: '', publicUrl: '' })
const error = ref('')
const busy = ref(false)

function fill(d: PaymentSettings) {
  data.value = d
  form.value = { provider: d.provider, epayUrl: d.epayUrl, epayPid: d.epayPid, epayKey: '', publicUrl: d.publicUrl }
  admin.mockPay = d.provider === 'mock'
}

onMounted(async () => {
  try {
    fill(await adminApi.payment())
  } catch (e) {
    error.value = errorText(e)
  }
})

const locks = computed(() => data.value?.locks ?? { provider: false, epayUrl: false, epayPid: false, epayKey: false, publicUrl: false })
const notifyUrl = computed(() => `${form.value.publicUrl.replace(/\/+$/, '')}/api/pay/epay/notify`)
// 浏览器当前地址与回调地址不一致时提醒（例如用内网 IP 打开了后台）
const browserOrigin = window.location.origin
const originMismatch = computed(() => !!form.value.publicUrl && !form.value.publicUrl.startsWith(browserOrigin))

async function save() {
  error.value = ''
  busy.value = true
  try {
    fill(await adminApi.savePayment(form.value))
    ui.notify('支付配置已保存，立即生效')
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ui.notify('已复制')
  } catch {
    /* 剪贴板不可用时忽略 */
  }
}
</script>

<template>
  <form class="card space-y-4 p-6" @submit.prevent="save">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="font-bold">支付网关</h2>
      <span v-if="data" class="badge" :class="data.provider === 'epay' && data.epayReady ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15'">
        当前：{{ data.provider === 'mock' ? '模拟支付' : data.epayReady ? '易支付' : '易支付未配置' }}
      </span>
    </div>

    <!-- 生产模式只有易支付；未配置时支付宝、微信等渠道不会显示给买家，只能用内置 USDT 收款 -->
    <p v-if="data && !data.mockAllowed && !data.epayReady" class="rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
      易支付未配置：前台只显示内置 USDT 渠道。填写下方网关地址、商户号和密钥后，支付宝、微信等渠道才会出现在结算页。
    </p>

    <fieldset v-if="data?.mockAllowed" :disabled="locks.provider">
      <legend class="label">支付模式<Lock v-if="locks.provider" class="h-3.5 w-3.5 text-zinc-400" /></legend>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm" :class="form.provider === 'mock' ? 'border-brand bg-brand-soft dark:bg-brand/20' : 'border-black/10 dark:border-white/10'">
          <input v-model="form.provider" type="radio" value="mock" class="mt-0.5 accent-brand" />
          <span><b>模拟支付</b><span class="block text-xs text-zinc-500">本地收银台，点一下就算付款，仅用于测试</span></span>
        </label>
        <label class="flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm" :class="form.provider === 'epay' ? 'border-brand bg-brand-soft dark:bg-brand/20' : 'border-black/10 dark:border-white/10'">
          <input v-model="form.provider" type="radio" value="epay" class="mt-0.5 accent-brand" />
          <span><b>易支付</b><span class="block text-xs text-zinc-500">彩虹易支付等兼容平台，收到平台回调才发货</span></span>
        </label>
      </div>
    </fieldset>

    <div class="grid gap-4 sm:grid-cols-2">
      <div class="sm:col-span-2">
        <label class="label" for="pg-url">网关地址<Lock v-if="locks.epayUrl" class="h-3.5 w-3.5 text-zinc-400" /></label>
        <input id="pg-url" v-model="form.epayUrl" type="url" class="input" placeholder="https://pay.example.com" :disabled="locks.epayUrl" />
      </div>
      <div>
        <label class="label" for="pg-pid">商户号（PID）<Lock v-if="locks.epayPid" class="h-3.5 w-3.5 text-zinc-400" /></label>
        <input id="pg-pid" v-model="form.epayPid" class="input" autocomplete="off" :disabled="locks.epayPid" />
      </div>
      <div>
        <label class="label" for="pg-key">商户密钥（KEY）<Lock v-if="locks.epayKey" class="h-3.5 w-3.5 text-zinc-400" /></label>
        <input
          id="pg-key"
          v-model="form.epayKey"
          type="password"
          class="input"
          autocomplete="new-password"
          :disabled="locks.epayKey"
          :placeholder="data?.hasKey ? '已设置，留空则不修改' : '未设置'"
        />
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="pg-site">站点地址<Lock v-if="locks.publicUrl" class="h-3.5 w-3.5 text-zinc-400" /></label>
        <input id="pg-site" v-model="form.publicUrl" type="url" class="input" placeholder="https://shop.example.com" :disabled="locks.publicUrl" />
        <p class="mt-1.5 text-xs text-zinc-400">买家访问商城的地址，用于生成支付回调和支付后的跳回地址，需要支付平台能从公网访问。</p>
        <p v-if="originMismatch" class="mt-1 text-xs text-amber-600">当前浏览器地址是 {{ browserOrigin }}，与站点地址不同，请确认填写的是对外访问地址。</p>
      </div>
    </div>

    <div class="rounded-xl bg-zinc-50 p-3 text-xs dark:bg-white/5">
      <p class="text-zinc-500">异步通知地址（在支付平台填写，或由系统随订单自动提交）：</p>
      <p class="mt-1 flex items-center gap-2 font-mono break-all">
        {{ notifyUrl }}
        <button type="button" class="shrink-0 text-brand" aria-label="复制通知地址" @click="copy(notifyUrl)"><Copy class="h-3.5 w-3.5" /></button>
      </p>
    </div>

    <p v-if="Object.values(locks).some(Boolean)" class="flex items-center gap-1.5 text-xs text-zinc-400">
      <Lock class="h-3.5 w-3.5" />带锁的项由服务器环境变量设置，需修改 .env 后重启
    </p>
    <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
    <button class="btn-primary" :disabled="busy || !data">保存支付配置</button>
  </form>
</template>
