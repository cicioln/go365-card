import type { OrderStatus } from '../../types'

export const statusText: Record<OrderStatus, string> = { pending: '待支付', paid: '待发货', delivered: '已完成', closed: '已关闭' }

export const statusClass: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15',
  paid: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15',
  delivered: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15',
  closed: 'bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-400',
}

export { money } from '../../utils/money'
