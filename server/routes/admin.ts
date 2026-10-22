import { Hono } from 'hono'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { UPLOAD_DIR } from '../config.ts'
import { hashPassword, verifyPassword } from '../crypto.ts'
import {
  all, getSetting, getSite, listCategories, listChannels, listPosts, one, run, setSetting, setSite, toProduct, tx, PRODUCT_SQL, type ProductRow,
} from '../db.ts'
import { closeOrder, deleteOrder, deliverLine, findOrder, markPaid, toOrder, type OrderRow } from '../orders.ts'
import { cleanHtml } from '../sanitize.ts'
import { mergePay, payConfig, payLocks, publicUrl, requestOrigin, type PayConfig } from '../settings.ts'
import { checkSetupCode, clearSetupCode, createAdmin, needsSetup } from '../setup.ts'
import { endSession, rateLimit, requireAdmin, revokeSessions, sessionOf, startSession } from '../security.ts'
import { body, fail, hexColor, num, oneOf, password, round2, slug, str, url } from '../validate.ts'
import type { AdminProduct, AdminStats, AdminUser } from '../../src/types.ts'

export const admin = new Hono<{ Variables: { adminId: number } }>()

// ---- 登录（无需会话）----

admin.post('/login', rateLimit('admin-login', 10, 900), async (c) => {
  const b = await body(c)
  const name = str(b.username, '用户名', 64)
  const a = one<{ id: number; password_hash: string }>('SELECT id, password_hash FROM admins WHERE username = ?', name)
  if (!a || typeof b.password !== 'string' || !verifyPassword(b.password, a.password_hash)) fail('用户名或密码错误', 401)
  startSession(c, 'admin', a.id)
  return c.json({ username: name })
})

admin.get('/me', (c) => {
  const id = sessionOf(c, 'admin')
  const a = id ? one<{ username: string }>('SELECT username FROM admins WHERE id = ?', id) : undefined
  return c.json({ username: a?.username ?? null, needsSetup: needsSetup() })
})

// ---- 首次安装：凭服务器日志中的安装码创建管理员 ----

admin.post('/setup', rateLimit('setup', 10, 900), async (c) => {
  if (!needsSetup()) fail('已完成初始化，请直接登录', 409)
  const b = await body(c)
  if (!checkSetupCode(b.code)) fail('安装码错误，请查看服务器日志（docker compose logs）', 403)
  const name = str(b.username, '用户名', 32)
  if (!/^[\w.-]{3,32}$/.test(name)) fail('用户名为 3–32 位字母、数字、下划线、点或短横线')
  const pwd = password(b.password, 8)
  const id = tx(() => {
    if (!needsSetup()) fail('已完成初始化，请直接登录', 409)
    // 记录首次访问时的站点地址，作为支付回调地址的默认值
    if (!getSetting('publicUrl', '')) setSetting('publicUrl', requestOrigin(c))
    return createAdmin(name, pwd)
  })
  clearSetupCode()
  startSession(c, 'admin', id)
  console.log(`[setup] 已创建管理员 ${name}`)
  return c.json({ username: name })
})

admin.post('/logout', (c) => {
  endSession(c, 'admin')
  return c.json({ ok: true })
})

// 以下接口都需要管理员会话
admin.use('*', requireAdmin)

admin.post('/password', async (c) => {
  const b = await body(c)
  const id = c.get('adminId')
  const a = one<{ password_hash: string }>('SELECT password_hash FROM admins WHERE id = ?', id)!
  if (typeof b.oldPassword !== 'string' || !verifyPassword(b.oldPassword, a.password_hash)) fail('原密码错误')
  const pwd = password(b.newPassword, 8, '新密码')
  run('UPDATE admins SET password_hash = ? WHERE id = ?', hashPassword(pwd), id)
  // 让其它设备上的登录失效，当前设备重新签发会话
  revokeSessions('admin', id)
  startSession(c, 'admin', id)
  return c.json({ ok: true })
})

// ---- 仪表盘 ----

