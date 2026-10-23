<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '../data/mock'
import { brandOf } from '../utils/brand'

// 用渐变 + 文字生成原创封面，不使用原站图片
const props = withDefaults(defineProps<{ product: Product; size?: 'sm' | 'md' | 'lg'; out?: boolean }>(), { size: 'md' })
const brand = computed(() => brandOf(props.product.title))
const pad = { sm: 'p-2.5', md: 'p-3 sm:p-4', lg: 'p-6 sm:p-8' }
const hl = { sm: 'text-sm', md: 'text-base sm:text-2xl', lg: 'text-3xl sm:text-5xl' }
const sub = { sm: 'hidden', md: 'text-[10.5px] sm:text-[12.5px]', lg: 'text-sm sm:text-[17px]' }
const brandPos = { sm: 'hidden', md: 'top-2.5 left-3 text-[9px] sm:top-3.5 sm:left-4 sm:text-[11px]', lg: 'top-6 left-6 text-[11px] sm:top-7 sm:left-8' }
</script>

<template>
  <div
    class="relative isolate aspect-[16/10] w-full overflow-hidden transition duration-300"
    :class="[{ 'opacity-55 grayscale': out }, size === 'lg' ? 'aspect-[4/3] rounded-[22px]' : 'rounded-2xl']"
  >
    <img
      v-if="product.cover.image"
      :src="product.cover.image"
      :alt="product.title"
      class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      loading="lazy"
      decoding="async"
    />
    <div
      v-else
      class="flex h-full flex-col justify-end after:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(120%_80%_at_100%_0%,rgb(255_255_255/18%),transparent_55%)]"
      :class="[product.cover.dark ? 'text-white' : 'text-ink-fixed', pad[size]]"
      :style="{ background: `linear-gradient(135deg, ${product.cover.from}, ${product.cover.to})` }"
      role="img"
      :aria-label="product.title"
    >
      <span v-if="brand" class="absolute font-mono font-bold tracking-[0.1em] opacity-70" :class="brandPos[size]">{{ brand }}</span>
      <p class="line-clamp-2 leading-[1.05] font-extrabold tracking-[-0.03em] break-words" :class="hl[size]">{{ product.cover.headline }}</p>
      <p v-if="product.cover.sub" class="mt-0.5 truncate opacity-75" :class="sub[size]">{{ product.cover.sub }}</p>
    </div>
    <slot />
  </div>
</template>

<style scoped>
/* 浅色封面上的文字固定用墨黑，不随深色模式反转 */
.text-ink-fixed { color: #15171c; }
</style>
