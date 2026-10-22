// 调用后端接口：统一处理 JSON 与错误信息

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** 后台会话失效时的回调（由路由设置为跳转登录页） */
let onAdminUnauthorized: (() => void) | null = null
export const setAdminUnauthorizedHandler = (fn: () => void) => (onAdminUnauthorized = fn)

export async function http<T>(method: string, url: string, data?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} }
  if (data instanceof FormData) init.body = data
  else if (data !== undefined) {
    init.body = JSON.stringify(data)
    ;(init.headers as Record<string, string>)['Content-Type'] = 'application/json'
  }
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError('网络连接失败，请检查网络后重试', 0)
  }
  const body = await res.json().catch(() => null)
  if (res.status === 401 && url.startsWith('/api/admin/') && !url.endsWith('/login')) onAdminUnauthorized?.()
  if (!res.ok) throw new ApiError(body?.error ?? `请求失败（${res.status}）`, res.status)
  return body as T
}

export const get = <T>(url: string) => http<T>('GET', url)
export const post = <T>(url: string, data?: unknown) => http<T>('POST', url, data ?? {})
export const put = <T>(url: string, data: unknown) => http<T>('PUT', url, data)
export const patch = <T>(url: string, data: unknown) => http<T>('PATCH', url, data)
export const del = <T>(url: string) => http<T>('DELETE', url)

/** 把未知异常转成可展示的文字 */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : '操作失败')
