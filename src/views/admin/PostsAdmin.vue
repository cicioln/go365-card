<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Plus, Pencil, Trash2, Eye } from 'lucide-vue-next'
import type { Post } from '../../data/mock'
import { adminApi } from '../../adminApi'
import { useUiStore } from '../../stores/ui'
import AdminModal from '../../components/admin/AdminModal.vue'
import RichEditor from '../../components/admin/RichEditor.vue'
import { errorText } from '../../http'

const ui = useUiStore()
const list = ref<Post[]>([])
const editing = ref<Post | null>(null)
const error = ref('')
const busy = ref(false)

async function load() {
  try {
    list.value = await adminApi.posts()
  } catch (e) {
    ui.notify(errorText(e))
  }
}
onMounted(load)

function open(p?: Post) {
  error.value = ''
  editing.value = p
    ? { ...p, publishedAt: p.publishedAt.slice(0, 10) }
    : { id: 0, slug: '', type: 'notice', title: '', summary: '', content: '', publishedAt: new Date().toISOString().slice(0, 10) }
}

async function save() {
  error.value = ''
  busy.value = true
  try {
    // 正文 HTML 在服务端按白名单过滤
    await adminApi.savePost(editing.value!)
    editing.value = null
    ui.notify('已保存')
    load()
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
  }
}

async function remove(p: Post) {
  if (!confirm(`确定删除「${p.title}」？`)) return
  try {
    await adminApi.deletePost(p.id)
    load()
  } catch (e) {
    ui.notify(errorText(e))
  }
}
</script>

<template>
  <div class="card overflow-hidden">
    <div class="flex items-center p-4">
      <p class="text-sm text-zinc-500">最新一条公告会显示在首页顶部</p>
      <button class="btn-primary ml-auto" @click="open()"><Plus class="h-4 w-4" />新增文章</button>
    </div>
    <div class="overflow-x-auto">
      <table class="tbl">
        <thead><tr><th>标题</th><th>类型</th><th>Slug</th><th>发布日期</th><th class="text-right">操作</th></tr></thead>
        <tbody>
          <tr v-if="!list.length"><td colspan="5" class="py-10 text-center text-zinc-500">暂无文章</td></tr>
          <tr v-for="p in list" :key="p.id">
            <td class="min-w-56 font-medium">{{ p.title }}</td>
            <td>
              <span class="badge" :class="p.type === 'notice' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15' : 'bg-brand-soft text-brand dark:bg-brand/15'">
                {{ p.type === 'notice' ? '公告' : '博客' }}
              </span>
            </td>
            <td class="text-zinc-500">{{ p.slug }}</td>
            <td class="whitespace-nowrap text-zinc-500">{{ new Date(p.publishedAt).toLocaleDateString() }}</td>
            <td>
              <div class="flex justify-end gap-1">
                <RouterLink :to="`/posts/${p.slug}`" target="_blank" class="btn-icon" aria-label="前台查看"><Eye class="h-4 w-4" /></RouterLink>
                <button class="btn-icon" aria-label="编辑" @click="open(p)"><Pencil class="h-4 w-4" /></button>
                <button class="btn-icon hover:text-red-500" aria-label="删除" @click="remove(p)"><Trash2 class="h-4 w-4" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <AdminModal v-if="editing" :title="editing.id ? '编辑文章' : '新增文章'" wide @close="editing = null">
    <form class="space-y-4" @submit.prevent="save">
      <div><label class="label" for="po-title">标题</label><input id="po-title" v-model="editing.title" class="input" required /></div>
      <div class="grid gap-4 sm:grid-cols-3">
        <div><label class="label" for="po-slug">Slug</label><input id="po-slug" v-model="editing.slug" class="input" required /></div>
        <div>
          <label class="label" for="po-type">类型</label>
          <select id="po-type" v-model="editing.type" class="input"><option value="notice">公告</option><option value="blog">博客</option></select>
        </div>
        <div><label class="label" for="po-date">发布日期</label><input id="po-date" v-model="editing.publishedAt" type="date" class="input" required /></div>
      </div>
      <div><label class="label" for="po-sum">摘要</label><input id="po-sum" v-model="editing.summary" class="input" /></div>
      <div><span class="label">正文</span><RichEditor v-model="editing.content" label="文章正文" /></div>
      <p v-if="error" role="alert" class="text-sm text-red-500">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="editing = null">取消</button>
        <button class="btn-primary" :disabled="busy">保存</button>
      </div>
    </form>
  </AdminModal>
</template>
