import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const dark = ref(document.documentElement.classList.contains('dark'))
  const toast = ref<{ text: string; id: number } | null>(null)
  let timer: number | undefined

  function toggleTheme() {
    dark.value = !dark.value
    document.documentElement.classList.toggle('dark', dark.value)
    try {
      localStorage.setItem('theme', dark.value ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }

  function notify(text: string) {
    toast.value = { text, id: Date.now() }
    clearTimeout(timer)
    timer = window.setTimeout(() => (toast.value = null), 2200)
  }

  return { dark, toggleTheme, toast, notify }
})
