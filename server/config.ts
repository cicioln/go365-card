import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'

const env = process.env

/** 项目根目录（server/ 的上一级） */
export const ROOT = resolve(import.meta.dirname, '..')
export const DATA_DIR = resolve(ROOT, env.DATA_DIR ?? 'data')
export const UPLOAD_DIR = resolve(DATA_DIR, 'uploads')
mkdirSync(UPLOAD_DIR, { recursive: true })

/** 签名密钥：优先取环境变量，否则首次启动时生成并保存在 data/secret */
function loadSecret() {
  if (env.APP_SECRET) return env.APP_SECRET
  const file = resolve(DATA_DIR, 'secret')
  if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  const secret = randomBytes(32).toString('hex')
  writeFileSync(file, secret, { mode: 0o600 })
  return secret
}

const port = Number(env.PORT) || 3000

export const config = {
  port,
  /** 对外访问地址，用于生成支付回调 / 跳转地址 */
  publicUrl: (env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
  secret: loadSecret(),
  /** 生产环境走 HTTPS 时设为 1 */
  cookieSecure: env.COOKIE_SECURE === '1',
  /** 位于 Nginx 等反向代理之后时设为 1，按 X-Forwarded-For 识别客户端 IP */
  trustProxy: env.TRUST_PROXY === '1',
  /** 未支付订单的保留时间，超时自动关闭并释放库存 */
  orderTtlMinutes: Number(env.ORDER_TTL_MINUTES) || 15,
  pay: {
    /** mock：本地模拟收银台；epay：易支付协议 */
    provider: env.PAY_PROVIDER === 'epay' ? 'epay' : 'mock',
    epayUrl: (env.EPAY_URL ?? '').replace(/\/$/, ''),
    epayPid: env.EPAY_PID ?? '',
    epayKey: env.EPAY_KEY ?? '',
  },
} as const
