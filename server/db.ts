import { DatabaseSync, type StatementSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { DATA_DIR, config } from './config.ts'
import { hashPassword } from './crypto.ts'
import * as seed from '../src/data/mock.ts'
import type { Category, PaymentChannel, Post, Product, SiteConfig } from '../src/data/mock.ts'

export const db = new DatabaseSync(resolve(DATA_DIR, 'shop.db'))

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  glyph TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT '#0071e3', sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL, wholesale TEXT NOT NULL DEFAULT '[]',
  stock INTEGER NOT NULL DEFAULT 0, sold INTEGER NOT NULL DEFAULT 0,
  fulfillment TEXT NOT NULL CHECK (fulfillment IN ('auto', 'manual')),
  recommended INTEGER NOT NULL DEFAULT 0, cover TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0
);

-- 卡密库存：available 可售 / reserved 已被未支付订单锁定 / sold 已发出
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold')),
  order_no TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS cards_product ON cards(product_id, status);
CREATE INDEX IF NOT EXISTS cards_order ON cards(order_no);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('notice', 'blog')),
  title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', published_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('alipay', 'wechat', 'usdt')),
  fee_rate REAL NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL
);

-- 会话只保存令牌的 SHA-256 摘要
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('user', 'admin')),
  subject_id INTEGER NOT NULL, expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  order_no TEXT PRIMARY KEY, email TEXT NOT NULL, user_id INTEGER,
  query_hash TEXT NOT NULL, amount REAL NOT NULL, fee REAL NOT NULL,
  channel_id INTEGER, channel_name TEXT NOT NULL, channel_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'delivered', 'closed')),
  trade_no TEXT, created_at TEXT NOT NULL, paid_at TEXT, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status, expires_at);

