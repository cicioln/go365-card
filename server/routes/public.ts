import { Hono } from 'hono'
import { checkCaptcha, createCaptcha } from '../captcha.ts'
import { hashPassword, queryHash, safeEqual, verifyOrderToken, verifyPassword } from '../crypto.ts'
import { all, findPost, getSite, listCategories, listChannels, listPosts, one, run, PRODUCT_SQL, toProduct, type ProductRow } from '../db.ts'
import { createOrder, findOrder, toOrder, type OrderRow } from '../orders.ts'
import { payUrl } from '../pay.ts'
import { publicUrl } from '../settings.ts'
import { endSession, rateLimit, sessionOf, startSession } from '../security.ts'
import { body, email, fail, num, password, str } from '../validate.ts'

export const pub = new Hono()

const currentUser = (c: Parameters<typeof sessionOf>[0]) => {
  const id = sessionOf(c, 'user')
  return id ? one<{ id: number; email: string }>('SELECT id, email FROM users WHERE id = ?', id) ?? null : null
}

// ---- 目录 ----

pub.get('/site', (c) => c.json(getSite()))
pub.get('/categories', (c) => c.json(listCategories()))
// 收款地址只在订单里返回
pub.get('/channels', (c) => c.json(listChannels().filter((ch) => ch.enabled).map(({ address: _a, rate: _r, ...ch }) => ch)))

pub.get('/products', (c) => {
  const cat = Number(c.req.query('categoryId')) || 0
  const kw = (c.req.query('keyword') ?? '').trim().toLowerCase().slice(0, 50)
  const list = all<ProductRow>(`${PRODUCT_SQL} ORDER BY p.sort, p.id`)
    .map(toProduct)
    .filter((p) => (!cat || p.categoryId === cat) && (!kw || p.title.toLowerCase().includes(kw)))
  return c.json(list)
})

pub.get('/products/:slug', (c) => {
  const r = one<ProductRow>(`${PRODUCT_SQL} WHERE p.slug = ?`, c.req.param('slug'))
  return r ? c.json(toProduct(r)) : fail('商品不存在', 404)
})

/** 按 id 批量取商品（购物车刷新价格与库存） */
pub.get('/products-by-ids', (c) => {
  const ids = (c.req.query('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50)
  if (!ids.length) return c.json([])
  const rows = all<ProductRow>(`${PRODUCT_SQL} WHERE p.id IN (${ids.map(() => '?').join(',')})`, ...ids)
  return c.json(rows.map(toProduct))
})

pub.get('/posts', (c) => {
  const type = c.req.query('type')
  return c.json(listPosts().filter((p) => !type || p.type === type))
})
pub.get('/posts/:slug', (c) => c.json(findPost(c.req.param('slug')) ?? fail('文章不存在', 404)))

// ---- 验证码 ----

pub.get('/captcha', rateLimit('captcha', 60, 60), (c) => c.json(createCaptcha()))

// ---- 用户账号 ----

pub.get('/auth/me', (c) => c.json({ user: currentUser(c)?.email ?? null }))

pub.post('/auth/register', rateLimit('register', 10, 3600), async (c) => {
  const b = await body(c)
  if (!checkCaptcha(b.captchaId, b.captcha)) fail('验证码错误')
  const e = email(b.email)
  const pwd = password(b.password, 6)
  if (one('SELECT 1 FROM users WHERE email = ?', e)) fail('该邮箱已注册')
  const r = run('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)', e, hashPassword(pwd), new Date().toISOString())
  startSession(c, 'user', Number(r.lastInsertRowid))
  return c.json({ user: e })
})

pub.post('/auth/login', rateLimit('login', 20, 900), async (c) => {
  const b = await body(c)
  if (!checkCaptcha(b.captchaId, b.captcha)) fail('验证码错误')
  const e = email(b.email)
  const u = one<{ id: number; password_hash: string }>('SELECT id, password_hash FROM users WHERE email = ?', e)
  if (!u || typeof b.password !== 'string' || !verifyPassword(b.password, u.password_hash)) fail('邮箱或密码错误')
  startSession(c, 'user', u.id, b.remember !== false)
  return c.json({ user: e })
})

pub.post('/auth/logout', (c) => {
  endSession(c, 'user')
  return c.json({ ok: true })
})

pub.get('/me/orders', (c) => {
  const u = currentUser(c) ?? fail('请先登录', 401)
  const rows = all<OrderRow>('SELECT * FROM orders WHERE user_id = ? OR email = ? ORDER BY created_at DESC LIMIT 100', u.id, u.email)
  return c.json(rows.map((o) => toOrder(o, false)))
})

// ---- 订单 ----

pub.post('/orders', rateLimit('order', 30, 600), async (c) => {
  const b = await body(c)
  const e = email(b.email)
  const qp = password(b.queryPassword, 4, '查单密码')
  const channelId = num(b.channelId, '支付方式', 1, 1e9, true)
  if (!Array.isArray(b.lines)) fail('请选择商品')
  const lines = b.lines.map((l) => ({
    productId: num((l as Record<string, unknown>)?.productId, '商品', 1, 1e9, true),
    qty: num((l as Record<string, unknown>)?.qty, '购买数量', 1, 1000, true),
  }))
  const orderNo = createOrder({ email: e, queryPassword: qp, channelId, userId: currentUser(c)?.id ?? null, lines })
  return c.json(toOrder(findOrder(orderNo)!, false))
})

/**
 * 查看订单：需要订单令牌（下单后链接里自带），或是下单账号本人登录。
 * 仅凭订单号无法查看，防止遍历订单号窃取卡密。
 */
function canView(c: Parameters<typeof sessionOf>[0], o: OrderRow) {
  const t = c.req.query('t')
  if (t && verifyOrderToken(o.order_no, t)) return true
  const u = currentUser(c)
  return !!u && (o.user_id === u.id || o.email === u.email)
}

pub.get('/orders/:no', rateLimit('order-view', 120, 60), (c) => {
  const o = findOrder(c.req.param('no'))
  if (!o || !canView(c, o)) fail('订单不存在或无权查看', 404)
  return c.json(toOrder(o, true))
})

/** 发起支付，返回跳转地址 */
pub.post('/orders/:no/pay', rateLimit('pay', 30, 600), (c) => {
  const o = findOrder(c.req.param('no'))
  if (!o || !canView(c, o)) fail('订单不存在或无权查看', 404)
  if (o.status !== 'pending') fail(o.status === 'closed' ? '订单已超时关闭，请重新下单' : '订单已支付')
  if (o.expires_at < Date.now()) fail('订单已超时关闭，请重新下单')
  return c.json({ url: payUrl(o, publicUrl(c)) })
})

/** 游客查单：订单号或邮箱 + 查单密码 */
pub.post('/orders/lookup', rateLimit('lookup', 10, 300), async (c) => {
  const b = await body(c)
  const kw = str(b.keyword, '订单号或邮箱', 254).toLowerCase()
  if (typeof b.password !== 'string' || !b.password) fail('请填写查单密码')
  const pwd = b.password
  const rows = all<OrderRow>(
    'SELECT * FROM orders WHERE lower(order_no) = ? OR email = ? ORDER BY created_at DESC LIMIT 50', kw, kw)
  return c.json(rows.filter((o) => safeEqual(queryHash(o.order_no, pwd), o.query_hash)).map((o) => toOrder(o, false)))
})
