import { Hono } from 'hono'
import { verifyOrderToken } from '../crypto.ts'
import { payConfig } from '../settings.ts'
import { findOrder, markPaid } from '../orders.ts'
import { mockCashier, verifyEpay } from '../pay.ts'
import { fail } from '../validate.ts'

export const pay = new Hono()

// ---- 模拟收银台（仅 PAY_PROVIDER=mock 时可用）----

function mockOrder(no: string, token: string | undefined) {
  if (payConfig().provider !== 'mock') fail('模拟支付未启用', 404)
  const o = findOrder(no)
  if (!o || !token || !verifyOrderToken(no, token)) fail('订单不存在', 404)
  return o
}

pay.get('/mock/:no', (c) => {
  const o = mockOrder(c.req.param('no'), c.req.query('t'))
  if (o.status !== 'pending') return c.redirect(`/orders/${o.order_no}?t=${c.req.query('t')}`)
  return c.html(mockCashier(o, c.req.query('t')!))
})

pay.post('/mock/:no', (c) => {
  const o = mockOrder(c.req.param('no'), c.req.query('t'))
  // 模拟网关按订单金额全额到账；超时关闭的订单不再接受模拟支付
  if (o.status === 'pending' && o.expires_at >= Date.now()) markPaid(o.order_no, `MOCK${Date.now()}`, o.amount)
  return c.redirect(`/orders/${o.order_no}?t=${c.req.query('t')}`, 303)
})

// ---- 易支付异步通知：签名、商户号、金额都校验通过才确认到账 ----

pay.on(['GET', 'POST'], '/epay/notify', async (c) => {
  const params: Record<string, string> = { ...c.req.query() }
  if (c.req.method === 'POST') {
    const form = await c.req.parseBody()
    for (const [k, v] of Object.entries(form)) if (typeof v === 'string') params[k] = v
  }
  if (!verifyEpay(params)) {
    console.warn('[epay] 签名校验失败', params.out_trade_no)
    return c.text('fail', 400)
  }
  if (params.trade_status !== 'TRADE_SUCCESS') return c.text('success')
  const result = markPaid(params.out_trade_no ?? '', params.trade_no ?? '', Number(params.money))
  if (result === 'amount_mismatch' || result === 'not_found') {
    console.warn(`[epay] 订单 ${params.out_trade_no} 回调异常：${result}`)
    return c.text('fail', 400)
  }
  return c.text('success')
})
