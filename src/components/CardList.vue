<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Copy, Download } from 'lucide-vue-next'
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
    <header class="flex flex-wrap items-center gap-3 border-b border-line px-5 py-[18px] sm:px-[22px]">
      <div class="mr-auto min-w-0">
        <h2 id="cards-title" class="text-base font-extrabold">{{ t('order.cards') }} · {{ t('order.cardCount', { n: total }) }}</h2>
        <p class="text-[12.5px] text-ink-3">{{ multi ? t('order.saveHintShort') : groups[0]?.title }}</p>
      </div>
      <div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
        <button class="btn-ghost h-[34px] rounded-[10px] px-3 text-[13px]" @click="copy(allText(false), 'all')">
          <component :is="copied === 'all' ? Check : Copy" class="h-4 w-4" />{{ t('order.copyAll') }}
        </button>
        <button class="btn-ink h-[34px] rounded-[10px] px-3 text-[13px]" @click="exportTxt">
          <Download class="h-4 w-4" />{{ t('order.exportTxt') }}
        </button>
      </div>
    </header>

    <div v-for="g in groups" :key="g.id">
      <h3 v-if="multi" class="border-b border-line bg-surface-2 px-5 py-2 text-[13px] font-bold text-ink-2 sm:px-[22px]">
        {{ g.title }}<span class="ml-1 font-mono text-ink-3">({{ g.cards.length }})</span>
      </h3>
      <ol>
        <li v-for="(c, i) in g.cards" :key="i" class="grid grid-cols-[1fr_auto] gap-x-3.5 gap-y-2 border-b border-line px-4 py-4 last:border-0 sm:grid-cols-[28px_1fr_auto] sm:px-[22px]">
          <span class="font-mono text-xs font-bold text-ink-3 sm:pt-[9px]">{{ String(i + 1).padStart(2, '0') }}</span>
          <button
            class="btn-ghost h-[30px] rounded-[9px] px-2.5 text-xs sm:order-last sm:h-[34px] sm:self-start sm:px-3 sm:text-[13px]"
            :aria-label="`${t('order.copyGroup')} #${i + 1}`"
            @click="copy(c.raw, `${g.id}-${i}`)"
          >
            <Check v-if="copied === `${g.id}-${i}`" class="h-3.5 w-3.5 text-ok" />{{ t('order.copyGroup') }}
          </button>

          <!-- 「字段名: 值」格式：逐字段展示，每个值都能单独复制 -->
          <dl v-if="c.fields" class="col-span-2 min-w-0 sm:col-span-1">
            <div v-for="(f, j) in c.fields" :key="j" class="mb-1 grid grid-cols-[62px_1fr_28px] items-center gap-2.5 rounded-[10px] bg-surface-2 py-[7px] pr-1 pl-2.5 last:mb-0 sm:grid-cols-[90px_1fr_30px]">
              <dt class="truncate text-xs text-ink-3" :title="f.key">{{ f.key }}</dt>
              <dd class="max-h-24 min-w-0 overflow-y-auto font-mono text-[13px] font-medium break-all">{{ f.value }}</dd>
              <button
                class="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-ink-3 transition hover:bg-surface hover:text-ink"
                :aria-label="`${t('order.copy')} ${f.key}`"
                :title="t('order.copy')"
                @click="copy(f.value, `${g.id}-${i}-${j}`)"
              >
                <component :is="copied === `${g.id}-${i}-${j}` ? Check : Copy" class="h-3.5 w-3.5" :class="{ 'text-ok': copied === `${g.id}-${i}-${j}` }" />
              </button>
            </div>
          </dl>
          <!-- 其它格式原样显示，保留换行 -->
          <pre v-else class="col-span-2 max-h-60 min-w-0 overflow-y-auto rounded-[10px] bg-surface-2 px-2.5 py-2 font-mono text-[13px] whitespace-pre-wrap break-all sm:col-span-1">{{ c.raw }}</pre>
        </li>
      </ol>
    </div>
  </section>
</template>
