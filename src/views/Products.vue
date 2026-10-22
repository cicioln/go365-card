<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { getCategories, getProducts } from '../api'
import type { Category, Product } from '../data/mock'
import ProductCard from '../components/ProductCard.vue'
import SkeletonCard from '../components/SkeletonCard.vue'

const { t } = useI18n()
const categories = ref<Category[]>([])
const list = ref<Product[]>([])
const loading = ref(true)
const route = useRoute()
const keyword = ref(typeof route.query.q === 'string' ? route.query.q : '')
const cat = ref<number | undefined>()

async function refresh() {
  loading.value = true
  list.value = await getProducts({ categoryId: cat.value, keyword: keyword.value })
  loading.value = false
}

let timer: number | undefined
watch(keyword, () => {
  clearTimeout(timer)
  timer = window.setTimeout(refresh, 250)
})
watch(cat, refresh)

onMounted(async () => {
  categories.value = await getCategories()
  refresh()
})

const item = 'w-full rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition'
</script>

<template>
  <section class="py-8 sm:py-10">
    <h1 class="text-3xl font-black tracking-tight sm:text-4xl">{{ t('product.center') }}</h1>
    <p class="mt-2 text-zinc-500">{{ t('product.centerSub') }}</p>
  </section>

  <div class="flex flex-col gap-6 md:flex-row">
    <aside class="card h-fit p-5 md:sticky md:top-24 md:w-60 md:shrink-0">
      <label for="kw" class="text-xs font-bold text-zinc-500">{{ t('product.search') }}</label>
      <input id="kw" v-model="keyword" class="input mt-2" :placeholder="t('product.searchPh')" />
      <h2 class="mt-6 border-l-4 border-brand pl-2 text-lg font-bold">{{ t('product.category') }}</h2>
      <div class="mt-4 flex flex-col gap-1">
        <button :class="[item, cat === undefined ? 'bg-brand text-white' : 'hover:bg-black/5 dark:hover:bg-white/10']" @click="cat = undefined">
          {{ t('product.allProducts') }}
        </button>
        <button
          v-for="c in categories"
          :key="c.id"
          :class="[item, cat === c.id ? 'bg-brand text-white' : 'hover:bg-black/5 dark:hover:bg-white/10']"
          @click="cat = c.id"
        >
          {{ c.name }}
        </button>
      </div>
    </aside>

    <div class="grid flex-1 grid-cols-2 content-start gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      <template v-if="loading"><SkeletonCard v-for="i in 8" :key="i" /></template>
      <template v-else>
        <ProductCard v-for="p in list" :key="p.id" :product="p" />
        <p v-if="!list.length" class="col-span-full py-16 text-center text-zinc-500">{{ t('product.empty') }}</p>
      </template>
    </div>
  </div>
</template>
