<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus, Pencil, Trash2, Search, Eye } from 'lucide-vue-next'
import type { Category, Product } from '../../data/mock'
import { adminApi } from '../../adminApi'
import { useUiStore } from '../../stores/ui'
import { money } from '../../components/admin/status'
import { errorText } from '../../http'

const ui = useUiStore()
const products = ref<Product[]>([])
const categories = ref<Category[]>([])
const loading = ref(true)
const keyword = ref('')
const categoryId = ref(0)

async function load() {
  try {
    ;[products.value, categories.value] = await Promise.all([adminApi.products(), adminApi.categories()])
  } catch (e) {
    ui.notify(errorText(e))
  } finally {
    loading.value = false
  }
}
onMounted(load)

const catName = (id: number) => categories.value.find((c) => c.id === id)?.name ?? '-'
const list = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return products.value.filter(
    (p) => (!categoryId.value || p.categoryId === categoryId.value) && (!kw || p.title.toLowerCase().includes(kw) || p.slug.includes(kw)),
  )
})

async function toggleRecommended(p: Product, value: boolean) {
  try {
    await adminApi.setRecommended(p.id, value)
    p.recommended = value
  } catch (e) {
    ui.notify(errorText(e))
  }
}

async function remove(p: Product) {
  if (!confirm(`确定删除商品「${p.title}」？未售出的卡密会移入卡密回收站，历史订单不受影响。`)) return
  try {
    await adminApi.deleteProduct(p.id)
    ui.notify('已删除')
    load()
  } catch (e) {
    ui.notify(errorText(e))
  }
}
</script>

<template>
  <div class="card overflow-hidden">
    <div class="flex flex-wrap items-center gap-3 p-4">
      <div class="relative w-full sm:w-64">
        <Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input v-model="keyword" class="input pl-9" placeholder="搜索标题 / slug" aria-label="搜索商品" />
      </div>
      <select v-model.number="categoryId" class="input w-auto" aria-label="按分类筛选">
        <option :value="0">全部分类</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
      <RouterLink to="/admin/products/new" class="btn-primary ml-auto"><Plus class="h-4 w-4" />新增商品</RouterLink>
    </div>
    <div class="overflow-x-auto">
      <table class="tbl">
        <thead><tr><th>商品</th><th>分类</th><th>价格</th><th>库存</th><th>销量</th><th>发货</th><th>推荐</th><th class="text-right">操作</th></tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="8" class="py-10 text-center text-zinc-500">加载中…</td></tr>
          <tr v-else-if="!list.length"><td colspan="8" class="py-10 text-center text-zinc-500">没有商品</td></tr>
          <tr v-for="p in list" :key="p.id">
            <td>
              <div class="flex min-w-64 items-center gap-3">
                <img v-if="p.cover.image" :src="p.cover.image" alt="" class="h-11 w-11 shrink-0 rounded-lg object-cover" />
                <span
                  v-else
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-black"
                  :class="p.cover.dark ? 'text-white' : 'text-zinc-900'"
                  :style="{ background: `linear-gradient(135deg, ${p.cover.from}, ${p.cover.to})` }"
                  aria-hidden="true"
                >{{ (p.cover.headline || p.title).charAt(0) }}</span>
                <div class="min-w-0">
                  <p class="line-clamp-2 font-medium">{{ p.title }}</p>
                  <p class="text-xs text-zinc-400">#{{ p.id }} · {{ p.slug }}</p>
                </div>
              </div>
            </td>
            <td>{{ catName(p.categoryId) }}</td>
            <td class="font-semibold text-price">{{ money(p.price) }}</td>
            <td>
              <span :class="p.stock === 0 ? 'font-bold text-red-500' : p.stock <= 10 ? 'font-bold text-amber-500' : ''">{{ p.stock }}</span>
            </td>
            <td>{{ p.sold }}</td>
            <td>
              <span class="badge" :class="p.fulfillment === 'auto' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : 'bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300'">
                {{ p.fulfillment === 'auto' ? '自动' : '人工' }}
              </span>
            </td>
            <td>
              <input
                type="checkbox"
                class="h-4 w-4 accent-brand"
                :checked="p.recommended"
                :aria-label="`推荐 ${p.title}`"
                @change="toggleRecommended(p, ($event.target as HTMLInputElement).checked)"
              />
            </td>
            <td>
              <div class="flex justify-end gap-1">
                <RouterLink :to="`/products/${p.slug}`" target="_blank" class="btn-icon" aria-label="前台查看"><Eye class="h-4 w-4" /></RouterLink>
                <RouterLink :to="`/admin/products/${p.id}`" class="btn-icon" aria-label="编辑"><Pencil class="h-4 w-4" /></RouterLink>
                <button class="btn-icon hover:text-red-500" aria-label="删除" @click="remove(p)"><Trash2 class="h-4 w-4" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
