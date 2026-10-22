// 前台接口
import type { Category, PaymentChannel, Post, Product, SiteConfig } from './data/mock'
import type { Order } from './types'
import { get, post } from './http'

export { unitPriceFor } from './utils/pricing'

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const getSite = () => get<SiteConfig>('/api/site')
export const getCategories = () => get<Category[]>('/api/categories')
export const getProducts = (params: { categoryId?: number; keyword?: string } = {}) =>
  get<Product[]>(`/api/products${qs({ categoryId: params.categoryId, keyword: params.keyword?.trim() })}`)
export const getProductsByIds = (ids: number[]) => get<Product[]>(`/api/products-by-ids?ids=${ids.join(',')}`)

export const getProduct = (slug: string) =>
  get<Product>(`/api/products/${encodeURIComponent(slug)}`).catch((e) => (e.status === 404 ? null : Promise.reject(e)))

export const getPosts = (type?: 'notice' | 'blog') => get<Post[]>(`/api/posts${qs({ type })}`)
export const getPost = (slug: string) =>
  get<Post>(`/api/posts/${encodeURIComponent(slug)}`).catch((e) => (e.status === 404 ? null : Promise.reject(e)))

export const getPaymentChannels = () => get<PaymentChannel[]>('/api/channels')

export const getCaptcha = () => get<{ id: string; svg: string }>('/api/captcha')

export const createOrder = (data: {
  email: string; queryPassword: string; channelId: number; lines: { productId: number; qty: number }[]
}) => post<Order>('/api/orders', data)

export const getOrder = (orderNo: string, token?: string) =>
  get<Order>(`/api/orders/${encodeURIComponent(orderNo)}${qs({ t: token })}`)

export const startPay = (orderNo: string, token?: string) =>
  post<{ url: string }>(`/api/orders/${encodeURIComponent(orderNo)}/pay${qs({ t: token })}`)

export const lookupOrders = (keyword: string, password: string) => post<Order[]>('/api/orders/lookup', { keyword, password })
export const getMyOrders = () => get<Order[]>('/api/me/orders')

/** 订单页链接（带访问令牌） */
export const orderLink = (o: Pick<Order, 'orderNo' | 'token'>) => `/orders/${o.orderNo}?t=${o.token}`