admin.get('/stats', (c) => {
  const paid = "status IN ('paid', 'delivered')"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const sum = (sql: string, ...args: string[]) => one<{ v: number | null }>(sql, ...args)?.v ?? 0
  const products = all<ProductRow>(`${PRODUCT_SQL} ORDER BY p.sort, p.id`).map(toProduct)

  const week: AdminStats['week'] = []
  for (let i = 6; i >= 0; i--) {
    const from = new Date(today)
    from.setDate(from.getDate() - i)
    const to = new Date(from)
    to.setDate(to.getDate() + 1)
    week.push({
      date: from.toISOString(),
      value: round2(sum(`SELECT SUM(amount) v FROM orders WHERE ${paid} AND paid_at >= ? AND paid_at < ?`, from.toISOString(), to.toISOString())),
    })
  }

  const stats: AdminStats = {
    revenue: round2(sum(`SELECT SUM(amount) v FROM orders WHERE ${paid}`)),
    todayRevenue: round2(sum(`SELECT SUM(amount) v FROM orders WHERE ${paid} AND paid_at >= ?`, today.toISOString())),
    orders: sum('SELECT COUNT(*) v FROM orders'),
    toShip: sum("SELECT COUNT(*) v FROM orders WHERE status = 'paid'"),
    products: products.length,
    users: sum('SELECT COUNT(*) v FROM users'),
    lowStock: products.filter((p) => p.stock <= 10).sort((a, b) => a.stock - b.stock).map(({ id, title, stock }) => ({ id, title, stock })),
    week,
    recent: all<OrderRow>('SELECT * FROM orders ORDER BY created_at DESC LIMIT 6').map((o) => toOrder(o, false)),
  }
  return c.json(stats)
})

// ---- 商品 ----

admin.get('/products', (c) => c.json(all<ProductRow>(`${PRODUCT_SQL} ORDER BY p.sort, p.id`).map(toProduct)))

function adminProduct(id: number): AdminProduct | null {
  const r = one<ProductRow>(`${PRODUCT_SQL} WHERE p.id = ?`, id)
  if (!r) return null
  const count = (status: string) => one<{ n: number }>('SELECT COUNT(*) n FROM cards WHERE product_id = ? AND status = ?', id, status)!.n
  return {
    ...toProduct(r),
    cards: all<{ code: string }>("SELECT code FROM cards WHERE product_id = ? AND status = 'available' ORDER BY id", id).map((x) => x.code),
    reserved: count('reserved'),
    soldCards: count('sold'),
  }
}

admin.get('/products/:id', (c) => c.json(adminProduct(Number(c.req.param('id'))) ?? fail('商品不存在', 404)))

/** 封面图只允许站内上传的地址或 https 外链 */
const coverImage = (v: unknown) => {
  const s = str(v, '封面图片', 500, false)
  if (s && !/^\/uploads\/[\w-]+\.(webp|jpg|png|gif)$/.test(s) && !/^https:\/\/\S+$/.test(s)) fail('封面图片地址无效')
  return s || undefined
}

function parseProduct(b: Record<string, unknown>) {
  const fulfillment = oneOf(b.fulfillment, ['auto', 'manual'] as const, '发货方式')
  const categoryId = num(b.categoryId, '分类', 1, 1e9, true)
  if (!one('SELECT 1 FROM categories WHERE id = ?', categoryId)) fail('分类不存在')
  if (!Array.isArray(b.wholesale) || b.wholesale.length > 20) fail('批发价格式错误')
  const wholesale = b.wholesale
    .map((w) => ({
      minQty: num((w as Record<string, unknown>)?.minQty, '起批数量', 2, 1000, true),
      unitPrice: round2(num((w as Record<string, unknown>)?.unitPrice, '批发单价', 0, 1e6)),
    }))
    .sort((x, y) => x.minQty - y.minQty)
  const cv = (b.cover ?? {}) as Record<string, unknown>
  const cover = {
    from: hexColor(cv.from, '渐变起点'), to: hexColor(cv.to, '渐变终点'),
    headline: str(cv.headline, '主标题', 40, false), sub: str(cv.sub, '副标题', 40, false),
    dark: cv.dark === true, image: coverImage(cv.image),
  }
  let cards: string[] = []
  if (fulfillment === 'auto') {
    if (!Array.isArray(b.cards) || b.cards.length > 20000) fail('卡密格式错误')
    cards = b.cards.map((x) => str(x, '卡密', 1000))
    if (new Set(cards).size !== cards.length) fail('卡密中有重复')
  }
  return {
    slug: slug(b.slug), categoryId, title: str(b.title, '商品标题', 120), description: str(b.description, '简介', 300, false),
    content: cleanHtml(str(b.content, '详情', 200_000, false)),
    price: round2(num(b.price, '售价', 0, 1e6)), wholesale,
    stock: fulfillment === 'manual' ? num(b.stock, '库存', 0, 1e7, true) : 0,
    sold: num(b.sold ?? 0, '销量', 0, 1e9, true), fulfillment, recommended: b.recommended === true, cover, cards,
  }
}

type ParsedProduct = ReturnType<typeof parseProduct>

