import { createI18n } from 'vue-i18n'
import { load } from './stores/storage'

const zh = {
  nav: { home: '首页', products: '商品中心', blog: '博客', notice: '公告', about: '关于', cart: '购物车', guestOrders: '订单查询', login: '登录', me: '个人中心', logout: '退出' },
  home: {
    notice: '网站公告', detail: '查看详情', selfQuery: '订单查询', noLogin: '无需登录', tg: 'TG 售后群', official: '官方售后',
    all: '全部', news: '最新动态', newsSub: '随时掌握我们的最新消息和公告', readMore: '阅读更多',
    heroSub: '数字商品自动发货，下单即用', hot: '热门商品', hotSub: '精选商品，库存实时更新', viewAll: '查看全部',
    perkAuto: '自动发货', perkAutoSub: '付款后秒发卡密', perk24: '7×24 小时', perk24Sub: '全天候自助下单',
    perkSafe: '安全支付', perkSafeSub: '多种支付方式', perkAfter: '售后无忧', perkAfterSub: '问题及时处理',
  },
  product: {
    auto: '自动交付', manual: '人工交付', recommend: '推荐', buy: '快速购买', stock: '库存', sold: '已售', soldOut: '售罄',
    center: '商品中心', centerSub: '浏览我们的精选商品', search: '搜索', searchPh: '搜索商品名称', category: '分类', allProducts: '全部商品',
    empty: '暂无商品', qty: '购买数量', addCart: '加入购物车', buyNow: '立即购买', wholesale: '批发价', wholesaleRow: '满 {n} 件 {p}/件',
    detail: '商品详情', added: '已加入购物车', back: '返回',
  },
  cart: { title: '购物车', empty: '购物车是空的', go: '去逛逛', total: '合计', checkout: '去结算', remove: '删除', unit: '单价' },
  checkout: {
    title: '确认订单', email: '接收邮箱', emailPh: '用于接收卡密和查单', password: '查单密码', passwordPh: '查询订单时使用，至少 4 位',
    channel: '支付方式', fee: '手续费', pay: '提交订单', amount: '应付金额', invalidEmail: '请输入有效邮箱', invalidPwd: '查单密码至少 4 位', noChannel: '暂无可用的支付方式，请联系客服',
  },
  order: {
    title: '订单详情', no: '订单号', status: '状态', pending: '待支付', paid: '已支付', delivered: '已发货', created: '下单时间',
    closed: '已关闭', payNow: '去支付', cards: '卡密', copy: '复制', copied: '已复制', notFound: '订单不存在',
    copyAll: '复制全部', exportTxt: '导出 TXT', cardCount: '共 {n} 条', copyFail: '复制失败，请手动选择文本复制',
    payHint: '请在 {time} 前完成支付，超时订单将自动关闭', closedHint: '订单已超时关闭，库存已释放。如已付款请联系客服。',
    saveHint: '请妥善保存。凭此页面链接或「订单查询」可再次查看。',
    waitManual: '已支付，订单中含人工发货商品，客服处理后会在此显示发货内容，页面会自动刷新。',
  },
  usdt: {
    title: 'USDT 扫码支付', network: '网络', amount: '转账金额', address: '收款地址', qrAlt: '收款地址二维码',
    copyAmount: '复制金额', copyAddress: '复制地址',
    exact: '请转账精确金额 {amount} USDT（含小数），金额不符无法自动确认',
    chainOnly: '只支持 {network} 网络的 USDT，转错网络资金无法找回',
    deadline: '请在 {time} 前完成转账',
    waiting: '等待链上到账，确认后自动发货，页面会自动刷新',
  },
  guest: { title: '订单查询', sub: '输入订单号或邮箱与查单密码查询订单', keyword: '订单号 / 邮箱', password: '查单密码', query: '查询', none: '未找到匹配的订单' },
  auth: {
    login: '用户登录', loginSub: '欢迎回来，继续你的订单流程。', register: '注册账号', registerSub: '创建账号，管理你的订单。',
    email: '邮箱', emailPh: '请输入邮箱', password: '密码', passwordPh: '请输入密码', captcha: '验证码', captchaPh: '请输入图片验证码',
    remember: '记住我', noAccount: '还没有账号？', toRegister: '立即注册', hasAccount: '已有账号？', toLogin: '去登录',
    invalid: '邮箱或密码错误', exists: '该邮箱已注册', captchaWrong: '验证码错误', backHome: '返回首页', refresh: '换一张', pwdShort: '密码至少 6 位',
  },
  me: { title: '个人中心', orders: '我的订单', none: '暂无订单' },
  about: { title: '关于我们', body: '{site} 提供 AI 订阅、账号与 CDK 的自动发货服务。' },
  posts: { blog: '博客', notice: '公告', empty: '暂无内容' },
  footer: { quick: '快速链接', tg: 'TG交流群', rights: '保留所有权利', privacy: '隐私政策', terms: '服务条款' },
  legal: { privacy: '隐私政策', terms: '服务条款', body: '本页面为演示内容。' },
  common: { close: '关闭', loading: '正在加载…', notFound: '页面不存在' },
}

type Messages = typeof zh

