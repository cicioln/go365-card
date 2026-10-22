<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Copy, Download, KeyRound } from 'lucide-vue-next'
import type { Order } from '../types'
import { useUiStore } from '../stores/ui'
import { parseFields } from '../utils/cards'
import { copyText, downloadText } from '../utils/clipboard'

const props = defineProps<{ order: Order }>()
const { t } = useI18n()
const ui = useUiStore()

/** 按商品分组，每条卡密预先解析出「字段名: 值」 */
const groups = computed(() =>
  props.order.lines
    .filter((l) => l.cards.length)
    .map((l) => ({ id: l.id, title: l.title, cards: l.cards.map((raw) => ({ raw, fields: parseFields(raw) })) })),
)
const total = computed(() => groups.value.reduce((n, g) => n + g.cards.length, 0))
const multi = computed(() => groups.value.length > 1)

// 刚复制的条目显示对勾，1.5 秒后恢复
const copied = ref('')
let timer: number | undefined
async function copy(text: string, key: string) {
  if (!(await copyText(text))) return ui.notify(t('order.copyFail'))
  copied.value = key
  clearTimeout(timer)
  timer = window.setTimeout(() => (copied.value = ''), 1500)
  ui.notify(t('order.copied'))
}

/** 导出 / 复制全部用的纯文本：多件商品时带商品标题，卡密之间空一行 */
function allText(withHeader: boolean) {
  const body = groups.value
    .map((g) => {
      const cards = g.cards.map((c) => c.raw).join('\n\n')
      return multi.value || withHeader ? `【${g.title}】（${g.cards.length}）\n\n${cards}` : cards
    })
    .join('\n\n\n')
  if (!withHeader) return body
  const head = [`${t('order.no')}: ${props.order.orderNo}`, `${t('order.created')}: ${new Date(props.order.createdAt).toLocaleString()}`]
  return `${head.join('\n')}\n${'='.repeat(40)}\n\n${body}\n`
}

function exportTxt() {
  downloadText(`${t('order.cards')}-${props.order.orderNo}.txt`, allText(true))
}
</script>

<template>
  <section class="card mt-4 overflow-hidden" aria-labelledby="cards-title">
    <header class="flex flex-wrap items-center gap-3 border-b border-black/5 bg-emerald-50/60 px-5 py-4 dark:border-white/10 dark:bg-emerald-500/10">
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white"><KeyRound class="h-4.5 w-4.5" /></span>
      <div class="mr-auto min-w-0">
        <h2 id="cards-title" class="font-bold">{{ t('order.cards') }} <span class="text-sm font-medium text-zinc-500">· {{ t('order.cardCount', { n: total }) }}</span></h2>
        <p class="text-xs text-zinc-500">{{ t('order.saveHint') }}</p>
      </div>
      <div class="flex w-full gap-2 sm:w-auto">
        <button class="btn-ghost flex-1 py-2 text-sm sm:flex-none" @click="copy(allText(false), 'all')">
          <component :is="copied === 'all' ? Check : Copy" class="h-4 w-4" />{{ t('order.copyAll') }}
        </button>
        <button class="btn-primary flex-1 py-2 text-sm sm:flex-none" @click="exportTxt">
          <Download class="h-4 w-4" />{{ t('order.exportTxt') }}
        </button>
      </div>
    </header>

    <div class="space-y-5 p-5">
      <div v-for="g in groups" :key="g.id">
        <h3 v-if="multi" class="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">{{ g.title }}<span class="ml-1 text-zinc-400">({{ g.cards.length }})</span></h3>
        <ol class="grid gap-2.5">
          <li
            v-for="(c, i) in g.cards"
            :key="i"
            class="rounded-xl border border-black/5 bg-zinc-50 dark:border-white/10 dark:bg-zinc-900"
          >
            <div class="flex items-center justify-between gap-2 border-b border-black/5 px-3.5 py-1.5 dark:border-white/10">
              <span class="text-xs font-semibold text-zinc-400">#{{ i + 1 }}</span>
              <button
                class="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-brand transition hover:bg-brand-soft dark:hover:bg-brand/15"
                :aria-label="`${t('order.copy')} #${i + 1}`"
                @click="copy(c.raw, `${g.id}-${i}`)"
              >
                <component :is="copied === `${g.id}-${i}` ? Check : Copy" class="h-3.5 w-3.5" />{{ copied === `${g.id}-${i}` ? t('order.copied') : t('order.copy') }}
              </button>
            </div>

            <!-- 「字段名: 值」格式：逐字段展示，每个值都能单独复制 -->
            <dl v-if="c.fields" class="divide-y divide-black/5 dark:divide-white/10">
              <div v-for="(f, j) in c.fields" :key="j" class="flex items-start gap-3 px-3.5 py-2 sm:grid sm:grid-cols-[8.5rem_1fr_auto]">
                <dt class="w-24 shrink-0 pt-px text-xs text-zinc-500 sm:w-auto">{{ f.key }}</dt>
                <dd class="max-h-24 min-w-0 flex-1 overflow-y-auto font-mono text-[13px] break-all">{{ f.value }}</dd>
                <button
                  class="btn-icon -my-1 h-7 w-7 shrink-0 text-zinc-400 hover:text-brand"
                  :aria-label="`${t('order.copy')} ${f.key}`"
                  @click="copy(f.value, `${g.id}-${i}-${j}`)"
                >
                  <component :is="copied === `${g.id}-${i}-${j}` ? Check : Copy" class="h-3.5 w-3.5" :class="{ 'text-emerald-500': copied === `${g.id}-${i}-${j}` }" />
                </button>
              </div>
            </dl>
            <!-- 其它格式原样显示，保留换行 -->
            <pre v-else class="max-h-60 overflow-y-auto px-3.5 py-2.5 font-mono text-[13px] whitespace-pre-wrap break-all">{{ c.raw }}</pre>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>
