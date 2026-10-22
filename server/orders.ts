import { config } from './config.ts'
import { orderToken, queryHash } from './crypto.ts'
import { all, one, run, tx, PRODUCT_SQL, toProduct, randomCode, type ChannelRow, type ProductRow } from './db.ts'
import { allocateUnits, CHAINS, unitsToUsdt, USDT_GRACE_MS, type Chain } from './usdt.ts'
import { fail, round2 } from './validate.ts'
import { unitPriceFor } from '../src/utils/pricing.ts'
import type { Order, OrderLine, OrderStatus } from '../src/types.ts'

export interface OrderRow {
  order_no: string; email: string; user_id: number | null; query_hash: string
  amount: number; fee: number; channel_id: number | null; channel_name: string; channel_type: string
  status: OrderStatus; trade_no: string | null; created_at: string; paid_at: string | null; expires_at: number
  pay_chain: Chain | ''; pay_address: string; pay_units: number
}

interface LineRow {
  id: number; order_no: string; product_id: number; title: string; qty: number; unit: number
  fulfillment: 'auto' | 'manual'; cards: string
}

const MAX_LINES = 20
const MAX_QTY = 1000

export const findOrder = (orderNo: string) => one<OrderRow>('SELECT * FROM orders WHERE order_no = ?', orderNo)
const linesOf = (orderNo: string) => all<LineRow>('SELECT * FROM order_lines WHERE order_no = ? ORDER BY id', orderNo)
const lineCards = (l: LineRow): string[] => JSON.parse(l.cards)

/** 转为接口返回格式；withCards 为 false 时不返回卡密 */
export function toOrder(o: OrderRow, withCards: boolean): Order {
  return {
    orderNo: o.order_no, email: o.email, amount: o.amount, fee: o.fee, channel: o.channel_name, status: o.status,
    createdAt: o.created_at, paidAt: o.paid_at, expiresAt: new Date(o.expires_at).toISOString(),
    token: orderToken(o.order_no),
    tradeNo: o.trade_no,
    usdt: o.pay_chain
      ? { chain: o.pay_chain, network: CHAINS[o.pay_chain].label, address: o.pay_address, amount: unitsToUsdt(o.pay_units) }
      : null,
    lines: linesOf(o.order_no).map((l): OrderLine => {
      const cards = lineCards(l)
      return {
        id: l.id, productId: l.product_id, title: l.title, qty: l.qty, unit: l.unit, fulfillment: l.fulfillment,
        cards: withCards ? cards : [], delivered: cards.length >= l.qty,
      }
    }),
  }
}

/**
 * 创建订单：价格、手续费全部由服务端计算，并立即锁定库存。
 * 自动发货商品锁定具体卡密，人工发货商品扣减库存数；超时未支付由 closeExpired 释放。
 */