const en: Messages = {
  nav: { home: 'Home', products: 'Products', blog: 'Blog', notice: 'Notice', about: 'About', cart: 'Cart', guestOrders: 'Order Lookup', login: 'Login', me: 'Account', logout: 'Logout' },
  home: {
    notice: 'Announcement', detail: 'Details', selfQuery: 'Order Lookup', noLogin: 'No login', tg: 'TG Support', official: 'Official',
    all: 'All', news: 'Latest News', newsSub: 'Stay up to date with our news', readMore: 'Read more',
    heroSub: 'Digital goods with instant delivery', hot: 'Popular', hotSub: 'Hand-picked products, live stock', viewAll: 'View all',
    perkAuto: 'Instant delivery', perkAutoSub: 'Cards sent right after payment', perk24: '24/7', perk24Sub: 'Order any time',
    perkSafe: 'Secure payment', perkSafeSub: 'Multiple methods', perkAfter: 'After-sales', perkAfterSub: 'Fast support',
  },
  product: {
    auto: 'Auto', manual: 'Manual', recommend: 'Hot', buy: 'Buy', stock: 'Stock', sold: 'Sold', soldOut: 'Sold out',
    center: 'Products', centerSub: 'Browse our selection', search: 'Search', searchPh: 'Search products', category: 'Categories', allProducts: 'All products',
    empty: 'No products', qty: 'Quantity', addCart: 'Add to cart', buyNow: 'Buy now', wholesale: 'Wholesale', wholesaleRow: '{n}+ pcs {p} each',
    detail: 'Details', added: 'Added to cart', back: 'Back',
  },
  cart: { title: 'Cart', empty: 'Your cart is empty', go: 'Shop now', total: 'Total', checkout: 'Checkout', remove: 'Remove', unit: 'Unit' },
  checkout: {
    title: 'Checkout', email: 'Email', emailPh: 'Receives cards and order info', password: 'Lookup password', passwordPh: 'At least 4 characters',
    channel: 'Payment', fee: 'Fee', pay: 'Place order', amount: 'Amount due', invalidEmail: 'Enter a valid email', invalidPwd: 'Password needs 4+ characters', noChannel: 'No payment method available, please contact support',
  },
  order: {
    title: 'Order', no: 'Order No.', status: 'Status', pending: 'Unpaid', paid: 'Paid', delivered: 'Delivered', created: 'Created',
    closed: 'Closed', payNow: 'Pay now', cards: 'Cards', copy: 'Copy', copied: 'Copied', notFound: 'Order not found',
    copyAll: 'Copy all', exportTxt: 'Export TXT', cardCount: '{n} total', copyFail: 'Copy failed, please select the text manually',
    payHint: 'Please pay before {time}; unpaid orders close automatically', closedHint: 'This order timed out and was closed. Contact support if you already paid.',
    saveHint: 'Keep these safe. You can view them again via this page link or Order Lookup.',
    waitManual: 'Paid. This order contains manually delivered items; delivery details will appear here once processed.',
  },
  usdt: {
    title: 'Pay with USDT', network: 'Network', amount: 'Amount', address: 'Address', qrAlt: 'Payment address QR code',
    copyAmount: 'Copy amount', copyAddress: 'Copy address',
    exact: 'Send exactly {amount} USDT including decimals, otherwise the payment cannot be matched automatically',
    chainOnly: 'Only USDT on {network} is supported; funds sent on another network cannot be recovered',
    deadline: 'Please complete the transfer before {time}',
    waiting: 'Waiting for the on-chain transfer. Items are delivered automatically once confirmed.',
  },
  guest: { title: 'Order Lookup', sub: 'Enter order number or email and the lookup password', keyword: 'Order No. / Email', password: 'Password', query: 'Search', none: 'No matching orders' },
  auth: {
    login: 'Sign in', loginSub: 'Welcome back.', register: 'Sign up', registerSub: 'Create an account to manage orders.',
    email: 'Email', emailPh: 'Enter email', password: 'Password', passwordPh: 'Enter password', captcha: 'Captcha', captchaPh: 'Enter captcha',
    remember: 'Remember me', noAccount: 'No account?', toRegister: 'Sign up', hasAccount: 'Have an account?', toLogin: 'Sign in',
    invalid: 'Wrong email or password', exists: 'Email already registered', captchaWrong: 'Wrong captcha', backHome: 'Home', refresh: 'Refresh', pwdShort: 'Password needs 6+ characters',
  },
  me: { title: 'Account', orders: 'My orders', none: 'No orders yet' },
  about: { title: 'About', body: '{site} offers auto-delivered AI subscriptions, accounts and CDKs.' },
  posts: { blog: 'Blog', notice: 'Notice', empty: 'Nothing here yet' },
  footer: { quick: 'Quick links', tg: 'Telegram', rights: 'All rights reserved', privacy: 'Privacy', terms: 'Terms' },
  legal: { privacy: 'Privacy Policy', terms: 'Terms of Service', body: 'Demo content.' },
  common: { close: 'Close', loading: 'Loading…', notFound: 'Page not found' },
}

export const i18n = createI18n({
  legacy: false,
  locale: load<string>('locale', 'zh-CN'),
  fallbackLocale: 'zh-CN',
  messages: { 'zh-CN': zh, 'en-US': en },
})
