<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Trash2, ArrowLeft, Upload, Download, ArchiveRestore } from 'lucide-vue-next'
import type { Category, Product } from '../../data/mock'
import { adminApi } from '../../adminApi'
import { useUiStore } from '../../stores/ui'
import ProductCover from '../../components/ProductCover.vue'
import ImageUpload from '../../components/admin/ImageUpload.vue'
import RichEditor from '../../components/admin/RichEditor.vue'
import { errorText } from '../../http'
import { guessSplit, joinCards, splitCards, type CardSplit } from '../../utils/cards'
import { downloadText } from '../../utils/clipboard'
import AdminModal from '../../components/admin/AdminModal.vue'
import type { TrashCard } from '../../adminApi'

const SPLITS: { value: CardSplit; label: string }[] = [
  { value: 'line', label: '每行一条' },
  { value: 'blank', label: '空行分隔（多行卡密）' },
]

const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const blank = (categoryId: number): Product => ({
  id: 0, slug: '', categoryId, title: '', description: '', content: '',
  price: 0, wholesale: [], stock: 0, sold: 0, fulfillment: 'auto', recommended: false,
  cover: { from: '#1e3a8a', to: '#0ea5e9', headline: '', sub: '', dark: true },
})

const isNew = route.params.id === 'new'
const categories = ref<Category[]>([])
const form = ref<Product | null>(null)
const reserved = ref(0)
const soldCards = ref(0)
const loadError = ref('')
const error = ref('')
const busy = ref(false)

// 自动发货的卡密库存：库存数自动等于卡密条数。多行卡密（账号 + 密码 + 辅助信息）用空行分隔
const cardsText = ref('')
const splitMode = ref<CardSplit>('line')
const cardList = computed(() => splitCards(cardsText.value, splitMode.value))
const cardFile = ref<HTMLInputElement>()

/** 切换分隔方式时按新格式重排文本，避免已录入的内容被拆错 */
function setSplit(mode: CardSplit) {
  if (mode === splitMode.value) return
  const cur = cardList.value
  splitMode.value = mode
  cardsText.value = mode === 'line' ? cur.flatMap((c) => c.split('\n')).join('\n') : joinCards(cur, mode)
}

/** 从 .txt 导入，追加到现有卡密后面 */
async function importCards(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 5 * 1024 * 1024) return (error.value = '文件不能超过 5MB')
  const text = (await file.text()).replace(/^﻿/, '').trim()
  if (!text) return
  const sep = splitMode.value === 'line' ? '\n' : '\n\n'
  cardsText.value = cardsText.value.trim() ? `${cardsText.value.trim()}${sep}${text}` : text
  ui.notify(`已导入，当前共 ${cardList.value.length} 条`)
}
const dupCount = computed(() => cardList.value.length - new Set(cardList.value).size)

// 保存前服务端的可售卡密；对比得出本次会移除的条数，移除前二次确认（移除的进回收站，可恢复）
const savedCards = ref<string[]>([])
const removedCards = computed(() => {
  const next = new Set(form.value?.fulfillment === 'auto' ? cardList.value : [])
  return savedCards.value.filter((c) => !next.has(c))
})
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')

// ---- 卡密回收站 ----
const trash = ref<TrashCard[]>([])
const trashOpen = ref(false)
const trashPick = ref<number[]>([])
async function loadTrash() {
  try {
    trash.value = await adminApi.cardTrash(Number(route.params.id))
  } catch {
    /* 回收站加载失败不影响编辑 */
  }
}
function openTrash() {
  trashPick.value = []
  trashOpen.value = true
  loadTrash()
}
/** 恢复到编辑框（不直接入库，确认后点保存才生效） */
function restorePicked() {
  const picked = trash.value.filter((t) => trashPick.value.includes(t.id)).map((t) => t.code)
  const have = new Set(cardList.value)
  const add = picked.filter((c) => !have.has(c))
  if (add.length) {
    if (splitMode.value === 'line' && add.some((c) => c.includes('\n'))) setSplit('blank')
    const all = [...cardList.value, ...add]
    cardsText.value = joinCards(all, splitMode.value)
  }
  trashOpen.value = false
  ui.notify(`已加回 ${add.length} 条到编辑框，点击「保存修改」后生效`)
}
async function purgeTrash() {
  const ids = trashPick.value.length ? trashPick.value : undefined
  const n = ids ? ids.length : trash.value.length
  if (!confirm(`彻底删除回收站里的 ${n} 条卡密？删除后无法恢复，建议先导出。`)) return
  try {
    await adminApi.purgeCards(ids ? { ids } : { productId: Number(route.params.id) })
    trashPick.value = []
    await loadTrash()
  } catch (e) {
    ui.notify(errorText(e))
  }
}
function exportTrash() {
  const list = trash.value.filter((t) => !trashPick.value.length || trashPick.value.includes(t.id))
  downloadText(`卡密回收站-${form.value?.slug}-${stamp()}.txt`, joinCards(list.map((t) => t.code), 'blank'))
}
const preview = computed(() =>
  form.value ? { ...form.value, cover: { ...form.value.cover, headline: form.value.cover.headline || form.value.title || '封面标题' } } : null,
)

