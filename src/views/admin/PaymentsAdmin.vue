<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus, Pencil, Trash2 } from 'lucide-vue-next'
import type { PaymentChannel } from '../../data/mock'
import { adminApi } from '../../adminApi'
import { useUiStore } from '../../stores/ui'
import AdminModal from '../../components/admin/AdminModal.vue'
import ImageUpload from '../../components/admin/ImageUpload.vue'
import PaymentGateway from '../../components/admin/PaymentGateway.vue'
import { errorText } from '../../http'

const ui = useUiStore()
const list = ref<PaymentChannel[]>([])
const editing = ref<PaymentChannel | null>(null)
const error = ref('')
const busy = ref(false)
const typeText: Record<PaymentChannel['type'], string> = { alipay: '支付宝', wechat: '微信支付', usdt: 'USDT' }
// 内置 USDT 收款支持的链
const chainText: Record<NonNullable<PaymentChannel['chain']>, string> = {
  '': '不使用（走易支付）', bsc: 'BSC (BEP20)', tron: 'TRON (TRC20)', eth: 'Ethereum (ERC20)', polygon: 'Polygon',
}
const addressHint = (chain: PaymentChannel['chain']) => (chain === 'tron' ? 'T 开头的 34 位地址' : '0x 开头的 42 位地址')
const modeText = (c: PaymentChannel) => (c.type === 'usdt' && c.chain ? `内置收款 · ${chainText[c.chain]}` : c.type === 'usdt' ? '易支付' : '')

async function load() {
  try {
    list.value = await adminApi.channels()
  } catch (e) {
    ui.notify(errorText(e))
  }
}
onMounted(load)

function open(c?: PaymentChannel) {
  error.value = ''
  editing.value = c
    ? { ...c, chain: c.chain ?? '', address: c.address ?? '', rate: c.rate ?? 1, icon: c.icon || undefined }
    : { id: 0, name: '', type: 'alipay', feeRate: 0, enabled: true, chain: '', address: '', rate: 1 }
}

async function save() {
  error.value = ''
  const c = editing.value!
  busy.value = true
  try {
    await adminApi.saveChannel({ ...c, feeRate: Number(c.feeRate), rate: Number(c.rate), icon: c.icon ?? '' })
    editing.value = null
    ui.notify('已保存')
    load()
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}

async function toggle(c: PaymentChannel, enabled: boolean) {
  try {
    await adminApi.setChannelEnabled(c.id, enabled)
    c.enabled = enabled
  } catch (e) {
    ui.notify(errorText(e))
    load()
  }
}

async function remove(c: PaymentChannel) {
  if (!confirm(`确定删除渠道「${c.name}」？`)) return
  try {
    await adminApi.deleteChannel(c.id)
    load()
  } catch (e) {
    ui.notify(errorText(e))
  }
}
</script>

<template>
  <PaymentGateway class="mb-6" />
  <div class="card overflow-hidden">
    <div class="flex items-center p-4">
      <p class="text-sm text-zinc-500">停用的渠道不会出现在结算页</p>
      <button class="btn-primary ml-auto" @click="open()"><Plus class="h-4 w-4" />新增渠道</button>
    </div>
    <div class="overflow-x-auto">
      <table class="tbl">
        <thead><tr><th>名称</th><th>类型</th><th>手续费率</th><th>启用</th><th class="text-right">操作</th></tr></thead>
        <tbody>
          <tr v-for="c in list" :key="c.id">
            <td>
              <span class="flex items-center gap-3">
                <img v-if="c.icon" :src="c.icon" alt="" class="h-7 w-7 shrink-0 rounded-lg object-contain" />
                <span class="font-medium">{{ c.name }}</span>
              </span>
            </td>
            <td>
              {{ typeText[c.type] }}
              <span v-if="modeText(c)" class="block text-xs text-zinc-400">{{ modeText(c) }}</span>
            </td>
            <td>{{ c.feeRate }}%</td>
            <td>
              <input
                type="checkbox"
                role="switch"
                class="h-4 w-4 accent-brand"
                :checked="c.enabled !== false"
                :aria-label="`启用 ${c.name}`"
                @change="toggle(c, ($event.target as HTMLInputElement).checked)"
              />
            </td>
            <td>
              <div class="flex justify-end gap-1">
                <button class="btn-icon" aria-label="编辑" @click="open(c)"><Pencil class="h-4 w-4" /></button>
                <button class="btn-icon hover:text-red-500" aria-label="删除" @click="remove(c)"><Trash2 class="h-4 w-4" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <AdminModal v-if="editing" :title="editing.id ? '编辑渠道' : '新增渠道'" @close="editing = null">
    <form class="space-y-4" @submit.prevent="save">
      <div><label class="label" for="pc-name">名称</label><input id="pc-name" v-model="editing.name" class="input" required /></div>
      <div>
        <span class="label">图标（可选，不上传则按类型显示默认图标）</span>
        <div class="flex items-center gap-3">
          <img v-if="editing.icon" :src="editing.icon" alt="图标预览" class="h-12 w-12 shrink-0 rounded-lg object-contain" />
          <ImageUpload v-model="editing.icon" raw class="flex-1" label="上传图标" hint="建议正方形透明 PNG，≤ 3MB" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label" for="pc-type">类型</label>
          <select id="pc-type" v-model="editing.type" class="input">
            <option v-for="(v, k) in typeText" :key="k" :value="k">{{ v }}</option>
          </select>
        </div>
        <div><label class="label" for="pc-fee">手续费率（%）</label><input id="pc-fee" v-model.number="editing.feeRate" type="number" min="0" max="100" step="0.1" class="input" /></div>
      </div>
      <template v-if="editing.type === 'usdt'">
        <div>
          <label class="label" for="pc-chain">内置收款链</label>
          <select id="pc-chain" v-model="editing.chain" class="input">
            <option v-for="(v, k) in chainText" :key="k" :value="k">{{ v }}</option>
          </select>
          <p class="mt-1.5 text-xs text-zinc-400">选择链后，买家在订单页扫码向下面的地址转账，系统查询链上记录自动确认到账并发货，不经过第三方平台。</p>
        </div>
        <template v-if="editing.chain">
          <div>
            <label class="label" for="pc-addr">收款地址</label>
            <input id="pc-addr" v-model.trim="editing.address" class="input font-mono" :placeholder="addressHint(editing.chain)" autocomplete="off" spellcheck="false" required />
            <p class="mt-1.5 text-xs text-zinc-400">请确认是 {{ chainText[editing.chain] }} 网络的地址。只需公开地址，不要填写私钥或助记词。</p>
          </div>
          <div>
            <label class="label" for="pc-rate">汇率（1 USDT = ? 站点货币）</label>
            <input id="pc-rate" v-model.number="editing.rate" type="number" min="0.0001" step="0.0001" class="input" required />
            <p class="mt-1.5 text-xs text-zinc-400">站点货币为人民币时填写 USDT 兑人民币价格，例如 7.2；站点货币为美元时填 1。</p>
          </div>
        </template>
      </template>
      <label class="flex items-center gap-2 text-sm"><input v-model="editing.enabled" type="checkbox" class="accent-brand" />启用</label>
      <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="editing = null">取消</button>
        <button class="btn-primary" :disabled="busy">保存</button>
      </div>
    </form>
  </AdminModal>
</template>
