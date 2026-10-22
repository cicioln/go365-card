<script setup lang="ts">
import { ref } from 'vue'
import { ImagePlus, Trash2, Loader2 } from 'lucide-vue-next'
import { IMAGE_ACCEPT as ACCEPT, checkImage, compressImage } from '../../utils/image'
import { adminApi } from '../../adminApi'
import { errorText } from '../../http'

const model = defineModel<string | undefined>()
const props = withDefaults(
  defineProps<{
    label?: string
    hint?: string
    /** 不压缩直接上传（Logo、图标需保留透明背景） */
    raw?: boolean
  }>(),
  { label: '点击或拖拽上传封面图', hint: 'PNG / JPG / WebP / GIF，≤ 5MB，建议 16:10', raw: false },
)

const input = ref<HTMLInputElement>()
const dragging = ref(false)
const busy = ref(false)
const error = ref('')

async function handle(file?: File) {
  error.value = ''
  if (!file) return
  if ((error.value = checkImage(file))) return
  busy.value = true
  try {
    // 浏览器端压缩后上传到服务器，只保存图片地址
    if (props.raw && file.size > 3 * 1024 * 1024) throw new Error('图片不能超过 3MB')
    const { blob, name } = props.raw ? { blob: file, name: file.name } : await compressImage(file)
    model.value = (await adminApi.upload(blob, name)).url
    size.value = Math.round(blob.size / 1024)
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
    if (input.value) input.value.value = ''
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  handle(e.dataTransfer?.files[0])
}

/** 本次上传压缩后的体积（KB） */
const size = ref(0)
</script>

<template>
  <div>
    <input ref="input" type="file" :accept="ACCEPT.join(',')" class="sr-only" tabindex="-1" aria-hidden="true" @change="handle(($event.target as HTMLInputElement).files?.[0])" />
    <div v-if="model" class="flex items-center gap-2">
      <button type="button" class="btn-ghost flex-1" :disabled="busy" @click="input?.click()"><ImagePlus class="h-4 w-4" />更换图片</button>
      <button type="button" class="btn-danger" @click="model = undefined"><Trash2 class="h-4 w-4" />移除</button>
    </div>
    <button
      v-else
      type="button"
      class="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-sm transition"
      :class="dragging ? 'border-brand bg-brand-soft text-brand dark:bg-brand/10' : 'border-black/10 text-zinc-500 hover:border-brand hover:text-brand dark:border-white/15'"
      :disabled="busy"
      @click="input?.click()"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <Loader2 v-if="busy" class="h-6 w-6 animate-spin" />
      <ImagePlus v-else class="h-6 w-6" />
      <span class="font-medium">{{ label }}</span>
      <span class="text-xs text-zinc-400">{{ hint }}</span>
    </button>
    <p v-if="model && size" class="mt-1.5 text-xs text-zinc-400">{{ raw ? `已上传（${size} KB）` : `已压缩为 ${size} KB 并上传` }}</p>
    <p v-if="error" role="alert" class="mt-1.5 text-sm text-red-500">{{ error }}</p>
  </div>
</template>