onMounted(async () => {
  try {
    categories.value = await adminApi.categories()
    if (isNew) {
      form.value = blank(categories.value[0]?.id ?? 0)
    } else {
      const p = await adminApi.product(Number(route.params.id))
      const { cards, reserved: r, soldCards: s, ...rest } = p
      form.value = rest
      splitMode.value = guessSplit(cards)
      cardsText.value = joinCards(cards, splitMode.value)
      savedCards.value = cards
      reserved.value = r
      soldCards.value = s
      loadTrash()
    }
  } catch (e) {
    loadError.value = errorText(e)
  }
})

// v-model.number 在输入框清空时得到 ''，转为 NaN 交给服务端校验报错
const num = (v: unknown) => (v === '' || v == null ? NaN : Number(v))

async function save() {
  const f = form.value!
  error.value = ''
  if (f.fulfillment === 'auto' && dupCount.value) return (error.value = `卡密中有 ${dupCount.value} 条重复，请检查`)
  if (!(num(f.price) >= 0)) return (error.value = '请填写有效的售价（不能为负数）')
  if (f.fulfillment === 'manual' && !(num(f.stock) >= 0)) return (error.value = '请填写有效的库存（不能为负数）')
  const n = removedCards.value.length
  if (
    n &&
    !confirm(
      `本次保存会移除 ${n} 条原有的可售卡密（共 ${savedCards.value.length} 条，保存后剩 ${savedCards.value.length - n} 条原有卡密）。\n\n` +
        '移除的卡密会放入「卡密回收站」，之后可以恢复或导出。\n\n确定保存？',
    )
  )
    return
  const { id, ...data } = f
  const payload = {
    ...data,
    slug: f.slug.trim(),
    price: num(f.price),
    stock: f.fulfillment === 'manual' ? Math.floor(num(f.stock)) : 0,
    sold: Math.max(0, Math.floor(num(f.sold)) || 0),
    wholesale: f.wholesale
      .map((w) => ({ minQty: Math.floor(num(w.minQty)), unitPrice: num(w.unitPrice) }))
      .filter((w) => w.minQty > 1 && w.unitPrice >= 0),
    cards: f.fulfillment === 'auto' ? cardList.value : [],
  }
  busy.value = true
  try {
    await (isNew ? adminApi.createProduct(payload) : adminApi.updateProduct(id, payload))
    ui.notify('已保存')
    router.push('/admin/products')
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <p v-if="loadError" role="alert" class="card p-10 text-center text-zinc-500">{{ loadError }}</p>
  <p v-else-if="!form || !preview" class="card p-10 text-center text-zinc-500">加载中…</p>
  <form v-else class="grid gap-6 xl:grid-cols-[1fr_360px]" @submit.prevent="save">
    <div class="space-y-6">
      <section class="card space-y-4 p-6">
        <h2 class="font-bold">基本信息</h2>
        <div><label class="label" for="p-title">标题</label><input id="p-title" v-model="form.title" class="input" required /></div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div><label class="label" for="p-slug">链接标识（网址用，小写英文/数字/横杠）</label><input id="p-slug" v-model="form.slug" class="input" placeholder="例如 gemini18 → /products/gemini18" required /></div>
          <div>
            <label class="label" for="p-cat">分类</label>
            <select id="p-cat" v-model.number="form.categoryId" class="input">
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
        </div>
        <div><label class="label" for="p-desc">简介</label><input id="p-desc" v-model="form.description" class="input" /></div>
        <div>
          <span class="label">详情</span>
          <RichEditor v-model="form.content" label="商品详情" placeholder="介绍商品内容、使用说明、售后规则…" />
        </div>
      </section>

      <section class="card space-y-4 p-6">
        <h2 class="font-bold">价格与库存</h2>
        <div class="grid gap-4 sm:grid-cols-3">
          <div><label class="label" for="p-price">售价</label><input id="p-price" v-model.number="form.price" type="number" min="0" step="0.01" class="input" /></div>
          <div>
            <label class="label" for="p-stock">库存</label>
            <input v-if="form.fulfillment === 'auto'" id="p-stock" :value="cardList.length" class="input" disabled title="自动发货的库存等于可售卡密条数" />
            <input v-else id="p-stock" v-model.number="form.stock" type="number" min="0" step="1" class="input" />
          </div>
          <div><label class="label" for="p-sold">销量</label><input id="p-sold" v-model.number="form.sold" type="number" min="0" step="1" class="input" /></div>
        </div>
        <div class="flex flex-wrap gap-6 text-sm">
          <fieldset class="flex items-center gap-4">
            <legend class="sr-only">发货方式</legend>
            <label class="flex items-center gap-2"><input v-model="form.fulfillment" type="radio" value="auto" class="accent-brand" />自动发货</label>
            <label class="flex items-center gap-2"><input v-model="form.fulfillment" type="radio" value="manual" class="accent-brand" />人工发货</label>
          </fieldset>
          <label class="flex items-center gap-2"><input v-model="form.recommended" type="checkbox" class="accent-brand" />首页推荐</label>
        </div>
        <div v-if="form.fulfillment === 'auto'">
          <div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label class="label !mb-0" for="p-cards">可售卡密（支付成功后按顺序自动发出）</label>
            <div class="flex items-center gap-2">
              <div role="radiogroup" aria-label="卡密分隔方式" class="flex rounded-lg bg-zinc-100 p-0.5 text-xs dark:bg-zinc-800">
                <button
                  v-for="m in SPLITS"
                  :key="m.value"
                  type="button"
                  role="radio"
                  :aria-checked="splitMode === m.value"
                  class="rounded-md px-2.5 py-1 transition"
                  :class="splitMode === m.value ? 'bg-white font-semibold shadow-sm dark:bg-zinc-700' : 'text-zinc-500'"
                  @click="setSplit(m.value)"
                >
                  {{ m.label }}
                </button>
              </div>
              <input ref="cardFile" type="file" accept=".txt,text/plain" class="sr-only" tabindex="-1" aria-hidden="true" @change="importCards" />
              <button type="button" class="btn-ghost px-2.5 py-1 text-xs" @click="cardFile?.click()"><Upload class="h-3.5 w-3.5" />导入 TXT</button>
            </div>
          </div>
          <textarea
            id="p-cards"
            v-model="cardsText"
            :rows="splitMode === 'blank' ? 12 : 6"
            class="input font-mono text-xs"
            :placeholder="splitMode === 'line' ? 'XXXX-XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY-YYYY' : 'Email : a@outlook.com\nPass : xxxx\n\nEmail : b@outlook.com\nPass : yyyy'"
          />
          <p class="mt-1.5 text-xs" :class="dupCount ? 'text-red-500' : 'text-zinc-400'">
            共 {{ cardList.length }} 条<template v-if="splitMode === 'blank'">（每条之间空一行，一条可以有多行）</template><template v-if="dupCount">，其中 {{ dupCount }} 条重复</template>
            <template v-if="reserved || soldCards">；另有 {{ reserved }} 条被未支付订单锁定、{{ soldCards }} 条已售出（不在此列表中）</template>
            <template v-if="!isNew && removedCards.length"><span class="text-amber-600">；相比保存前将移除 {{ removedCards.length }} 条</span></template>
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <button v-if="!isNew && savedCards.length" type="button" class="btn-ghost px-2.5 py-1 text-xs" @click="downloadText(`卡密备份-${form.slug}-${stamp()}.txt`, joinCards(savedCards, 'blank'))">
              <Download class="h-3.5 w-3.5" />导出当前卡密
            </button>
            <button v-if="!isNew" type="button" class="btn-ghost px-2.5 py-1 text-xs" @click="openTrash">
              <ArchiveRestore class="h-3.5 w-3.5" />卡密回收站<template v-if="trash.length">（{{ trash.length }}）</template>
            </button>
          </div>
        </div>
        <p v-else class="text-xs text-zinc-400">
          人工发货：买家支付后订单进入"待发货"，在订单管理中手动填写发货内容。<template v-if="!isNew && cardList.length">保存后，原有 {{ cardList.length }} 条可售卡密将被清空。</template>
        </p>
        <div>
          <div class="mb-2 flex items-center justify-between">
            <span class="label mb-0">批发价</span>
            <button type="button" class="btn-ghost py-1.5" @click="form.wholesale.push({ minQty: 2, unitPrice: form.price })"><Plus class="h-4 w-4" />添加</button>
          </div>
          <p v-if="!form.wholesale.length" class="text-xs text-zinc-400">未设置批发价</p>
          <div v-for="(w, i) in form.wholesale" :key="i" class="mb-2 flex items-center gap-2 text-sm">
            <span class="shrink-0">满</span>
            <input v-model.number="w.minQty" type="number" min="2" class="input w-24" :aria-label="`第 ${i + 1} 档起批数量`" />
            <span class="shrink-0">件 单价</span>
            <input v-model.number="w.unitPrice" type="number" min="0" step="0.01" class="input w-28" :aria-label="`第 ${i + 1} 档单价`" />
            <button type="button" class="btn-icon hover:text-red-500" aria-label="删除此档" @click="form.wholesale.splice(i, 1)"><Trash2 class="h-4 w-4" /></button>
          </div>
        </div>
      </section>
    </div>

    <aside class="space-y-6">
      <section class="card space-y-4 p-6">
        <h2 class="font-bold">封面</h2>
        <div class="overflow-hidden rounded-xl"><ProductCover :product="preview" /></div>
        <ImageUpload v-model="form.cover.image" />
        <template v-if="!form.cover.image">
          <p class="text-xs text-zinc-400">未上传图片时，使用下方设置生成渐变封面</p>
          <div><label class="label" for="c-h">主标题</label><input id="c-h" v-model="form.cover.headline" class="input" /></div>
          <div><label class="label" for="c-s">副标题</label><input id="c-s" v-model="form.cover.sub" class="input" /></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="label" for="c-from">渐变起点</label><input id="c-from" v-model="form.cover.from" type="color" class="h-10 w-full cursor-pointer rounded-lg" /></div>
            <div><label class="label" for="c-to">渐变终点</label><input id="c-to" v-model="form.cover.to" type="color" class="h-10 w-full cursor-pointer rounded-lg" /></div>
          </div>
          <label class="flex items-center gap-2 text-sm"><input v-model="form.cover.dark" type="checkbox" class="accent-brand" />深色背景（白字）</label>
        </template>
      </section>
      <div class="card space-y-3 p-6">
        <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
        <button class="btn-primary w-full" :disabled="busy">{{ isNew ? '创建商品' : '保存修改' }}</button>
        <RouterLink to="/admin/products" class="btn-ghost w-full"><ArrowLeft class="h-4 w-4" />返回列表</RouterLink>
      </div>
    </aside>
  </form>

  <AdminModal v-if="trashOpen" title="卡密回收站" wide @close="trashOpen = false">
    <p class="mb-3 text-xs text-zinc-500">保存时被移除的可售卡密会放在这里。勾选后可以加回编辑框（点「保存修改」后重新入库）、导出或彻底删除；不勾选时导出 / 删除全部。</p>
    <p v-if="!trash.length" class="rounded-xl bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:bg-zinc-800">回收站是空的</p>
    <template v-else>
      <label class="mb-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          class="accent-brand"
          :checked="trashPick.length === trash.length"
          @change="trashPick = ($event.target as HTMLInputElement).checked ? trash.map((t) => t.id) : []"
        />
        全选（共 {{ trash.length }} 条，已选 {{ trashPick.length }} 条）
      </label>
      <ul class="max-h-[50vh] space-y-2 overflow-y-auto">
        <li v-for="t in trash" :key="t.id">
          <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-black/5 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-800">
            <input v-model="trashPick" type="checkbox" :value="t.id" class="mt-1 accent-brand" />
            <div class="min-w-0 flex-1">
              <pre class="max-h-32 overflow-y-auto font-mono text-xs whitespace-pre-wrap break-all">{{ t.code }}</pre>
              <p class="mt-1 text-[11px] text-zinc-400">移除于 {{ new Date(t.deletedAt).toLocaleString() }}</p>
            </div>
          </label>
        </li>
      </ul>
      <div class="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" class="btn-danger mr-auto" @click="purgeTrash"><Trash2 class="h-4 w-4" />彻底删除{{ trashPick.length ? '所选' : '全部' }}</button>
        <button type="button" class="btn-ghost" @click="exportTrash"><Download class="h-4 w-4" />导出{{ trashPick.length ? '所选' : '全部' }}</button>
        <button type="button" class="btn-primary" :disabled="!trashPick.length" @click="restorePicked"><ArchiveRestore class="h-4 w-4" />加回编辑框</button>
      </div>
    </template>
  </AdminModal>
</template>
