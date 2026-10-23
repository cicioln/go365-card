<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Upload, Loader2, Search, Pencil, Trash2 } from 'lucide-vue-next'
import type { LibraryIcon } from '../../types'
import { adminApi } from '../../adminApi'
import { IMAGE_ACCEPT, checkImage } from '../../utils/image'
import { useUiStore } from '../../stores/ui'
import { errorText } from '../../http'

const ui = useUiStore()
const icons = ref<LibraryIcon[] | null>(null)
const keyword = ref('')
const busy = ref(false)
const input = ref<HTMLInputElement>()
const dragging = ref(false)

const shown = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return (icons.value ?? []).filter((i) => !k || i.name.toLowerCase().includes(k))
})

async function load() {
  try {
    icons.value = await adminApi.icons()
  } catch (e) {
    ui.notify(errorText(e))
  }
}
onMounted(load)

/** 支持一次选择多张，逐张上传加入图标库 */
async function upload(files?: FileList | null) {
  if (!files?.length) return
  busy.value = true
  let ok = 0
  for (const file of Array.from(files)) {
    const err = checkImage(file) || (file.size > 3 * 1024 * 1024 ? '图片不能超过 3MB' : '')
    if (err) {
      ui.notify(`${file.name}：${err}`)
      continue
    }
    try {
      const { url } = await adminApi.upload(file, file.name)
      await adminApi.addIcon(url, file.name.replace(/\.\w+$/, '').slice(0, 40))
      ok++
    } catch (e) {
      ui.notify(`${file.name}：${errorText(e)}`)
    }
  }
  busy.value = false
  if (input.value) input.value.value = ''
  if (ok) ui.notify(`已上传 ${ok} 个图标`)
  load()
}

async function rename(i: LibraryIcon) {
  const name = prompt('图标名称', i.name)?.trim()
  if (!name || name === i.name) return
  try {
    await adminApi.renameIcon(i.id, name)
    i.name = name
  } catch (e) {
    ui.notify(errorText(e))
  }
}

async function remove(i: LibraryIcon) {
  if (!confirm(`确定删除图标「${i.name}」？图片文件会一并删除。`)) return
  try {
    await adminApi.deleteIcon(i.id)
    ui.notify('已删除')
    load()
  } catch (e) {
    ui.notify(errorText(e))
  }
}
</script>

<template>
  <div
    class="card overflow-hidden"
    :class="dragging ? 'ring-2 ring-brand' : ''"
    @dragover.prevent="dragging = true"
    @dragleave.self="dragging = false"
    @drop.prevent="dragging = false; upload($event.dataTransfer?.files)"
  >
    <input ref="input" type="file" multiple :accept="IMAGE_ACCEPT.join(',')" class="sr-only" tabindex="-1" aria-hidden="true" @change="upload(($event.target as HTMLInputElement).files)" />
    <div class="flex flex-wrap items-center gap-3 p-4">
      <p class="text-sm text-zinc-500">分类、支付渠道、Logo 等处的图标统一从这里选择。可拖拽图片到此处上传。</p>
      <div class="relative ml-auto w-full sm:w-56">
        <Search class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input v-model="keyword" class="input pl-9" placeholder="搜索图标名称" aria-label="搜索图标" />
      </div>
      <button class="btn-primary" :disabled="busy" @click="input?.click()">
        <Loader2 v-if="busy" class="h-4 w-4 animate-spin" /><Upload v-else class="h-4 w-4" />上传图标
      </button>
    </div>
    <p v-if="!icons" class="py-16 text-center text-sm text-zinc-500">加载中…</p>
    <p v-else-if="!shown.length" class="py-16 text-center text-sm text-zinc-500">{{ icons.length ? '没有匹配的图标' : '还没有图标，点右上角上传（建议正方形透明 PNG，≤ 3MB）' }}</p>
    <ul v-else class="grid grid-cols-2 gap-3 p-4 pt-0 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      <li v-for="i in shown" :key="i.id" class="group rounded-xl border border-black/10 p-3 dark:border-white/10">
        <div class="flex h-16 items-center justify-center rounded-lg bg-zinc-50 dark:bg-white/5">
          <img :src="i.url" :alt="i.name" class="h-12 w-12 object-contain" loading="lazy" />
        </div>
        <p class="mt-2 truncate text-sm font-medium" :title="i.name">{{ i.name }}</p>
        <p class="truncate text-xs" :class="i.usedBy.length ? 'text-emerald-600' : 'text-zinc-400'" :title="i.usedBy.join('、')">
          {{ i.usedBy.length ? `使用中 · ${i.usedBy.join('、')}` : '未使用' }}
        </p>
        <div class="mt-2 flex justify-end gap-1">
          <button class="btn-icon" :aria-label="`重命名 ${i.name}`" @click="rename(i)"><Pencil class="h-4 w-4" /></button>
          <button
            class="btn-icon hover:text-red-500 disabled:opacity-30"
            :aria-label="`删除 ${i.name}`"
            :disabled="!!i.usedBy.length"
            :title="i.usedBy.length ? '使用中的图标不能删除' : '删除'"
            @click="remove(i)"
          >
            <Trash2 class="h-4 w-4" />
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
