// 后台接口（需要管理员会话）
import type { Category, PaymentChannel, Post, Product, SiteConfig } from './data/mock'
import type { AdminProduct, AdminStats, AdminUser, Order, OrderStatus } from './types'
import { del, get, patch, post, put } from './http'

const A = '/api/admin'
const enc = encodeURIComponent

export type AdminCategory = Category & { productCount: number }
export type ProductInput = Omit<AdminProduct, 'id' | 'reserved' | 'soldCards'>

export interface PaymentSettings {
  provider: 'mock' | 'epay'
  epayUrl: string
  epayPid: string
  hasKey: boolean
  publicUrl: string
  notifyUrl: string
  /** 被环境变量锁定、后台只读的项 */
  locks: Record<'provider' | 'epayUrl' | 'epayPid' | 'epayKey' | 'publicUrl', boolean>
}
export type PaymentInput = Pick<PaymentSettings, 'provider' | 'epayUrl' | 'epayPid' | 'publicUrl'> & { epayKey: string }

export const adminApi = {
  me: () => get<{ username: string | null; needsSetup: boolean }>(`${A}/me`),
  setup: (code: string, username: string, password: string) => post<{ username: string }>(`${A}/setup`, { code, username, password }),
  payment: () => get<PaymentSettings>(`${A}/payment`),
  savePayment: (p: PaymentInput) => put<PaymentSettings>(`${A}/payment`, p),
  login: (username: string, password: string) => post<{ username: string }>(`${A}/login`, { username, password }),
  logout: () => post(`${A}/logout`),
  changePassword: (oldPassword: string, newPassword: string) => post(`${A}/password`, { oldPassword, newPassword }),

  stats: () => get<AdminStats>(`${A}/stats`),

  products: () => get<Product[]>(`${A}/products`),
  product: (id: number) => get<AdminProduct>(`${A}/products/${id}`),
  createProduct: (p: ProductInput) => post<AdminProduct>(`${A}/products`, p),
  updateProduct: (id: number, p: ProductInput) => put<AdminProduct>(`${A}/products/${id}`, p),
  setRecommended: (id: number, recommended: boolean) => patch(`${A}/products/${id}/recommended`, { recommended }),
  deleteProduct: (id: number) => del(`${A}/products/${id}`),
  upload: (file: Blob, name: string) => {
    const form = new FormData()
    form.append('file', file, name)
    return post<{ url: string }>(`${A}/upload`, form)
  },

  categories: () => get<AdminCategory[]>(`${A}/categories`),
  saveCategory: (c: Category) => (c.id ? put(`${A}/categories/${c.id}`, c) : post(`${A}/categories`, c)),
  reorderCategories: (ids: number[]) => put(`${A}/categories-order`, { ids }),
  deleteCategory: (id: number) => del(`${A}/categories/${id}`),

  posts: () => get<Post[]>(`${A}/posts`),
  savePost: (p: Post) => (p.id ? put(`${A}/posts/${p.id}`, p) : post(`${A}/posts`, p)),
  deletePost: (id: number) => del(`${A}/posts/${id}`),

  channels: () => get<PaymentChannel[]>(`${A}/channels`),
  saveChannel: (c: PaymentChannel) => (c.id ? put(`${A}/channels/${c.id}`, c) : post(`${A}/channels`, c)),
  setChannelEnabled: (id: number, enabled: boolean) => patch(`${A}/channels/${id}/enabled`, { enabled }),
  deleteChannel: (id: number) => del(`${A}/channels/${id}`),

  orders: (status: '' | OrderStatus, keyword: string) =>
    get<{ list: Order[]; counts: Partial<Record<OrderStatus, number>> }>(`${A}/orders?status=${status}&keyword=${enc(keyword)}`),
  order: (no: string) => get<Order>(`${A}/orders/${enc(no)}`),
  markPaid: (no: string) => post<Order>(`${A}/orders/${enc(no)}/mark-paid`),
  deliver: (no: string, lineId: number, cards: string[]) => post<Order>(`${A}/orders/${enc(no)}/deliver`, { lineId, cards }),
  closeOrder: (no: string) => post(`${A}/orders/${enc(no)}/close`),
  deleteOrder: (no: string) => del(`${A}/orders/${enc(no)}`),

  users: () => get<AdminUser[]>(`${A}/users`),
  deleteUser: (id: number) => del(`${A}/users/${id}`),

  site: () => get<SiteConfig>(`${A}/site`),
  saveSite: (s: SiteConfig) => put<SiteConfig>(`${A}/site`, s),
}
