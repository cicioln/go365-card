// 前后端共用的接口类型
import type { Product } from './data/mock.ts'

export type OrderStatus = 'pending' | 'paid' | 'delivered' | 'closed'

export interface OrderLine {
  id: number
  productId: number
  title: string
  qty: number
  unit: number
  fulfillment: Product['fulfillment']
  /** 已发的卡密 / 发货内容；无权查看时为空 */
  cards: string[]
  delivered: boolean
}

export interface Order {
  orderNo: string
  email: string
  amount: number
  fee: number
  channel: string
  status: OrderStatus
  createdAt: string
  paidAt: string | null
  /** 未支付订单的关闭时间 */
  expiresAt: string
  lines: OrderLine[]
  /** 订单访问令牌，用于生成 /orders/:no?t= 链接 */
  token: string
}

/** 后台商品详情：附带卡密库存 */
export interface AdminProduct extends Product {
  /** 可售卡密 */
  cards: string[]
  /** 被未支付订单锁定的卡密数 */
  reserved: number
  /** 已售出的卡密数 */
  soldCards: number
}

export interface AdminStats {
  revenue: number
  todayRevenue: number
  orders: number
  toShip: number
  products: number
  users: number
  lowStock: { id: number; title: string; stock: number }[]
  week: { date: string; value: number }[]
  recent: Order[]
}

export interface AdminUser {
  id: number
  email: string
  createdAt: string
  orders: number
  spent: number
}
