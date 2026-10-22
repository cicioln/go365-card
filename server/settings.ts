import type { Context } from 'hono'
import { config, MODE } from './config.ts'
import { getSetting } from './db.ts'

// 业务配置：保存在数据库，后台可修改；设置了对应环境变量时以环境变量为准，后台只读

const env = process.env

export interface PayConfig {
  provider: 'mock' | 'epay'
  epayUrl: string
  epayPid: string
  epayKey: string
}

const ENV_PAY: Partial<Record<keyof PayConfig, string>> = {
  provider: env.PAY_PROVIDER || undefined,
  epayUrl: env.EPAY_URL || undefined,
  epayPid: env.EPAY_PID || undefined,
  epayKey: env.EPAY_KEY || undefined,
}

/** 哪些配置项被环境变量锁定 */
export const payLocks = () => ({
  provider: !!ENV_PAY.provider,
  epayUrl: !!ENV_PAY.epayUrl,
  epayPid: !!ENV_PAY.epayPid,
  epayKey: !!ENV_PAY.epayKey,
  publicUrl: !!env.PUBLIC_URL,
})

/** 模拟支付只在开发模式可用；生产模式一律走易支付，未配置时第三方渠道无法付款 */
export const MOCK_ALLOWED = MODE === 'dev'

/** 合并环境变量与数据库中的支付配置 */
export function mergePay(saved: Partial<PayConfig>): PayConfig {
  const pick = (k: keyof PayConfig) => ENV_PAY[k] ?? saved[k] ?? ''
  return {
    provider: pick('provider') === 'epay' || !MOCK_ALLOWED ? 'epay' : 'mock',
    epayUrl: pick('epayUrl').replace(/\/+$/, ''),
    epayPid: pick('epayPid'),
    epayKey: pick('epayKey'),
  }
}

/** 当前生效的支付配置（每次实时读取，后台修改后立即生效） */
export const payConfig = () => mergePay(getSetting<Partial<PayConfig>>('payment', {}))

/** 易支付参数是否填写完整 */
export const epayReady = (p: PayConfig) => !!(p.epayUrl && p.epayPid && p.epayKey)

/** 渠道当前能否收款：内置 USDT 始终可以；其余渠道需要模拟支付或已配置好的易支付 */
export function channelPayable(ch: { chain?: string }) {
  if (ch.chain) return true
  const p = payConfig()
  return p.provider === 'mock' || epayReady(p)
}

/** 浏览器访问本站使用的地址；在反向代理后时按 X-Forwarded-* 还原 */
export function requestOrigin(c: Context) {
  const u = new URL(c.req.url)
  if (config.trustProxy) {
    const proto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim()
    const host = c.req.header('x-forwarded-host')?.split(',')[0]?.trim()
    if (proto === 'http' || proto === 'https') u.protocol = `${proto}:`
    if (host) u.host = host
  }
  return u.origin
}

/**
 * 对外访问地址，用于生成支付回调和跳转地址。
 * 优先级：环境变量 PUBLIC_URL > 后台保存的地址（首次初始化时自动记录）> 当前请求地址
 */
export function publicUrl(c: Context) {
  return (env.PUBLIC_URL || getSetting<string>('publicUrl', '') || requestOrigin(c)).replace(/\/+$/, '')
}

/** Cookie 是否只走 HTTPS：COOKIE_SECURE=1/0 强制开关，不设置时按访问协议自动判断 */
export function cookieSecure(c: Context) {
  if (env.COOKIE_SECURE === '1') return true
  if (env.COOKIE_SECURE === '0') return false
  return requestOrigin(c).startsWith('https:')
}
