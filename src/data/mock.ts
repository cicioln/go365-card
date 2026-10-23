// 前后端共用的数据类型，以及服务端首次启动时写入数据库的演示数据

export interface Category {
  id: number
  slug: string
  name: string
  /** 分类图标的简写字符 */
  glyph: string
  color: string
  /** 上传的图标图片地址，优先于字符显示 */
  icon?: string
}

export interface Product {
  id: number
  slug: string
  categoryId: number
  title: string
  description: string
  content: string
  price: number
  wholesale: { minQty: number; unitPrice: number }[]
  stock: number
  sold: number
  fulfillment: 'auto' | 'manual'
  /** 自动发货的卡密库存，库存数 = 卡密条数 */
  cards?: string[]
  recommended: boolean
  /** 封面：有 image 时显示图片，否则用渐变与标题文字生成 */
  cover: { from: string; to: string; headline: string; sub: string; dark: boolean; image?: string }
}

export interface Post {
  id: number
  slug: string
  type: 'notice' | 'blog'
  title: string
  summary: string
  content: string
  publishedAt: string
}

export interface PaymentChannel {
  id: number
  name: string
  type: 'alipay' | 'wechat' | 'usdt'
  feeRate: number
  enabled?: boolean
  /** USDT 渠道：填写链与收款地址时使用内置收款（扫码转账、链上自动确认），留空走易支付 */
  chain?: '' | 'bsc' | 'tron' | 'eth' | 'polygon'
  address?: string
  /** 汇率：1 USDT = rate 站点货币 */
  rate?: number
  /** 上传的图标图片地址，空则按类型显示默认图标 */
  icon?: string
}

export interface SiteConfig {
  siteName: string
  description: string
  telegram: string
  currency: 'CNY' | 'USD'
  /** 站点 Logo 图片地址，留空使用默认 Logo */
  logo: string
  /** 浏览器标签图标，留空则使用 Logo */
  favicon: string
  seo: SeoConfig
}

export type SeoPageKey = 'home' | 'products' | 'notice' | 'about' | 'guestOrders' | 'cart'

export interface SeoConfig {
  /** 标题模板，{title} 为页面标题，{site} 为站点名称；留空为「{title} - {site}」 */
  titleTemplate: string
  /** meta keywords，逗号分隔 */
  keywords: string
  /** 各页面的标题和描述，留空使用默认值 */
  pages: Partial<Record<SeoPageKey, { title: string; description: string }>>
}

export const siteConfig: SiteConfig = {
  siteName: 'Go365 Card',
  description: 'Go365-AI之家',
  // 留空时前台不显示 TG 交流群入口
  telegram: '',
  currency: 'CNY',
  logo: '',
  favicon: '',
  seo: { titleTemplate: '', keywords: '', pages: {} },
}

export const categories: Category[] = [
  { id: 2, slug: 'gpt', name: 'GPT', glyph: '◎', color: '#10a37f' },
  { id: 5, slug: 'gemini', name: 'Gemini', glyph: '✦', color: '#4285f4' },
  { id: 1, slug: 'go365', name: 'Go365', glyph: '◆', color: '#111827' },
  { id: 3, slug: 'mail', name: 'mail', glyph: '✉', color: '#ea4335' },
  { id: 4, slug: 'site', name: '卡网搭建', glyph: '卡', color: '#0071e3' },
]

const afterSale =
  '<p style="color:#ef4444">售后须知：请从下单到登录全程录屏，作为售后凭证。无完整录屏，不提供售后。</p>'

