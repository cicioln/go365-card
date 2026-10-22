import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export function fail(message: string, status: ContentfulStatusCode = 400): never {
  throw new HTTPException(status, { message })
}

/** 读取 JSON 请求体，必须是对象 */
export async function body(c: Context): Promise<Record<string, unknown>> {
  let data: unknown
  try {
    data = await c.req.json()
  } catch {
    fail('请求格式错误')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('请求格式错误')
  return data as Record<string, unknown>
}

export function str(v: unknown, name: string, max = 200, required = true) {
  if (v == null) v = ''
  if (typeof v !== 'string') fail(`${name}格式错误`)
  const s = v.trim()
  if (required && !s) fail(`请填写${name}`)
  if (s.length > max) fail(`${name}不能超过 ${max} 个字符`)
  return s
}

export function num(v: unknown, name: string, min = 0, max = 1e8, int = false) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) fail(`${name}无效`)
  return v
}

export function slug(v: unknown) {
  const s = str(v, 'Slug', 64)
  if (!/^[a-z0-9-]+$/i.test(s)) fail('Slug 只能包含字母、数字和短横线')
  return s
}

export function email(v: unknown) {
  const s = str(v, '邮箱', 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) fail('请输入有效邮箱')
  return s
}

/** 密码不做 trim */
export function password(v: unknown, min: number, name = '密码') {
  if (typeof v !== 'string' || v.length < min) fail(`${name}至少 ${min} 位`)
  if (v.length > 128) fail(`${name}过长`)
  return v
}

export function oneOf<T extends string>(v: unknown, list: readonly T[], name: string): T {
  if (!list.includes(v as T)) fail(`${name}无效`)
  return v as T
}

export function hexColor(v: unknown, name: string) {
  if (typeof v !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(v)) fail(`${name}无效`)
  return v
}

/** 可选的 http(s) 链接 */
export function url(v: unknown, name: string) {
  const s = str(v, name, 500, false)
  if (s && !/^https?:\/\/\S+$/i.test(s)) fail(`${name}需以 http:// 或 https:// 开头`)
  return s
}

export const round2 = (n: number) => Math.round(n * 100) / 100