/** 用提交的列表替换可售卡密；已锁定、已售出的卡密不受影响 */
function syncCards(productId: number, cards: string[]) {
  const locked = new Set(all<{ code: string }>("SELECT code FROM cards WHERE product_id = ? AND status != 'available'", productId).map((x) => x.code))
  const dup = cards.find((x) => locked.has(x))
  if (dup) fail(`卡密「${dup.slice(0, 30)}」已售出或被订单锁定，不能重复入库`)
  run("DELETE FROM cards WHERE product_id = ? AND status = 'available'", productId)
  const now = new Date().toISOString()
  for (const code of cards) run('INSERT INTO cards (product_id, code, created_at) VALUES (?, ?, ?)', productId, code, now)
}

function saveProduct(id: number | null, p: ParsedProduct) {
  return tx(() => {
    if (one('SELECT 1 FROM products WHERE slug = ? AND id IS NOT ?', p.slug, id)) fail('Slug 已被其它商品使用')
    const cols = [p.slug, p.categoryId, p.title, p.description, p.content, p.price, JSON.stringify(p.wholesale),
      p.stock, p.sold, p.fulfillment, p.recommended ? 1 : 0, JSON.stringify(p.cover)] as const
    if (id) {
      run(`UPDATE products SET slug = ?, category_id = ?, title = ?, description = ?, content = ?, price = ?, wholesale = ?,
           stock = ?, sold = ?, fulfillment = ?, recommended = ?, cover = ? WHERE id = ?`, ...cols, id)
    } else {
      const sort = one<{ n: number }>('SELECT COALESCE(MAX(sort), 0) + 1 n FROM products')!.n
      id = Number(run(`INSERT INTO products (slug, category_id, title, description, content, price, wholesale, stock, sold, fulfillment, recommended, cover, sort)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ...cols, sort).lastInsertRowid)
    }
    // 改为人工发货时，未售出的卡密一并清空
    syncCards(id, p.fulfillment === 'auto' ? p.cards : [])
    return id
  })
}

admin.post('/products', async (c) => {
  const id = saveProduct(null, parseProduct(await body(c)))
  return c.json(adminProduct(id))
})

admin.put('/products/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!one('SELECT 1 FROM products WHERE id = ?', id)) fail('商品不存在', 404)
  saveProduct(id, parseProduct(await body(c)))
  return c.json(adminProduct(id))
})

admin.patch('/products/:id/recommended', async (c) => {
  const b = await body(c)
  run('UPDATE products SET recommended = ? WHERE id = ?', b.recommended === true ? 1 : 0, Number(c.req.param('id')))
  return c.json({ ok: true })
})

admin.delete('/products/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (one("SELECT 1 FROM cards WHERE product_id = ? AND status = 'reserved' LIMIT 1", id)) fail('该商品有未支付的订单，请等订单关闭后再删除')
  // 订单行保存了标题与价格快照，删除商品不影响历史订单
  run('DELETE FROM products WHERE id = ?', id)
  return c.json({ ok: true })
})

// ---- 图片上传：校验文件头，重新命名保存，不信任客户端提供的类型和文件名 ----

const MAGIC: [string, (b: Buffer) => boolean][] = [
  ['webp', (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'],
  ['jpg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['png', (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ['gif', (b) => b.toString('ascii', 0, 4) === 'GIF8'],
]

admin.post('/upload', rateLimit('upload', 120, 600), async (c) => {
  const form = await c.req.parseBody()
  const file = form.file
  if (!(file instanceof File)) fail('请选择图片')
  if (file.size > 3 * 1024 * 1024) fail('图片不能超过 3MB')
  const buf = Buffer.from(await file.arrayBuffer())
  const ext = MAGIC.find(([, test]) => test(buf))?.[0]
  if (!ext) fail('仅支持 PNG / JPG / WebP / GIF')
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${ext}`
  writeFileSync(resolve(UPLOAD_DIR, name), buf)
  return c.json({ url: `/uploads/${name}` })
})

// ---- 分类 ----

admin.get('/categories', (c) => {
  const counts = new Map(all<{ category_id: number; n: number }>('SELECT category_id, COUNT(*) n FROM products GROUP BY category_id').map((r) => [r.category_id, r.n]))
  return c.json(listCategories().map((cat) => ({ ...cat, productCount: counts.get(cat.id) ?? 0 })))
})

async function saveCategory(c: Parameters<typeof body>[0], id: number | null) {
  const b = await body(c)
  const data = [slug(b.slug), str(b.name, '名称', 40), str(b.glyph, '图标字符', 2, false), hexColor(b.color, '颜色')] as const
  if (one('SELECT 1 FROM categories WHERE slug = ? AND id IS NOT ?', data[0], id)) fail('Slug 已存在')
  if (id) run('UPDATE categories SET slug = ?, name = ?, glyph = ?, color = ? WHERE id = ?', ...data, id)
  else run('INSERT INTO categories (slug, name, glyph, color, sort) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort), 0) + 1 FROM categories))', ...data)
  return c.json({ ok: true })
}

admin.post('/categories', (c) => saveCategory(c, null))
admin.put('/categories/:id', (c) => saveCategory(c, Number(c.req.param('id'))))

/** 按给定 id 顺序重排 */
admin.put('/categories-order', async (c) => {
  const b = await body(c)
  const ids = b.ids
  if (!Array.isArray(ids)) fail('参数错误')
  tx(() => ids.forEach((id: unknown, i: number) => run('UPDATE categories SET sort = ? WHERE id = ?', i, Number(id))))
  return c.json({ ok: true })
})

admin.delete('/categories/:id', (c) => {
  const id = Number(c.req.param('id'))
  if (one('SELECT 1 FROM products WHERE category_id = ? LIMIT 1', id)) fail('该分类下还有商品，无法删除')
  run('DELETE FROM categories WHERE id = ?', id)
  return c.json({ ok: true })
})

// ---- 文章 ----

admin.get('/posts', (c) => c.json(listPosts()))

async function savePost(c: Parameters<typeof body>[0], id: number | null) {
  const b = await body(c)
  const date = str(b.publishedAt, '发布日期', 30)
  if (Number.isNaN(Date.parse(date))) fail('发布日期无效')
  const data = [slug(b.slug), oneOf(b.type, ['notice', 'blog'] as const, '类型'), str(b.title, '标题', 120),
    str(b.summary, '摘要', 300, false), cleanHtml(str(b.content, '正文', 200_000, false)), new Date(date).toISOString()] as const
  if (one('SELECT 1 FROM posts WHERE slug = ? AND id IS NOT ?', data[0], id)) fail('Slug 已存在')
  if (id) run('UPDATE posts SET slug = ?, type = ?, title = ?, summary = ?, content = ?, published_at = ? WHERE id = ?', ...data, id)
  else run('INSERT INTO posts (slug, type, title, summary, content, published_at) VALUES (?, ?, ?, ?, ?, ?)', ...data)
  return c.json({ ok: true })
}

admin.post('/posts', (c) => savePost(c, null))
admin.put('/posts/:id', (c) => savePost(c, Number(c.req.param('id'))))
admin.delete('/posts/:id', (c) => {
  run('DELETE FROM posts WHERE id = ?', Number(c.req.param('id')))
  return c.json({ ok: true })
})

// ---- 支付渠道 ----

admin.get('/channels', (c) => c.json(listChannels()))

async function saveChannel(c: Parameters<typeof body>[0], id: number | null) {
  const b = await body(c)
  const data = [str(b.name, '渠道名称', 60), oneOf(b.type, ['alipay', 'wechat', 'usdt'] as const, '类型'),
    round2(num(b.feeRate, '手续费率', 0, 100)), b.enabled === false ? 0 : 1] as const
  if (id) run('UPDATE channels SET name = ?, type = ?, fee_rate = ?, enabled = ? WHERE id = ?', ...data, id)
  else run('INSERT INTO channels (name, type, fee_rate, enabled, sort) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort), 0) + 1 FROM channels))', ...data)
  return c.json({ ok: true })
}

admin.post('/channels', (c) => saveChannel(c, null))
admin.put('/channels/:id', (c) => saveChannel(c, Number(c.req.param('id'))))
admin.patch('/channels/:id/enabled', async (c) => {
  const b = await body(c)
  run('UPDATE channels SET enabled = ? WHERE id = ?', b.enabled === true ? 1 : 0, Number(c.req.param('id')))
  return c.json({ ok: true })
})
admin.delete('/channels/:id', (c) => {
  run('DELETE FROM channels WHERE id = ?', Number(c.req.param('id')))
  return c.json({ ok: true })
})

// ---- 订单 ----

admin.get('/orders', (c) => {
  const status = c.req.query('status')
  const kw = `%${(c.req.query('keyword') ?? '').trim().toLowerCase().slice(0, 100)}%`
  const rows = all<OrderRow>(
    `SELECT * FROM orders WHERE (? = '' OR status = ?) AND (lower(order_no) LIKE ? OR email LIKE ?)
     ORDER BY created_at DESC LIMIT 500`, status ?? '', status ?? '', kw, kw)
  const counts = Object.fromEntries(all<{ status: string; n: number }>('SELECT status, COUNT(*) n FROM orders GROUP BY status').map((r) => [r.status, r.n]))
  return c.json({ list: rows.map((o) => toOrder(o, false)), counts })
})

admin.get('/orders/:no', (c) => {
  const o = findOrder(c.req.param('no'))
  return o ? c.json(toOrder(o, true)) : fail('订单不存在', 404)
})

/** 线下已确认收款时手动标记支付 */
admin.post('/orders/:no/mark-paid', (c) => {
  const o = findOrder(c.req.param('no')) ?? fail('订单不存在', 404)
  const r = markPaid(o.order_no, `MANUAL-${c.get('adminId')}-${Date.now()}`, o.amount)
  if (r === 'already') fail('订单已支付')
  return c.json(toOrder(findOrder(o.order_no)!, true))
})

admin.post('/orders/:no/deliver', async (c) => {
  const b = await body(c)
  if (!Array.isArray(b.cards)) fail('请填写发货内容')
  const cards = b.cards.map((x) => str(x, '发货内容', 2000)).filter(Boolean)
  deliverLine(c.req.param('no'), num(b.lineId, '商品行', 1, 1e12, true), cards)
  return c.json(toOrder(findOrder(c.req.param('no'))!, true))
})

admin.post('/orders/:no/close', (c) => {
  closeOrder(c.req.param('no'))
  return c.json({ ok: true })
})

admin.delete('/orders/:no', (c) => {
  deleteOrder(c.req.param('no'))
  return c.json({ ok: true })
})

// ---- 用户 ----

admin.get('/users', (c) => {
  const rows = all<{ id: number; email: string; created_at: string; orders: number; spent: number | null }>(
    `SELECT u.id, u.email, u.created_at,
       (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id OR o.email = u.email) orders,
       (SELECT SUM(amount) FROM orders o WHERE (o.user_id = u.id OR o.email = u.email) AND o.status IN ('paid', 'delivered')) spent
     FROM users u ORDER BY u.id DESC`)
  return c.json(rows.map((r): AdminUser => ({ id: r.id, email: r.email, createdAt: r.created_at, orders: r.orders, spent: round2(r.spent ?? 0) })))
})

admin.delete('/users/:id', (c) => {
  const id = Number(c.req.param('id'))
  tx(() => {
    revokeSessions('user', id)
    run('UPDATE orders SET user_id = NULL WHERE user_id = ?', id)
    run('DELETE FROM users WHERE id = ?', id)
  })
  return c.json({ ok: true })
})

// ---- 支付网关设置 ----

/** 密钥只返回是否已设置，不回传明文 */
function paymentView(c: Parameters<typeof publicUrl>[0]) {
  const p = payConfig()
  return {
    provider: p.provider, epayUrl: p.epayUrl, epayPid: p.epayPid, hasKey: !!p.epayKey,
    publicUrl: publicUrl(c), notifyUrl: `${publicUrl(c)}/api/pay/epay/notify`, locks: payLocks(),
  }
}

admin.get('/payment', (c) => c.json(paymentView(c)))

admin.put('/payment', async (c) => {
  const b = await body(c)
  const saved = getSetting<Partial<PayConfig>>('payment', {})
  const next: Partial<PayConfig> = {
    provider: oneOf(b.provider, ['mock', 'epay'] as const, '支付模式'),
    epayUrl: url(b.epayUrl, '网关地址').replace(/\/+$/, ''),
    epayPid: str(b.epayPid, '商户号', 64, false),
    // 留空表示不修改已保存的密钥
    epayKey: typeof b.epayKey === 'string' && b.epayKey.trim() ? str(b.epayKey, '商户密钥', 256) : saved.epayKey ?? '',
  }
  const site = url(b.publicUrl, '站点地址').replace(/\/+$/, '')
  // 按合并环境变量后的最终结果校验
  const eff = mergePay(next)
  if (eff.provider === 'epay' && (!eff.epayUrl || !eff.epayPid || !eff.epayKey)) fail('启用易支付需要填写网关地址、商户号和商户密钥')
  setSetting('payment', next)
  if (!payLocks().publicUrl) setSetting('publicUrl', site)
  console.log(`[admin] 支付配置已更新：${eff.provider}`)
  return c.json(paymentView(c))
})

// ---- 站点设置 ----

admin.get('/site', (c) => c.json(getSite()))

admin.put('/site', async (c) => {
  const b = await body(c)
  const site = {
    siteName: str(b.siteName, '站点名称', 60), description: str(b.description, '站点描述', 200, false),
    telegram: url(b.telegram, 'Telegram 链接'), currency: oneOf(b.currency, ['CNY', 'USD'] as const, '货币'),
  }
  setSite(site)
  return c.json(site)
})