export const products: Product[] = [
  {
    id: 42, slug: 'gemini18', categoryId: 5,
    title: 'Gemini Pro 18个月 优惠链接【无需绑卡】',
    description: 'Google AI Pro【18个月】领取优惠链接（无需绑卡）',
    content: `${afterSale}<h2>Google AI Pro 18个月优惠订阅链接</h2><p>链接上架前均已测活，可正常使用。必须当天激活，超过 24 小时无售后。</p><p>使用方法：</p><ul><li>登录你的谷歌账号</li><li>打开优惠链接</li><li>切换 / 使用优惠</li></ul>`,
    price: 6.8, wholesale: [{ minQty: 5, unitPrice: 5.8 }, { minQty: 10, unitPrice: 5.3 }],
    stock: 22, sold: 2533, fulfillment: 'auto', recommended: true,
    cover: { from: '#0b1026', to: '#2a2f5a', headline: 'GeminiPro', sub: '18个月', dark: true },
  },
  {
    id: 12, slug: 'chatgpt-plus-account', categoryId: 2,
    title: 'ChatGPT Plus 【成品号】',
    description: '已开通 Plus 的成品账号，自动发货',
    content: `${afterSale}<p>购买后自动发送账号与密码，请及时修改密码并开启两步验证。</p>`,
    price: 15.8, wholesale: [], stock: 7, sold: 2024, fulfillment: 'auto', recommended: true,
    cover: { from: '#1a1408', to: '#3b2f12', headline: 'GPT Plus', sub: '1个月 成品号', dark: true },
  },
  {
    id: 18, slug: 'gpt-plus-card', categoryId: 2,
    title: '【正价卡充】GPT plus 1个月【质保订阅30天】',
    description: '正价卡充值，质保 30 天',
    content: `${afterSale}<p>下单时填写账号邮箱，人工 / 自动处理后到账。</p>`,
    price: 126.8, wholesale: [], stock: 2, sold: 1160, fulfillment: 'auto', recommended: true,
    cover: { from: '#06231f', to: '#0f5a4e', headline: 'GPT Plus', sub: '1个月充值', dark: true },
  },
  {
    id: 20, slug: 'chatgpt-pro', categoryId: 2,
    title: 'ChatGPT Pro 5X/20X 官方充值(USDT)',
    description: 'Pro 5X 直充 / 20X 续费',
    content: `${afterSale}<p>仅支持 USDT 支付通道。</p>`,
    price: 688, wholesale: [], stock: 11, sold: 399, fulfillment: 'auto', recommended: true,
    cover: { from: '#0d0d0d', to: '#2b2b2b', headline: 'GPT PRO', sub: '5X / 20X', dark: true },
  },
  {
    id: 25, slug: 'grok-super', categoryId: 1,
    title: 'Grok Super会员 1个月 官方直充【CDK自助】',
    description: 'CDK 自助兑换',
    content: `${afterSale}<p>获得 CDK 后在兑换页自助充值。</p>`,
    price: 258, wholesale: [], stock: 0, sold: 207, fulfillment: 'auto', recommended: true,
    cover: { from: '#111', to: '#333', headline: 'GROK SUPER', sub: '会员一个月', dark: true },
  },
  {
    id: 30, slug: 'gpt-go', categoryId: 2,
    title: 'GPT GO会员 1个月 官方直充 【卡密自助】',
    description: '卡密自助充值 GPT Go',
    content: `${afterSale}<p>收到卡密后按说明自助充值。</p>`,
    price: 44.8, wholesale: [], stock: 3, sold: 583, fulfillment: 'auto', recommended: true,
    cover: { from: '#f4f6f8', to: '#dfe7ee', headline: 'GPT Go', sub: '1个月充值', dark: false },
  },
  {
    id: 33, slug: 'claude-pro', categoryId: 1,
    title: 'Claude Pro 1个月 官方直充 【自助充值】',
    description: 'Claude Pro 自助充值',
    content: `${afterSale}<p>iOS 正规渠道充值。</p>`,
    price: 146.8, wholesale: [], stock: 2, sold: 32, fulfillment: 'auto', recommended: true,
    cover: { from: '#fbf3ea', to: '#f5dcc4', headline: 'Claude Pro', sub: 'iOS 正规充值', dark: false },
  },
  {
    id: 36, slug: 'codex-cdk', categoryId: 3,
    title: '美国实卡 codex 一次接码cdk',
    description: '一次接码 CDK，100% 包接码',
    content: `${afterSale}<p>CDK 仅可使用一次。</p>`,
    price: 2.5, wholesale: [{ minQty: 20, unitPrice: 2.2 }], stock: 157, sold: 1372, fulfillment: 'auto', recommended: true,
    cover: { from: '#121212', to: '#3a3a3a', headline: 'CODEX', sub: '一次接码 CDK', dark: true },
  },
  {
    id: 40, slug: 'gemini3', categoryId: 5,
    title: 'GeminiPro 3个月优惠链接',
    description: 'Google AI Pro 3 个月优惠链接',
    content: `${afterSale}<p>必须当天激活。</p>`,
    price: 6.8, wholesale: [], stock: 12, sold: 433, fulfillment: 'auto', recommended: true,
    cover: { from: '#f7f8fb', to: '#eef1f7', headline: '✦ Gemini', sub: '', dark: false },
  },
]

export const posts: Post[] = [
  {
    id: 1, slug: 'notice', type: 'notice', title: '公告', summary: '',
    content: '<p><strong>GPT Pro 20X可续费 5X可直充</strong></p><p><strong>老年人作息，售后请留言，看到就处理</strong></p>',
    publishedAt: '2026-10-01',
  },
  {
    id: 2, slug: 'how-to-buy', type: 'blog', title: '购买与查单指南', summary: '下单、支付、收取卡密以及游客查单的完整流程说明。',
    content: '<h2>下单流程</h2><ol><li>选择商品与数量，加入购物车或立即购买</li><li>填写接收邮箱与查单密码</li><li>选择支付方式完成支付</li><li>系统自动发货，卡密显示在订单页</li></ol><h2>游客查单</h2><p>无需登录，使用订单号或邮箱加查单密码即可查询历史订单。</p>',
    publishedAt: '2026-10-10',
  },
]

export const paymentChannels: PaymentChannel[] = [
  { id: 1, name: '支付宝(2%手续费)', type: 'alipay', feeRate: 2 },
  { id: 2, name: '微信(3.5%手续费)', type: 'wechat', feeRate: 3.5 },
  { id: 3, name: 'USDT_BEP20', type: 'usdt', feeRate: 0 },
]
