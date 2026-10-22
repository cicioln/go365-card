<script setup lang="ts">
import type { Product } from '../data/mock'

// 用渐变 + 文字生成原创封面，不使用原站图片
defineProps<{ product: Product; large?: boolean }>()
</script>

<template>
  <div v-if="product.cover.image" class="aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
    <img
      :src="product.cover.image"
      :alt="product.title"
      class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      loading="lazy"
      decoding="async"
    />
  </div>
  <div
    v-else
    class="relative flex aspect-[16/10] w-full flex-col justify-center overflow-hidden"
    :class="[product.cover.dark ? 'text-white' : 'text-zinc-900', large ? 'px-8 pr-40 sm:px-10 sm:pr-44' : 'px-4 sm:px-5 sm:pr-24']"
    :style="{ background: `linear-gradient(135deg, ${product.cover.from}, ${product.cover.to})` }"
    role="img"
    :aria-label="product.title"
  >
    <div
      class="pointer-events-none absolute -right-6 -bottom-10 h-36 w-36 rounded-full opacity-30 blur-2xl transition duration-500 group-hover:scale-125"
      :class="product.cover.dark ? 'bg-amber-300' : 'bg-sky-400'"
    />
    <!-- 字母徽标：窄卡片下隐藏，文字区域预留右侧空间，避免与长标题重叠 -->
    <div
      class="pointer-events-none absolute top-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border font-black backdrop-blur"
      :class="[
        product.cover.dark ? 'border-white/20 bg-white/10' : 'border-black/10 bg-white/70',
        large ? 'right-8 flex h-24 w-24 text-5xl sm:right-10 sm:h-28 sm:w-28' : 'right-4 hidden h-14 w-14 text-2xl sm:flex',
      ]"
    >
      {{ product.cover.headline.replace(/[^A-Za-z✦]/g, '').charAt(0) || '★' }}
    </div>
    <p
      class="relative line-clamp-2 font-extrabold leading-tight tracking-tight break-words"
      :class="large ? 'text-3xl sm:text-5xl' : 'text-lg sm:text-xl'"
    >
      {{ product.cover.headline }}
    </p>
    <p
      v-if="product.cover.sub"
      class="relative mt-1 truncate font-bold"
      :class="[large ? 'text-xl sm:text-3xl' : 'text-sm sm:text-lg', product.cover.dark ? 'text-amber-200' : 'text-brand']"
    >
      {{ product.cover.sub }}
    </p>
  </div>
</template>
