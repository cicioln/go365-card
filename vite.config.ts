import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// 开发时把接口和上传文件转发到后端（npm run dev:server，默认 3000 端口）
const backend = process.env.BACKEND_URL ?? 'http://localhost:3000'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: false },
      '/uploads': { target: backend },
    },
  },
  preview: {
    proxy: {
      '/api': { target: backend, changeOrigin: false },
      '/uploads': { target: backend },
    },
  },
})
