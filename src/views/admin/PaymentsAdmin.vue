<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus, Pencil, Trash2 } from 'lucide-vue-next'
import type { PaymentChannel } from '../../data/mock'
import { adminApi } from '../../adminApi'
import { useUiStore } from '../../stores/ui'
import AdminModal from '../../components/admin/AdminModal.vue'
import { errorText } from '../../http'

const ui = useUiStore()
const list = ref<PaymentChannel[]>([])
const editing = ref<PaymentChannel | null>(null)
const error = ref('')
const busy = ref(false)
const typeText: Record<PaymentChannel['type'], string> = { alipay: '支付宝', wechat: '微信支付', usdt: 'USDT' }

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
  editing.value = c ? { ...c } : { id: 0, name: '', type: 'alipay', feeRate: 0, enabled: true }
}

async function save() {
  error.value = ''
  const c = editing.value!
  busy.value = true
  try {
    await adminApi.saveChannel({ ...c, feeRate: Number(c.feeRate) })
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
            <td class="font-medium">{{ c.name }}</td>
            <td>{{ typeText[c.type] }}</td>
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
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label" for="pc-type">类型</label>
          <select id="pc-type" v-model="editing.type" class="input">
            <option v-for="(v, k) in typeText" :key="k" :value="k">{{ v }}</option>
          </select>
        </div>
        <div><label class="label" for="pc-fee">手续费率（%）</label><input id="pc-fee" v-model.number="editing.feeRate" type="number" min="0" max="100" step="0.1" class="input" /></div>
      </div>
      <label class="flex items-center gap-2 text-sm"><input v-model="editing.enabled" type="checkbox" class="accent-brand" />启用</label>
      <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="editing = null">取消</button>
        <button class="btn-primary" :disabled="busy">保存</button>
      </div>
    </form>
  </AdminModal>
</template>
