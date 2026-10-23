<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search, RefreshCw, Trash2, X } from 'lucide-vue-next'
import { adminApi } from '../../adminApi'
import type { AccessLogResult } from '../../types'
import { useUiStore } from '../../stores/ui'
import { errorText } from '../../http'

const ui = useUiStore()
const data = ref<AccessLogResult | null>(null)
const loading = ref(true)
const ip = ref('')
const keyword = ref('')
const kind = ref('')
const hours = ref(24)
const page = ref(1)

const kinds = [
  { value: '', label: '全部' },
  { value: 'page', label: '页面访问' },
  { value: 'api', label: '前台接口' },
  { value: 'admin', label: '后台接口' },
]
const ranges = [
  { value: 1, label: '最近 1 小时' },
  { value: 24, label: '最近 24 小时' },
  { value: 24 * 7, label: '最近 7 天' },
  { value: 24 * 30, label: '最近 30 天' },
]
const kindText: Record<string, string> = { page: '页面', api: '接口', admin: '后台' }
const pages = computed(() => (data.value ? Math.max(Math.ceil(data.value.total / data.value.pageSize), 1) : 1))
const statusCls = (s: number) => (s >= 500 ? 'text-red-500' : s >= 400 ? 'text-amber-500' : 'text-emerald-600')

async function load() {
  loading.value = true
  try {
    data.value = await adminApi.logs({ ip: ip.value, keyword: keyword.value, kind: kind.value, hours: hours.value, page: page.value })
  } catch (e) {
    ui.notify(errorText(e))
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(page, load)
// 条件变化时回到第一页
watch([kind, hours], () => (page.value === 1 ? load() : (page.value = 1)))
let timer: number | undefined
watch([ip, keyword], () => {
  clearTimeout(timer)
  timer = window.setTimeout(() => (page.value === 1 ? load() : (page.value = 1)), 300)
})

async function clearAll() {
  if (!confirm('确定清空全部访问日志？此操作不可恢复。')) return
  try {
    await adminApi.clearLogs()
    ui.notify('已清空')
    page.value === 1 ? load() : (page.value = 1)
  } catch (e) {
    ui.notify(errorText(e))
  }
}
</script>

<template>
  <div class="mb-6 grid gap-4 sm:grid-cols-3">
    <div class="card p-4"><p class="text-sm text-zinc-500">页面访问量</p><p class="mt-1 text-2xl font-bold">{{ data?.pageViews ?? '—' }}</p></div>
    <div class="card p-4"><p class="text-sm text-zinc-500">独立 IP</p><p class="mt-1 text-2xl font-bold">{{ data?.uniqueIps ?? '—' }}</p></div>
    <div class="card p-4"><p class="text-sm text-zinc-500">符合条件的请求</p><p class="mt-1 text-2xl font-bold">{{ data?.total ?? '—' }}</p></div>
  </div>

  <div class="grid gap-6 xl:grid-cols-[1fr_280px]">
    <div class="card min-w-0 overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 p-4">
        <div class="flex flex-wrap rounded-xl bg-zinc-100 p-1 dark:bg-white/5" role="tablist" aria-label="日志类型">
          <button
            v-for="k in kinds"
            :key="k.value"
            role="tab"
            :aria-selected="kind === k.value"
            class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
            :class="kind === k.value ? 'bg-white shadow-sm dark:bg-zinc-800' : 'text-zinc-500'"
            @click="kind = k.value"
          >
            {{ k.label }}
          </button>
        </div>
        <select v-model="hours" class="input w-auto" aria-label="时间范围">
          <option v-for="r in ranges" :key="r.value" :value="r.value">{{ r.label }}</option>
        </select>
        <div class="relative w-full sm:w-40">
          <input v-model.trim="ip" class="input pr-8" placeholder="IP 地址" aria-label="按 IP 筛选" />
          <button v-if="ip" class="absolute top-1/2 right-2 -translate-y-1/2 text-zinc-400" aria-label="清除 IP" @click="ip = ''"><X class="h-4 w-4" /></button>
        </div>
        <div class="relative w-full sm:w-56">
          <Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input v-model.trim="keyword" class="input pl-9" placeholder="路径 / 浏览器标识" aria-label="搜索日志" />
        </div>
        <div class="ml-auto flex gap-1">
          <button class="btn-icon" aria-label="刷新" :disabled="loading" @click="load"><RefreshCw class="h-4 w-4" /></button>
          <button class="btn-icon hover:text-red-500" aria-label="清空日志" @click="clearAll"><Trash2 class="h-4 w-4" /></button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="tbl">
          <thead><tr><th>时间</th><th>IP</th><th>类型</th><th>请求</th><th>状态</th><th>耗时</th><th>浏览器标识</th></tr></thead>
          <tbody>
            <tr v-if="loading && !data"><td colspan="7" class="py-10 text-center text-zinc-500">加载中…</td></tr>
            <tr v-else-if="!data?.list.length"><td colspan="7" class="py-10 text-center text-zinc-500">暂无记录</td></tr>
            <tr v-for="r in data?.list ?? []" :key="r.id">
              <td class="whitespace-nowrap text-zinc-500">{{ new Date(r.at).toLocaleString() }}</td>
              <td class="whitespace-nowrap"><button class="font-mono text-xs hover:text-brand hover:underline" :title="`只看 ${r.ip}`" @click="ip = r.ip">{{ r.ip }}</button></td>
              <td class="whitespace-nowrap text-xs">{{ kindText[r.kind] }}</td>
              <td class="max-w-72">
                <p class="truncate font-mono text-xs" :title="r.path"><span class="text-zinc-400">{{ r.method }}</span> {{ r.path }}</p>
                <p v-if="r.referer" class="truncate text-xs text-zinc-400" :title="r.referer">来源 {{ r.referer }}</p>
              </td>
              <td class="font-mono text-xs" :class="statusCls(r.status)">{{ r.status }}</td>
              <td class="whitespace-nowrap text-xs text-zinc-500">{{ r.ms }} ms</td>
              <td class="max-w-56"><p class="truncate text-xs text-zinc-500" :title="r.ua">{{ r.ua || '—' }}</p></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="pages > 1" class="flex items-center justify-end gap-2 p-4 text-sm">
        <button class="btn-ghost" :disabled="page <= 1 || loading" @click="page--">上一页</button>
        <span class="text-zinc-500">{{ page }} / {{ pages }}</span>
        <button class="btn-ghost" :disabled="page >= pages || loading" @click="page++">下一页</button>
      </div>
    </div>

    <div class="card h-fit overflow-hidden">
      <p class="p-4 font-semibold">访问最多的 IP</p>
      <p v-if="!data?.topIps.length" class="px-4 pb-4 text-sm text-zinc-500">暂无记录</p>
      <ul class="pb-2">
        <li v-for="t in data?.topIps ?? []" :key="t.ip">
          <button
            class="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-white/5"
            :class="ip === t.ip ? 'bg-zinc-100 dark:bg-white/10' : ''"
            :title="`最后访问 ${new Date(t.last).toLocaleString()}`"
            @click="ip = ip === t.ip ? '' : t.ip"
          >
            <span class="min-w-0 flex-1 truncate font-mono text-xs">{{ t.ip }}</span>
            <span class="text-xs text-zinc-500">{{ t.n }} 次</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
  <p class="mt-4 text-xs text-zinc-400">日志保留 30 天（可用环境变量 LOG_RETENTION_DAYS 调整），不记录静态资源和链接里的查询参数。位于 Nginx 等反向代理之后时需设置 TRUST_PROXY=1，否则这里显示的都是代理的 IP。</p>
</template>
