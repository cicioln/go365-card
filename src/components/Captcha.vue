<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getCaptcha } from '../api'

// 服务端生成的图形验证码，答案只保存在服务端；emit 出验证码 id，提交时一并带上
const emit = defineEmits<{ change: [id: string] }>()
const svg = ref('')
const busy = ref(false)
const src = computed(() => (svg.value ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.value)}` : ''))

async function refresh() {
  if (busy.value) return
  busy.value = true
  try {
    const r = await getCaptcha()
    svg.value = r.svg
    emit('change', r.id)
  } catch {
    svg.value = ''
    emit('change', '')
  } finally {
    busy.value = false
  }
}

onMounted(refresh)
defineExpose({ refresh })
</script>

<template>
  <button type="button" class="h-[42px] w-[110px] shrink-0 overflow-hidden rounded-xl bg-[#eef2f7]" aria-label="验证码，点击刷新" @click="refresh">
    <img v-if="src" :src="src" alt="" class="h-full w-full" />
    <span v-else class="text-xs text-ink-3">点击加载</span>
  </button>
</template>
