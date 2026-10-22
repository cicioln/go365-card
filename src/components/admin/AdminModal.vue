<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { X } from 'lucide-vue-next'

defineProps<{ title: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const onKey = (e: KeyboardEvent) => e.key === 'Escape' && emit('close')
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" @click.self="emit('close')">
    <div role="dialog" aria-modal="true" :aria-label="title" class="card my-8 w-full p-6" :class="wide ? 'max-w-2xl' : 'max-w-md'">
      <div class="mb-5 flex items-center justify-between">
        <h2 class="text-lg font-bold">{{ title }}</h2>
        <button class="btn-icon" aria-label="关闭" @click="emit('close')"><X class="h-5 w-5" /></button>
      </div>
      <slot />
    </div>
  </div>
</template>
