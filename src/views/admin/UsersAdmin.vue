<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import { adminApi } from '../../adminApi'
import type { AdminUser } from '../../types'
import { useUiStore } from '../../stores/ui'
import { money } from '../../components/admin/status'
import { errorText } from '../../http'

const ui = useUiStore()
const rows = ref<AdminUser[] | null>(null)
const error = ref('')

async function load() {
  try {
    rows.value = await adminApi.users()
  } catch (e) {
    error.value = errorText(e)
  }
}
onMounted(load)

async function remove(u: AdminUser) {
  if (!confirm(`确定删除用户 ${u.email}？其订单会保留，并立即退出该用户的登录。`)) return
  try {
    await adminApi.deleteUser(u.id)
    ui.notify('已删除')
    load()
  } catch (e) {
    ui.notify(errorText(e))
  }
}
</script>

<template>
  <div class="card overflow-hidden">
    <p v-if="rows" class="p-4 text-sm text-zinc-500">共 {{ rows.length }} 个注册用户</p>
    <div class="overflow-x-auto">
      <table class="tbl">
        <thead><tr><th>邮箱</th><th>注册时间</th><th>订单数</th><th>消费金额</th><th class="text-right">操作</th></tr></thead>
        <tbody>
          <tr v-if="error"><td colspan="5" class="py-10 text-center text-red-500">{{ error }}</td></tr>
          <tr v-else-if="!rows"><td colspan="5" class="py-10 text-center text-zinc-500">加载中…</td></tr>
          <tr v-else-if="!rows.length"><td colspan="5" class="py-10 text-center text-zinc-500">暂无用户</td></tr>
          <tr v-for="r in rows ?? []" :key="r.id">
            <td class="font-medium">{{ r.email }}</td>
            <td class="whitespace-nowrap text-zinc-500">{{ new Date(r.createdAt).toLocaleString() }}</td>
            <td>{{ r.orders }}</td>
            <td>{{ money(r.spent) }}</td>
            <td>
              <div class="flex justify-end">
                <button class="btn-icon hover:text-red-500" aria-label="删除用户" @click="remove(r)"><Trash2 class="h-4 w-4" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
