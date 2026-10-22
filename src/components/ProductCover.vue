<script setup lang="ts">
import type { Product } from '../data/mock'

// 用渐变 + 文字生成原创封面，不使用原站图片
defineProps<{ product: Product; large?: boolean }>()
</script>

<template>
  <div v-if="product.cover.image" class="aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
    <img :src="product.cover.image" :alt="product.title" class="h-full w-full object-cover" loading="lazy" decoding="async" />
  </div>
  <div
    v-else
    class="relative flex aspect-[16/10] w-full flex-col justify-center overflow-hidden px-5"
    :style="{ background: `linear-gradient(135deg, ${product.cover.from}, ${product.cover.to})` }"
    :class="product.cover.dark ? 'text-white' : 'text-zinc-900'"
    role="img"
    :aria-label="product.title"
  >
    <div
      class="pointer-events-none absolute -right-6 -bottom-10 h-36 w-36 rounded-full opacity-30 blur-2xl"
      :class="product.cover.dark ? 'bg-amber-300' : 'bg-sky-400'"
    />
    <div
      class="pointer-events-none absolute right-5 top-1/2 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-2xl border text-3xl font-black backdrop-blur"
      :class="[product.cover.dark ? 'border-white/20 bg-white/10' : 'border-black/10 bg-white/70', large && 'h-24 w-24 text-5xl']"
    >
      {{ product.cover.headline.replace(/[^A-Za-z✦]/g, '').charAt(0) || '★' }}
    </div>
    <p class="relative font-extrabold leading-tight tracking-tight" :class="large ? 'text-5xl' : 'text-2xl'">
      {{ product.cover.headline }}
    </p>
    <p
      v-if="product.cover.sub"
      class="relative mt-1 font-bold"
      :class="[large ? 'text-3xl' : 'text-xl', product.cover.dark ? 'text-amber-200' : 'text-brand']"
    >
      {{ product.cover.sub }}
    </p>
  </div>
</template>
