<script setup lang="ts">
import { computed, ref } from 'vue'
import { Shapes, Trash2, Search, Upload, Loader2, Check } from 'lucide-vue-next'
import type { LibraryIcon } from '../../types'
import { adminApi } from '../../adminApi'
import { IMAGE_ACCEPT, checkImage } from '../../utils/image'
import { errorText } from '../../http'
import AdminModal from './AdminModal.vue'

/** 统一的图标选择组件：从图标库选择，或上传新图标（自动加入图标库） */
const model = defineModel<string | undefined>()
withDefaults(defineProps<{ label?: string; hint?: string }>(), { label: '从图标库选择', hint: '' })

const open = ref(false)
const icons = ref<LibraryIcon[] | null>(null)
const keyword = ref('')
const busy = ref(false)
const error = ref('')
const input = ref<HTMLInputElement>()

const shown = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return (icons.value ?? []).filter((i) => !k || i.name.toLowerCase().includes(k))
})

async function show() {
  open.value = true
  error.value = ''
  try {
    icons.value = await adminApi.icons()
  } catch (e) {
    error.value = errorText(e)
  }
}

function pick(url: string) {
  model.value = url
  open.value = false
}

/** 上传新图标：保留原图（透明背景），加入图标库后直接选中 */
async function upload(file?: File) {
  error.value = ''
  if (!file) return
  if ((error.value = checkImage(file))) return
  if (file.size > 3 * 1024 * 1024) return (error.value = '图片不能超过 3MB')
  busy.value = true
  try {
    const { url } = await adminApi.upload(file, file.name)
    await adminApi.addIcon(url, file.name.replace(/\.\w+$/, '').slice(0, 40))
    pick(url)
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
    if (input.value) input.value.value = ''
  }
}
</script>

<template>
  <div>
    <div class="flex items-center gap-2">
      <button type="button" class="btn-ghost flex-1" @click="show"><Shapes class="h-4 w-4" />{{ model ? '更换图标' : label }}</button>
      <button v-if="model" type="button" class="btn-danger" @click="model = undefined"><Trash2 class="h-4 w-4" />移除</button>
    </div>
    <p v-if="hint" class="mt-1.5 text-xs text-zinc-400">{{ hint }}</p>

    <AdminModal v-if="open" title="选择图标" wide @close="open = false">
      <input ref="input" type="file" :accept="IMAGE_ACCEPT.join(',')" class="sr-only" tabindex="-1" aria-hidden="true" @change="upload(($event.target as HTMLInputElement).files?.[0])" />
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <div class="relative min-w-0 flex-1">
          <Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input v-model="keyword" class="input pl-9" placeholder="搜索图标名称" aria-label="搜索图标" />
        </div>
        <button type="button" class="btn-primary" :disabled="busy" @click="input?.click()">
          <Loader2 v-if="busy" class="h-4 w-4 animate-spin" /><Upload v-else class="h-4 w-4" />上传新图标
        </button>
      </div>
      <p v-if="error" role="alert" class="mb-3 text-sm text-red-500">{{ error }}</p>
      <p v-if="!icons" class="py-10 text-center text-sm text-zinc-500">加载中…</p>
      <p v-else-if="!shown.length" class="py-10 text-center text-sm text-zinc-500">{{ icons.length ? '没有匹配的图标' : '图标库还是空的，点右上角上传第一个图标' }}</p>
      <ul v-else class="grid max-h-[50vh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
        <li v-for="i in shown" :key="i.id">
          <button
            type="button"
            class="relative flex w-full flex-col items-center gap-1.5 rounded-xl border p-2 text-xs transition hover:border-brand"
            :class="model === i.url ? 'border-brand bg-brand-soft dark:bg-brand/15' : 'border-black/10 dark:border-white/10'"
            :title="i.name"
            :aria-pressed="model === i.url"
            @click="pick(i.url)"
          >
            <img :src="i.url" :alt="i.name" class="h-10 w-10 object-contain" loading="lazy" />
            <span class="w-full truncate text-center text-zinc-500">{{ i.name }}</span>
            <Check v-if="model === i.url" class="absolute top-1 right-1 h-3.5 w-3.5 text-brand" />
          </button>
        </li>
      </ul>
      <p class="mt-4 text-xs text-zinc-400">建议上传正方形透明 PNG，≤ 3MB。图标的改名、删除在后台「图标库」页面管理。</p>
    </AdminModal>
  </div>
</template>