CREATE TABLE IF NOT EXISTS order_lines (
  id INTEGER PRIMARY KEY,
  order_no TEXT NOT NULL REFERENCES orders(order_no) ON DELETE CASCADE,
  product_id INTEGER NOT NULL, title TEXT NOT NULL, qty INTEGER NOT NULL, unit REAL NOT NULL,
  fulfillment TEXT NOT NULL, cards TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS order_lines_order ON order_lines(order_no);
`)

type Param = null | number | bigint | string | Uint8Array
const cache = new Map<string, StatementSync>()
const stmt = (sql: string) => {
  let s = cache.get(sql)
  if (!s) cache.set(sql, (s = db.prepare(sql)))
  return s
}
export const one = <T>(sql: string, ...args: Param[]) => stmt(sql).get(...args) as T | undefined
export const all = <T>(sql: string, ...args: Param[]) => stmt(sql).all(...args) as T[]
export const run = (sql: string, ...args: Param[]) => stmt(sql).run(...args)

/** 写事务；回调内不要 await，保证整段同步执行 */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

// ---- 行映射 ----

/** 自动发货商品的库存 = 可售卡密数 */
export const PRODUCT_SQL = `SELECT p.*, CASE WHEN p.fulfillment = 'auto'
  THEN (SELECT COUNT(*) FROM cards c WHERE c.product_id = p.id AND c.status = 'available')
  ELSE p.stock END AS live_stock FROM products p`

export interface ProductRow {
  id: number; slug: string; category_id: number; title: string; description: string; content: string
  price: number; wholesale: string; stock: number; live_stock: number; sold: number
  fulfillment: Product['fulfillment']; recommended: number; cover: string; sort: number
}

export const toProduct = (r: ProductRow): Product => ({
  id: r.id, slug: r.slug, categoryId: r.category_id, title: r.title, description: r.description, content: r.content,
  price: r.price, wholesale: JSON.parse(r.wholesale), stock: r.live_stock, sold: r.sold,
  fulfillment: r.fulfillment, recommended: !!r.recommended, cover: JSON.parse(r.cover),
})

interface CategoryRow { id: number; slug: string; name: string; glyph: string; color: string }
export const toCategory = ({ id, slug, name, glyph, color }: CategoryRow): Category => ({ id, slug, name, glyph, color })

interface PostRow { id: number; slug: string; type: Post['type']; title: string; summary: string; content: string; published_at: string }
export const toPost = (r: PostRow): Post => ({
  id: r.id, slug: r.slug, type: r.type, title: r.title, summary: r.summary, content: r.content, publishedAt: r.published_at,
})

export interface ChannelRow { id: number; name: string; type: PaymentChannel['type']; fee_rate: number; enabled: number }
export const toChannel = (r: ChannelRow): PaymentChannel => ({ id: r.id, name: r.name, type: r.type, feeRate: r.fee_rate, enabled: !!r.enabled })

export const listCategories = () => all<CategoryRow>('SELECT * FROM categories ORDER BY sort, id').map(toCategory)
export const listChannels = () => all<ChannelRow>('SELECT * FROM channels ORDER BY sort, id').map(toChannel)
export const listPosts = () => all<PostRow>('SELECT * FROM posts ORDER BY published_at DESC, id DESC').map(toPost)
export const findPost = (slug: string) => {
  const r = one<PostRow>('SELECT * FROM posts WHERE slug = ?', slug)
  return r ? toPost(r) : null
}

export function getSite(): SiteConfig {
  const r = one<{ value: string }>("SELECT value FROM settings WHERE key = 'site'")
  return { ...seed.siteConfig, ...(r ? JSON.parse(r.value) : {}) }
}
export const setSite = (site: SiteConfig) =>
  run("INSERT INTO settings (key, value) VALUES ('site', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", JSON.stringify(site))

// ---- 初始化 ----

const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const randomCode = (n: number) => Array.from(randomBytes(n), (b) => CODE[b % CODE.length]).join('')

/** 首次启动写入演示目录；仅在模拟支付模式下生成演示卡密，避免正式环境误售 */
function seedCatalog() {
  if (one('SELECT 1 FROM categories LIMIT 1')) return
  const now = new Date().toISOString()
  tx(() => {
    setSite(seed.siteConfig)
    seed.categories.forEach((c, i) =>
      run('INSERT INTO categories (id, slug, name, glyph, color, sort) VALUES (?, ?, ?, ?, ?, ?)', c.id, c.slug, c.name, c.glyph, c.color, i))
    seed.products.forEach((p, i) => {
      run(
        `INSERT INTO products (id, slug, category_id, title, description, content, price, wholesale, stock, sold, fulfillment, recommended, cover, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.id, p.slug, p.categoryId, p.title, p.description, p.content, p.price, JSON.stringify(p.wholesale),
        p.fulfillment === 'manual' ? p.stock : 0, p.sold, p.fulfillment, p.recommended ? 1 : 0, JSON.stringify(p.cover), i,
      )
      if (p.fulfillment === 'auto' && config.pay.provider === 'mock')
        for (let k = 0; k < p.stock; k++)
          run('INSERT INTO cards (product_id, code, created_at) VALUES (?, ?, ?)', p.id, `DEMO-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`, now)
    })
    for (const p of seed.posts)
      run('INSERT INTO posts (id, slug, type, title, summary, content, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        p.id, p.slug, p.type, p.title, p.summary, p.content, p.publishedAt)
    seed.paymentChannels.forEach((c, i) =>
      run('INSERT INTO channels (id, name, type, fee_rate, enabled, sort) VALUES (?, ?, ?, ?, 1, ?)', c.id, c.name, c.type, c.feeRate, i))
  })
  console.log('[init] 已写入演示商品、分类、文章与支付渠道')
}

/** 没有管理员时创建 admin：密码取 ADMIN_PASSWORD，否则随机生成并只在控制台显示一次 */
function seedAdmin() {
  if (one('SELECT 1 FROM admins LIMIT 1')) return
  const password = process.env.ADMIN_PASSWORD || randomBytes(9).toString('base64url')
  run('INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)', 'admin', hashPassword(password), new Date().toISOString())
  console.log(`\n[init] 已创建管理员 admin${process.env.ADMIN_PASSWORD ? '（密码取自 ADMIN_PASSWORD）' : `，初始密码：${password}`}\n       请登录后台后立即修改密码\n`)
}

seedCatalog()
seedAdmin()
