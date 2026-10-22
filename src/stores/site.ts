import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { SiteConfig } from '../data/mock'
import { getSite } from '../api'
import type { DetailMeta } from '../utils/seo'

/** 默认 Logo（黑色线条，深色模式下需反色） */
export const DEFAULT_LOGO = '/logo.svg'

/** 站点设置（名称、描述、货币等），启动时从服务端加载 */
export const useSiteStore = defineStore('site', () => {
  // 生产环境由服务端在 index.html 里注入 window.__SITE__；本地 vite 开发时没有，等接口返回
  const injected = (window as { __SITE__?: SiteConfig }).__SITE__
  const site = ref<SiteConfig>(
    injected ?? { siteName: '', description: '', telegram: '', currency: 'CNY', logo: '', favicon: '', seo: { titleTemplate: '', keywords: '', pages: {} } },
  )
  /** 商品、文章详情页加载后设置，用于浏览器标题和描述 */
  const detail = ref<DetailMeta | null>(null)

  /** 当前 Logo；custom 为 true 时是后台上传的图片，深色模式下不反色 */
  const logo = computed(() => ({ src: site.value.logo || DEFAULT_LOGO, custom: !!site.value.logo }))

  async function load() {
    try {
      site.value = await getSite()
    } catch {
      /* 加载失败时保留默认值 */
    }
  }

  return { site, logo, detail, load }
})
