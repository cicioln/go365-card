<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus, Pencil, Trash2 } from 'lucide-vue-next'
import type { Category } from '../../data/mock'
import { adminApi, type AdminCategory } from '../../adminApi'
import { useUiStore } from '../../stores/ui'
import AdminModal from '../../components/admin/AdminModal.vue'
import IconPicker from '../../components/admin/IconPicker.vue'
import { errorText } from '../../http'

const ui = useUiStore()
const list = ref<AdminCategory[]>([])
const editing = ref<Category | null>(null)
const error = ref('')
const busy = ref(false)

async function load() {
  try {
    list.value = await adminApi.categories()
  } catch (e) {
    ui.notify(errorText(e))
  }
}
onMounted(load)

function open(c?: Category) {
  error.value = ''
  editing.value = c
    ? { id: c.id, slug: c.slug, name: c.name, glyph: c.glyph, color: c.color, icon: c.icon || undefined }
    : { id: 0, slug: '', name: '', glyph: '★', color: '#0071e3' }
}

async function save() {
  error.value = ''
  busy.value = true
  try {
    await adminApi.saveCategory({ ...editing.value!, icon: editing.value!.icon ?? '' })
    editing.value = null
    ui.notify('已保存')
    load()
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}

async function remove(c: AdminCategory) {
  if (c.productCount) return ui.notify('该分类下还有商品，无法删除')
  if (!confirm(`确定删除分类「${c.name}」？`)) return
  try {
    await adminApi.deleteCategory(c.id)
    load()
  } catch (e) {
    ui.notify(errorText(e))
  }
}

// 上移 / 下移调整前台展示顺序
async function move(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= list.value.length) return
  const next = [...list.value]
  ;[next[i], next[j]] = [next[j], next[i]]
  list.value = next
  try {
    await adminApi.reorderCategories(next.map((c) => c.id))
  } catch (e) {
    ui.notify(errorText(e))
    load()
  }
}
</script>

<template>
  <div class="card overflow-hidden">
    <div class="flex items-center p-4">
      <p class="text-sm text-zinc-500">列表顺序即前台展示顺序</p>
      <button class="btn-primary ml-auto" @click="open()"><Plus class="h-4 w-4" />新增分类</button>
    </div>
    <div class="overflow-x-auto">
      <table class="tbl">
        <thead><tr><th>排序</th><th>分类</th><th>链接标识</th><th>商品数</th><th class="text-right">操作</th></tr></thead>
        <tbody>
          <tr v-for="(c, i) in list" :key="c.id">
            <td>
              <div class="flex gap-1">
                <button class="btn-icon" :disabled="i === 0" aria-label="上移" @click="move(i, -1)">↑</button>
                <button class="btn-icon" :disabled="i === list.length - 1" aria-label="下移" @click="move(i, 1)">↓</button>
              </div>
            </td>
            <td>
              <span class="flex items-center gap-3">
                <img v-if="c.icon" :src="c.icon" alt="" class="h-8 w-8 rounded-lg object-contain" />
                <span v-else class="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white" :style="{ background: c.color }">{{ c.glyph }}</span>
                <span class="font-medium">{{ c.name }}</span>
              </span>
            </td>
            <td class="text-zinc-500">{{ c.slug }}</td>
            <td>{{ c.productCount }}</td>
            <td>
              <div class="flex justify-end gap-1">
                <button class="btn-icon" aria-label="编辑" @click="open(c)"><Pencil class="h-4 w-4" /></button>
                <button class="btn-icon hover:text-red-500" aria-label="删除" @click="remove(c)"><Trash2 class="h-4 w-4" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <AdminModal v-if="editing" :title="editing.id ? '编辑分类' : '新增分类'" @close="editing = null">
    <form class="space-y-4" @submit.prevent="save">
      <div><label class="label" for="c-name">名称</label><input id="c-name" v-model="editing.name" class="input" required /></div>
      <div><label class="label" for="c-slug">链接标识（小写英文/数字/横杠）</label><input id="c-slug" v-model="editing.slug" class="input" placeholder="例如 gpt" required /></div>
      <div>
        <span class="label">图标</span>
        <div class="flex items-center gap-3">
          <img v-if="editing.icon" :src="editing.icon" alt="图标预览" class="h-12 w-12 shrink-0 rounded-lg object-contain" />
          <span v-else class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white" :style="{ background: editing.color }">{{ editing.glyph }}</span>
          <IconPicker v-model="editing.icon" class="flex-1" />
        </div>
      </div>
      <div v-if="!editing.icon" class="grid grid-cols-2 gap-4">
        <div><label class="label" for="c-glyph">图标字符（未上传图标时显示）</label><input id="c-glyph" v-model="editing.glyph" maxlength="2" class="input" /></div>
        <div><label class="label" for="c-color">背景颜色</label><input id="c-color" v-model="editing.color" type="color" class="h-10 w-full cursor-pointer rounded-lg" /></div>
      </div>
      <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="editing = null">取消</button>
        <button class="btn-primary" :disabled="busy">保存</button>
      </div>
    </form>
  </AdminModal>
</template>
