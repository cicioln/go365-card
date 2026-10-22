<script setup lang="ts">
import { ref, watch, onBeforeUnmount, type Component } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Placeholder } from '@tiptap/extensions'
import {
  Bold, Italic, Underline, Strikethrough, Heading2, Heading3, List, ListOrdered,
  Quote, Link2, ImagePlus, Minus, Undo2, Redo2, RemoveFormatting, Loader2,
} from 'lucide-vue-next'
import { IMAGE_ACCEPT, checkImage, compressImage } from '../../utils/image'
import { adminApi } from '../../adminApi'
import { errorText } from '../../http'

const model = defineModel<string>({ default: '' })
const props = defineProps<{ placeholder?: string; label?: string }>()

const error = ref('')
const busy = ref(false)
const fileInput = ref<HTMLInputElement>()

const editor = useEditor({
  content: model.value,
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    Image.configure({ allowBase64: true }),
    Placeholder.configure({ placeholder: props.placeholder ?? '请输入内容…' }),
  ],
  editorProps: {
    attributes: {
      class: 'prose-content min-h-48 px-4 py-3 text-sm outline-none',
      role: 'textbox',
      'aria-multiline': 'true',
      ...(props.label ? { 'aria-label': props.label } : {}),
    },
  },
  onUpdate: ({ editor }) => {
    model.value = editor.isEmpty ? '' : editor.getHTML()
  },
})

// 外部替换内容（如切换编辑对象）时同步到编辑器
watch(model, (v) => {
  const e = editor.value
  if (e && v !== (e.isEmpty ? '' : e.getHTML())) e.commands.setContent(v, { emitUpdate: false })
})

onBeforeUnmount(() => editor.value?.destroy())

function setLink() {
  const e = editor.value
  if (!e) return
  const prev = e.getAttributes('link').href as string | undefined
  const url = window.prompt('链接地址（留空则移除链接）', prev ?? 'https://')
  if (url === null) return
  const chain = e.chain().focus().extendMarkRange('link')
  if (!url.trim()) chain.unsetLink().run()
  else chain.setLink({ href: url.trim() }).run()
}

async function insertImage(file?: File) {
  error.value = ''
  if (!file || !editor.value) return
  if ((error.value = checkImage(file))) return
  busy.value = true
  try {
    const { blob, name } = await compressImage(file, 800)
    const { url } = await adminApi.upload(blob, name)
    editor.value?.chain().focus().setImage({ src: url }).run()
  } catch (e) {
    error.value = errorText(e)
  } finally {
    busy.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

type Tool = { icon: Component; title: string; run: () => void; active?: () => boolean } | 'sep'
const c = () => editor.value!.chain().focus()
const is = (name: string, attrs?: Record<string, unknown>) => () => !!editor.value?.isActive(name, attrs)
const tools: Tool[] = [
  { icon: Bold, title: '加粗', run: () => c().toggleBold().run(), active: is('bold') },
  { icon: Italic, title: '斜体', run: () => c().toggleItalic().run(), active: is('italic') },
  { icon: Underline, title: '下划线', run: () => c().toggleUnderline().run(), active: is('underline') },
  { icon: Strikethrough, title: '删除线', run: () => c().toggleStrike().run(), active: is('strike') },
  'sep',
  { icon: Heading2, title: '标题', run: () => c().toggleHeading({ level: 2 }).run(), active: is('heading', { level: 2 }) },
  { icon: Heading3, title: '小标题', run: () => c().toggleHeading({ level: 3 }).run(), active: is('heading', { level: 3 }) },
  { icon: List, title: '无序列表', run: () => c().toggleBulletList().run(), active: is('bulletList') },
  { icon: ListOrdered, title: '有序列表', run: () => c().toggleOrderedList().run(), active: is('orderedList') },
  { icon: Quote, title: '引用', run: () => c().toggleBlockquote().run(), active: is('blockquote') },
  { icon: Minus, title: '分割线', run: () => c().setHorizontalRule().run() },
  'sep',
  { icon: Link2, title: '链接', run: setLink, active: is('link') },
  { icon: ImagePlus, title: '插入图片', run: () => fileInput.value?.click() },
  { icon: RemoveFormatting, title: '清除格式', run: () => c().unsetAllMarks().clearNodes().run() },
  'sep',
  { icon: Undo2, title: '撤销', run: () => c().undo().run() },
  { icon: Redo2, title: '重做', run: () => c().redo().run() },
]
</script>

<template>
  <div
    class="overflow-hidden rounded-xl border border-black/10 bg-white transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15 dark:border-white/10 dark:bg-zinc-950"
  >
    <div role="toolbar" aria-label="格式工具栏" class="flex flex-wrap items-center gap-0.5 border-b border-black/5 bg-zinc-50 px-2 py-1.5 dark:border-white/10 dark:bg-white/5">
      <template v-for="(t, i) in tools" :key="i">
        <span v-if="t === 'sep'" class="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" aria-hidden="true" />
        <button
          v-else
          type="button"
          class="btn-icon"
          :class="t.active?.() && 'bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand'"
          :title="t.title"
          :aria-label="t.title"
          :aria-pressed="t.active ? t.active() : undefined"
          :disabled="!editor || (t.icon === ImagePlus && busy)"
          @mousedown.prevent
          @click="t.run"
        >
          <Loader2 v-if="t.icon === ImagePlus && busy" class="h-4 w-4 animate-spin" />
          <component :is="t.icon" v-else class="h-4 w-4" />
        </button>
      </template>
    </div>
    <EditorContent :editor="editor" />
    <input ref="fileInput" type="file" :accept="IMAGE_ACCEPT.join(',')" class="sr-only" tabindex="-1" aria-hidden="true" @change="insertImage(($event.target as HTMLInputElement).files?.[0])" />
  </div>
  <p v-if="error" role="alert" class="mt-1.5 text-sm text-red-500">{{ error }}</p>
</template>
