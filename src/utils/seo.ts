// SEO 标题与描述（前后端共用）：服务端渲染 index.html 时写入 <head>，前端切换路由时同步更新
import type { SeoPageKey, SiteConfig } from '../data/mock.ts'

/** 可在后台配置的页面 */
export const SEO_PAGES: { key: SeoPageKey; path: string; label: string }[] = [
  { key: 'home', path: '/', label: '首页' },
  { key: 'products', path: '/products', label: '商品中心' },
  { key: 'notice', path: '/notice', label: '公告' },
  { key: 'about', path: '/about', label: '关于' },
  { key: 'guestOrders', path: '/guest/orders', label: '订单查询' },
  { key: 'cart', path: '/cart', label: '购物车' },
]

/** 不希望被搜索引擎收录的页面（含个人订单信息或后台） */
export const NOINDEX = /^\/(admin|orders|checkout|me|auth)(\/|$)/

export interface PageMeta {
  title: string
  description: string
  keywords: string
  noindex: boolean
}

/** 详情页（商品、文章）由页面自己提供标题和描述 */
export interface DetailMeta {
  title: string
  description?: string
}

/**
 * 计算某个路径的标题、描述和关键词。代码里不内置任何默认文案，全部来自后台设置
 * （首次安装时写入一套初始值，见 server/db.ts 的 initSeo）。
 * - 页面标题留空时显示站点名称；首页不套模板，其余页面套用标题模板，模板留空时只显示页面标题
 * - 页面描述留空时用站点描述
 */
export function resolveMeta(site: SiteConfig, path: string, detail?: DetailMeta | null): PageMeta {
  const name = site.siteName
  const seo = site.seo ?? { titleTemplate: '', keywords: '', pages: {} }
  const tpl = seo.titleTemplate.trim() || '{title}'
  const wrap = (title: string) => (title ? tpl.split('{title}').join(title).split('{site}').join(name) : name)
  const clean = path.replace(/\/+$/, '') || '/'
  const page = SEO_PAGES.find((p) => p.path === clean)
  const custom = page ? seo.pages?.[page.key] : undefined
  const base = { keywords: seo.keywords || '', noindex: NOINDEX.test(clean) }

  if (detail) return { ...base, title: wrap(detail.title), description: detail.description || site.description || name }
  if (page?.key === 'home')
    return { ...base, title: custom?.title || name, description: custom?.description || site.description || name }
  return {
    ...base,
    title: wrap(custom?.title || ''),
    description: custom?.description || site.description || name,
  }
}

/** 富文本转一段纯文本摘要，用作描述 */
export const plainText = (html: string, max = 150) =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, '').replace(/\s+/g, ' ').trim().slice(0, max)
