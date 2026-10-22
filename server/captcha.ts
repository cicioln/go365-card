import { randomBytes, randomInt } from 'node:crypto'

// 服务端图形验证码：答案只存在服务端内存，一次性使用，5 分钟过期
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXY3456789'
const TTL = 5 * 60 * 1000
const store = new Map<string, { code: string; exp: number }>()

export function createCaptcha() {
  if (store.size > 10000) prune()
  const code = Array.from({ length: 4 }, () => CHARS[randomInt(CHARS.length)]).join('')
  const id = randomBytes(16).toString('base64url')
  store.set(id, { code, exp: Date.now() + TTL })
  return { id, svg: render(code) }
}

/** 校验后立即作废，无论对错 */
export function checkCaptcha(id: unknown, answer: unknown) {
  if (typeof id !== 'string' || typeof answer !== 'string') return false
  const item = store.get(id)
  store.delete(id)
  return !!item && item.exp > Date.now() && item.code === answer.trim().toUpperCase()
}

export function prune() {
  const now = Date.now()
  for (const [k, v] of store) if (v.exp < now) store.delete(k)
}

const hue = () => randomInt(360)

function render(code: string) {
  const w = 110
  const h = 42
  const lines = Array.from({ length: 5 }, () =>
    `<line x1="${randomInt(w)}" y1="${randomInt(h)}" x2="${randomInt(w)}" y2="${randomInt(h)}" stroke="hsl(${hue()} 60% 60%)" stroke-width="1.5"/>`)
  const dots = Array.from({ length: 20 }, () => `<circle cx="${randomInt(w)}" cy="${randomInt(h)}" r="1" fill="hsl(${hue()} 50% 50%)"/>`)
  const chars = code.split('').map((ch, i) => {
    const x = 14 + i * 24
    const rot = randomInt(-16, 17)
    return `<text x="${x}" y="29" transform="rotate(${rot} ${x} 21)" fill="hsl(${hue()} 55% 35%)" font-family="monospace" font-size="24" font-weight="bold">${ch}</text>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#eef2f7"/>${lines.join('')}${dots.join('')}${chars.join('')}</svg>`
}
