<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Trash2, ArrowLeft } from 'lucide-vue-next'
import type { Category, Product } from '../../data/mock'
import { adminApi } from '../../adminApi'
import { useUiStore } from '../../stores/ui'
import ProductCover from '../../components/ProductCover.vue'
import ImageUpload from '../../components/admin/ImageUpload.vue'
import RichEditor from '../../components/admin/RichEditor.vue'
import { errorText } from '../../http'

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

// 自动发货的卡密库存：每行一条，库存数自动等于卡密条数
const cardsText = ref('')
const cardList = computed(() => cardsText.value.split('\n').map((s) => s.trim()).filter(Boolean))
const dupCount = computed(() => cardList.value.length - new Set(cardList.value).size)
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
      cardsText.value = cards.join('\n')
      reserved.value = r
      soldCards.value = s
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
          <div><label class="label" for="p-slug">Slug（URL）</label><input id="p-slug" v-model="form.slug" class="input" placeholder="例如 gemini18" required /></div>
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
          <label class="label" for="p-cards">可售卡密（每行一条，支付成功后按顺序自动发出）</label>
          <textarea id="p-cards" v-model="cardsText" rows="6" class="input font-mono text-xs" placeholder="XXXX-XXXX-XXXX-XXXX" />
          <p class="mt-1.5 text-xs" :class="dupCount ? 'text-red-500' : 'text-zinc-400'">
            共 {{ cardList.length }} 条<template v-if="dupCount">，其中 {{ dupCount }} 条重复</template>
            <template v-if="reserved || soldCards">；另有 {{ reserved }} 条被未支付订单锁定、{{ soldCards }} 条已售出（不在此列表中）</template>
          </p>
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
</template>
