import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource/plus-jakarta-sans/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import '@fontsource/plus-jakarta-sans/latin-800.css'
import '@fontsource/jetbrains-mono/latin-500.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { useSiteStore } from './stores/site'
import { useAuthStore } from './stores/auth'

const app = createApp(App).use(createPinia()).use(router).use(i18n)
useSiteStore().load()
useAuthStore().init()
app.mount('#app')
