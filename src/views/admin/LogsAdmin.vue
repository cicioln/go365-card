<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Search, RefreshCw, Trash2, X, Radio, Pause } from 'lucide-vue-next'
import { adminApi } from '../../adminApi'
import type { AccessLog, AccessLogResult } from '../../types'
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

// ---- 实时模式：通过 SSE 接收新请求，符合当前筛选条件的插到列表顶部 ----

const readLive = () => {
  try {
    return localStorage.getItem('logs-live') !== '0'
  } catch {
    return true
  }
}
const live = ref(readLive())
/** connecting 连接中 / open 已连接 / error 断开（浏览器会自动重连） */
const liveState = ref<'off' | 'connecting' | 'open' | 'error'>('off')
const fresh = ref(new Set<string>())
let es: EventSource | null = null
let statsTimer: number | undefined

const matches = (r: AccessLog) =>
  (!ip.value || r.ip === ip.value) &&
  (!kind.value || r.kind === kind.value) &&
  (!keyword.value || r.path.includes(keyword.value) || r.ua.includes(keyword.value))

function onLog(r: AccessLog) {
  const d = data.value
  // 只在第一页插入，翻到后面的页时只更新计数
  if (!d) return
  if (matches(r)) {
    d.total++
    if (page.value === 1) {
      d.list.unshift(r)
      if (d.list.length > d.pageSize) d.list.pop()
      const k = r.key!
      fresh.value.add(k)
      setTimeout(() => fresh.value.delete(k), 1500)
    }
  }
  if (r.kind === 'page') d.pageViews++
  // 独立 IP 和排行由服务端统计，最多每 10 秒刷新一次
  if (!statsTimer) statsTimer = window.setTimeout(refreshStats, 10_000)
}

async function refreshStats() {
  statsTimer = undefined
  try {
    const r = await adminApi.logs({ ip: ip.value, keyword: keyword.value, kind: kind.value, hours: hours.value, page: page.value })
    if (!data.value) return
    data.value.uniqueIps = r.uniqueIps
    data.value.topIps = r.topIps
    data.value.total = r.total
  } catch {
    /* 下次再刷新 */
  }
}

function connect() {
  disconnect()
  liveState.value = 'connecting'
  es = new EventSource('/api/admin/logs/stream')
  es.addEventListener('ready', () => (liveState.value = 'open'))
  es.onmessage = (e) => {
    try {
      onLog(JSON.parse(e.data))
    } catch {
      /* 忽略格式错误的消息 */
    }
  }
  es.onerror = () => {
    liveState.value = 'error'
    // 连接被拒（会话失效、连接数过多）时浏览器不会重连，这里稍后重试
    if (es?.readyState === EventSource.CLOSED) setTimeout(() => live.value && liveState.value === 'error' && connect(), 5000)
  }
}

function disconnect() {
  es?.close()
  es = null
  liveState.value = 'off'
}

watch(live, (on) => {
  try {
    localStorage.setItem('logs-live', on ? '1' : '0')
  } catch {
    /* 隐私模式等无法写入 */
  }
  on ? connect() : disconnect()
}, { immediate: true })
onBeforeUnmount(() => {
  disconnect()
  clearTimeout(statsTimer)
})

const liveText = { off: '已暂停', connecting: '连接中…', open: '实时', error: '连接断开，正在重连…' }

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
        <div class="ml-auto flex items-center gap-1">
          <button
            class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:bg-zinc-100 dark:hover:bg-white/5"
            :class="liveState === 'open' ? 'text-emerald-600' : liveState === 'error' ? 'text-amber-500' : 'text-zinc-500'"
            :aria-pressed="live"
            :title="live ? '点击暂停实时更新' : '点击开启实时更新'"
            @click="live = !live"
          >
            <span v-if="liveState === 'open'" class="relative flex h-2 w-2"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
            <Radio v-else-if="live" class="h-3.5 w-3.5" />
            <Pause v-else class="h-3.5 w-3.5" />
            {{ liveText[liveState] }}
          </button>
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
            <tr v-for="r in data?.list ?? []" :key="r.key ?? r.id" class="transition-colors duration-1000" :class="r.key && fresh.has(r.key) ? 'bg-emerald-50 dark:bg-emerald-500/10' : ''">
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
  <p class="mt-4 text-xs text-zinc-400">开启实时后，新请求会立即出现在列表顶部（仅第一页，按当前筛选条件过滤）。日志保留 30 天（可用环境变量 LOG_RETENTION_DAYS 调整），不记录静态资源和链接里的查询参数。位于 Nginx 等反向代理之后时需设置 TRUST_PROXY=1，否则这里显示的都是代理的 IP。</p>
</template>
