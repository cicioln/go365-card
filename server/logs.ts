import type { MiddlewareHandler } from 'hono'
import { db, run, tx } from './db.ts'
import { clientIp } from './security.ts'

// ---- 访问日志：记录页面访问与接口请求，后台可按 IP、路径查询 ----

db.exec(`CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL, ip TEXT NOT NULL, method TEXT NOT NULL, path TEXT NOT NULL,
  kind TEXT NOT NULL, status INTEGER NOT NULL, ms INTEGER NOT NULL,
  ua TEXT NOT NULL DEFAULT '', referer TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS access_logs_at ON access_logs(at);
CREATE INDEX IF NOT EXISTS access_logs_ip ON access_logs(ip, at)`)

/** 日志保留天数 */
const RETENTION_DAYS = Number(process.env.LOG_RETENTION_DAYS) || 30

type Entry = [at: number, ip: string, method: string, path: string, kind: string, status: number, ms: number, ua: string, referer: string]
let buffer: Entry[] = []

/** 每次请求都写库太频繁，先放内存，定时批量写入 */
export function flushLogs() {
  if (!buffer.length) return
  const rows = buffer
  buffer = []
  tx(() => {
    for (const r of rows)
      run('INSERT INTO access_logs (at, ip, method, path, kind, status, ms, ua, referer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', ...r)
  })
}

export const pruneLogs = () => run('DELETE FROM access_logs WHERE at < ?', Date.now() - RETENTION_DAYS * 86400_000)

const kindOf = (path: string) => (path.startsWith('/api/admin') ? 'admin' : path.startsWith('/api/') ? 'api' : 'page')
// 静态资源（脚本、图片、图标等）不记录
const skip = (path: string) => /^\/(assets|uploads)\//.test(path) || /\.\w{2,5}$/.test(path) || path.startsWith('/api/admin/logs')

export const accessLog: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  try {
    await next()
  } finally {
    const path = c.req.path
    if (!skip(path)) {
      // 路径和来源页都不存查询参数：订单链接里的访问令牌等不进日志
      buffer.push([start, clientIp(c), c.req.method, path.slice(0, 300), kindOf(path), c.res.status, Date.now() - start,
        (c.req.header('user-agent') ?? '').slice(0, 300), (c.req.header('referer') ?? '').split(/[?#]/)[0].slice(0, 300)])
      if (buffer.length >= 500) flushLogs()
    }
  }
}

setInterval(() => {
  try {
    flushLogs()
  } catch (e) {
    console.error('[logs]', e)
  }
}, 3000).unref()
