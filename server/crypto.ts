import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { config } from './config.ts'

/** scrypt 加盐哈希，格式 scrypt$salt$hash */
export function hashPassword(password: string) {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 32).toString('hex')}`
}

export function verifyPassword(password: string, stored: string) {
  const [alg, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  return safeEqual(scryptSync(password, Buffer.from(salt, 'hex'), 32).toString('hex'), hash)
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')
export const randomToken = () => randomBytes(32).toString('base64url')
const hmac = (data: string) => createHmac('sha256', config.secret).update(data).digest('base64url')

/** 订单访问令牌：无需存库，持有令牌即可查看该订单 */
export const orderToken = (orderNo: string) => hmac(`order:${orderNo}`).slice(0, 24)
export const verifyOrderToken = (orderNo: string, token: string) => safeEqual(orderToken(orderNo), token)

/** 游客查单密码摘要（带服务端密钥，泄库也无法离线撞库） */
export const queryHash = (orderNo: string, password: string) => hmac(`query:${orderNo}:${password}`)
