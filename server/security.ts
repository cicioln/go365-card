import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { getConnInfo } from '@hono/node-server/conninfo'
import { config } from './config.ts'
import { randomToken, sha256 } from './crypto.ts'
import { cookieSecure } from './settings.ts'
import { one, run } from './db.ts'
import { fail } from './validate.ts'

// ---- 会话：HttpOnly Cookie 携带随机令牌，数据库只存摘要 ----

type Kind = 'user' | 'admin'
const COOKIE: Record<Kind, string> = { user: 'sid', admin: 'asid' }
const TTL: Record<Kind, number> = { user: 7 * 86400, admin: 12 * 3600 }

export function startSession(c: Context, kind: Kind, subjectId: number, remember = true) {
  const token = randomToken()
  const ttl = kind === 'user' && remember ? 30 * 86400 : TTL[kind]
  run('INSERT INTO sessions (token_hash, kind, subject_id, expires_at) VALUES (?, ?, ?, ?)', sha256(token), kind, subjectId, Date.now() + ttl * 1000)
  setCookie(c, COOKIE[kind], token, {
    httpOnly: true, sameSite: 'Lax', secure: cookieSecure(c), path: '/',
    // 不勾选"记住我"时使用浏览器会话 Cookie
    ...(kind === 'user' && !remember ? {} : { maxAge: ttl }),
  })
}

export function endSession(c: Context, kind: Kind) {
  const token = getCookie(c, COOKIE[kind])
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(token))
  deleteCookie(c, COOKIE[kind], { path: '/' })
}

/** 返回当前会话的主体 id，无效则为 null */
export function sessionOf(c: Context, kind: Kind) {
  const token = getCookie(c, COOKIE[kind])
  if (!token) return null
  const s = one<{ subject_id: number; expires_at: number }>(
    'SELECT subject_id, expires_at FROM sessions WHERE token_hash = ? AND kind = ?', sha256(token), kind)
  if (!s || s.expires_at < Date.now()) return null
  return s.subject_id
}

/** 删除某个主体的全部会话（改密码、删用户时使用） */
export const revokeSessions = (kind: Kind, subjectId: number) =>
  run('DELETE FROM sessions WHERE kind = ? AND subject_id = ?', kind, subjectId)

export const pruneSessions = () => run('DELETE FROM sessions WHERE expires_at < ?', Date.now())

export const requireAdmin: MiddlewareHandler<{ Variables: { adminId: number } }> = async (c, next) => {
  const id = sessionOf(c, 'admin')
  if (!id || !one('SELECT 1 FROM admins WHERE id = ?', id)) fail('请先登录后台', 401)
  c.set('adminId', id)
  await next()
}

// ---- 客户端 IP 与限流 ----

export function clientIp(c: Context) {
  if (config.trustProxy) {
    const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    if (fwd) return fwd
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

const buckets = new Map<string, { count: number; reset: number }>()

/** 固定窗口限流：windowSec 秒内最多 limit 次 */
export function rateLimit(name: string, limit: number, windowSec: number): MiddlewareHandler {
  return async (c, next) => {
    const key = `${name}:${clientIp(c)}`
    const now = Date.now()
    let b = buckets.get(key)
    if (!b || b.reset < now) buckets.set(key, (b = { count: 0, reset: now + windowSec * 1000 }))
    if (++b.count > limit) {
      c.header('Retry-After', String(Math.ceil((b.reset - now) / 1000)))
      fail('操作过于频繁，请稍后再试', 429)
    }
    await next()
  }
}

export function pruneBuckets() {
  const now = Date.now()
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k)
}