export function createOrder(input: {
  email: string; queryPassword: string; channelId: number; userId: number | null
  lines: { productId: number; qty: number }[]
}) {
  // 合并同一商品
  const merged = new Map<number, number>()
  for (const l of input.lines) merged.set(l.productId, (merged.get(l.productId) ?? 0) + l.qty)
  if (!merged.size) fail('请选择商品')
  if (merged.size > MAX_LINES) fail(`一次最多购买 ${MAX_LINES} 种商品`)

  return tx(() => {
    const ch = one<ChannelRow>('SELECT * FROM channels WHERE id = ? AND enabled = 1', input.channelId)
    if (!ch) fail('支付方式不可用，请刷新后重试')

    const now = new Date()
    const orderNo = `DJ${now.toISOString().replace(/\D/g, '').slice(0, 14)}${randomCode(6)}`
    const lines: { productId: number; title: string; qty: number; unit: number; fulfillment: 'auto' | 'manual' }[] = []

    for (const [productId, qty] of merged) {
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) fail('购买数量无效')
      const row = one<ProductRow>(`${PRODUCT_SQL} WHERE p.id = ?`, productId)
      if (!row) fail('商品不存在或已下架，请刷新购物车')
      const p = toProduct(row)
      if (p.stock < qty) fail(`「${p.title}」库存不足（剩余 ${p.stock}）`)

      const reserved = p.fulfillment === 'auto'
        ? run(
            `UPDATE cards SET status = 'reserved', order_no = ? WHERE id IN (
               SELECT id FROM cards WHERE product_id = ? AND status = 'available' ORDER BY id LIMIT ?)`,
            orderNo, p.id, qty,
          ).changes
        : run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', qty, p.id, qty).changes ? qty : 0
      if (Number(reserved) !== qty) fail(`「${p.title}」库存不足，请刷新后重试`)

      lines.push({ productId: p.id, title: p.title, qty, unit: unitPriceFor(p, qty), fulfillment: p.fulfillment })
    }

    const subtotal = round2(lines.reduce((s, l) => s + l.unit * l.qty, 0))
    const fee = round2((subtotal * ch.fee_rate) / 100)
    const amount = round2(subtotal + fee)
    if (amount < 0.01) fail('订单金额必须大于 0')

    // 内置 USDT 收款：渠道配置了链和地址时，分配本单唯一的转账金额
    const chain = ch.type === 'usdt' && ch.chain && ch.address ? (ch.chain as Chain) : ''
    const units = chain ? allocateUnits(chain, ch.address, amount, ch.rate) : 0

    run(
      `INSERT INTO orders (order_no, email, user_id, query_hash, amount, fee, channel_id, channel_name, channel_type, status, created_at, expires_at,
         pay_chain, pay_address, pay_units)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      orderNo, input.email, input.userId, queryHash(orderNo, input.queryPassword), amount, fee,
      ch.id, ch.name, ch.type, now.toISOString(), now.getTime() + config.orderTtlMinutes * 60_000,
      chain, chain ? ch.address : '', units,
    )
    for (const l of lines)
      run('INSERT INTO order_lines (order_no, product_id, title, qty, unit, fulfillment) VALUES (?, ?, ?, ?, ?, ?)',
        orderNo, l.productId, l.title, l.qty, l.unit, l.fulfillment)
    return orderNo
  })
}

/** 释放未支付订单锁定的库存 */
function release(orderNo: string) {
  run("UPDATE cards SET status = 'available', order_no = NULL WHERE order_no = ? AND status = 'reserved'", orderNo)
  for (const l of linesOf(orderNo))
    if (l.fulfillment === 'manual') run('UPDATE products SET stock = stock + ? WHERE id = ?', l.qty, l.product_id)
}

/** 关闭超时未支付的订单；USDT 订单多等一段时间，留给链上确认 */
export function closeExpired() {
  const now = Date.now()
  const due = all<{ order_no: string }>(
    "SELECT order_no FROM orders WHERE status = 'pending' AND expires_at < (CASE WHEN pay_chain = '' THEN ? ELSE ? END)", now, now - USDT_GRACE_MS)
  for (const { order_no } of due)
    tx(() => {
      // 事务内再确认一次，避免与支付回调并发
      if (findOrder(order_no)?.status !== 'pending') return
      release(order_no)
      run("UPDATE orders SET status = 'closed' WHERE order_no = ?", order_no)
    })
  return due.length
}

/** 后台手动关闭未支付订单 */
export function closeOrder(orderNo: string) {
  tx(() => {
    const o = findOrder(orderNo)
    if (!o) fail('订单不存在', 404)
    if (o.status !== 'pending') fail('只能关闭未支付的订单')
    release(orderNo)
    run("UPDATE orders SET status = 'closed' WHERE order_no = ?", orderNo)
  })
}

/** 只能删除未支付 / 已关闭的订单，已支付订单作为账务记录保留 */
export function deleteOrder(orderNo: string) {
  tx(() => {
    const o = findOrder(orderNo)
    if (!o) fail('订单不存在', 404)
    if (o.status === 'paid' || o.status === 'delivered') fail('已支付的订单不能删除')
    if (o.status === 'pending') release(orderNo)
    run('DELETE FROM orders WHERE order_no = ?', orderNo)
  })
}

export type PayResult = 'ok' | 'already' | 'not_found' | 'amount_mismatch'

/**
 * 确认支付（只能由支付回调或管理员调用）：校验金额，发出锁定的卡密。
 * 订单已超时关闭后才到账时，尝试重新锁定库存；库存不足的商品行留给管理员人工处理。
 */
export function markPaid(orderNo: string, tradeNo: string, paidAmount: number): PayResult {
  return tx(() => {
    const o = findOrder(orderNo)
    if (!o) return 'not_found'
    if (o.status === 'paid' || o.status === 'delivered') return 'already'
    if (Math.abs(paidAmount - o.amount) > 0.001) return 'amount_mismatch'
    const late = o.status === 'closed'

    for (const l of linesOf(orderNo)) {
      if (l.fulfillment === 'auto') {
        let picked = all<{ id: number; code: string }>(
          "SELECT id, code FROM cards WHERE order_no = ? AND product_id = ? AND status = 'reserved' ORDER BY id", orderNo, l.product_id)
        if (late && picked.length < l.qty)
          picked = all("SELECT id, code FROM cards WHERE product_id = ? AND status = 'available' ORDER BY id LIMIT ?", l.product_id, l.qty)
        if (picked.length === l.qty) {
          for (const c of picked) run("UPDATE cards SET status = 'sold', order_no = ? WHERE id = ?", orderNo, c.id)
          run('UPDATE order_lines SET cards = ? WHERE id = ?', JSON.stringify(picked.map((c) => c.code)), l.id)
        }
      } else if (late) {
        run('UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?', l.qty, l.product_id)
      }
      run('UPDATE products SET sold = sold + ? WHERE id = ?', l.qty, l.product_id)
    }

    const done = linesOf(orderNo).every((l) => lineCards(l).length >= l.qty)
    run('UPDATE orders SET status = ?, trade_no = ?, paid_at = ? WHERE order_no = ?',
      done ? 'delivered' : 'paid', tradeNo, new Date().toISOString(), orderNo)
    return 'ok'
  })
}

/** 后台人工发货：为某个商品行填写发货内容，条数必须等于购买数量 */
export function deliverLine(orderNo: string, lineId: number, cards: string[]) {
  tx(() => {
    const o = findOrder(orderNo)
    if (!o) fail('订单不存在', 404)
    if (o.status !== 'paid') fail(o.status === 'delivered' ? '订单已发货' : '订单未支付')
    const l = linesOf(orderNo).find((x) => x.id === lineId)
    if (!l) fail('商品行不存在')
    if (lineCards(l).length >= l.qty) fail('该商品已发货')
    if (cards.length !== l.qty) fail(`需要 ${l.qty} 条发货内容，当前 ${cards.length} 条`)
    run('UPDATE order_lines SET cards = ? WHERE id = ?', JSON.stringify(cards), l.id)
    if (linesOf(orderNo).every((x) => lineCards(x).length >= x.qty))
      run("UPDATE orders SET status = 'delivered' WHERE order_no = ?", orderNo)
  })
}
