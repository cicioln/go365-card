import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SiteConfig } from '../data/mock'
import { getSite } from '../api'

/** 站点设置（名称、描述、货币等），启动时从服务端加载 */
export const useSiteStore = defineStore('site', () => {
  const site = ref<SiteConfig>({ siteName: 'Go365 Card', description: '', telegram: '', currency: 'CNY' })

  async function load() {
    try {
      site.value = await getSite()
    } catch {
      /* 加载失败时保留默认值 */
    }
  }

  return { site, load }
})
