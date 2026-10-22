import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'

// 这里只放服务器级别的配置（端口、目录、代理等），从环境变量读取。
// 支付网关、站点地址等业务配置在后台设置，见 settings.ts。
const env = process.env

/** 项目根目录（server/ 的上一级） */
export const ROOT = resolve(import.meta.dirname, '..')
export const DATA_DIR = resolve(ROOT, env.DATA_DIR || 'data')
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

/**
 * 运行模式：dev 首次启动写入演示商品、分类、文章、支付渠道；production 数据库保持全空，全部在后台添加。
 * APP_MODE 优先；未设置时 `npm run dev:server`（带 --dev 参数）为 dev，其余（npm start、Docker）为 production。
 */
export const MODE: 'dev' | 'production' =
  env.APP_MODE === 'dev' || env.APP_MODE === 'production' ? env.APP_MODE : process.argv.includes('--dev') ? 'dev' : 'production'

export const config = {
  port: Number(env.PORT) || 3000,
  secret: loadSecret(),
  /** 位于 Nginx 等反向代理之后时设为 1，按 X-Forwarded-* 识别客户端 IP 与协议 */
  trustProxy: env.TRUST_PROXY === '1',
  /** 未支付订单的保留时间，超时自动关闭并释放库存 */
  orderTtlMinutes: Number(env.ORDER_TTL_MINUTES) || 15,
} as const
