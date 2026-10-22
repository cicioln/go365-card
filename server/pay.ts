import { config } from './config.ts'
import { md5, orderToken, safeEqual } from './crypto.ts'
import type { OrderRow } from './orders.ts'

/**
 * 支付网关。
 * - mock：本地模拟收银台，只用于开发测试，任何持有订单链接的人都能"支付"
 * - epay：易支付（彩虹易支付等兼容）协议，MD5 签名，异步通知确认到账
 */

const EPAY_TYPE: Record<string, string> = { alipay: 'alipay', wechat: 'wxpay', usdt: 'usdt' }

/** 易支付签名：参数按键名排序，去掉 sign / sign_type / 空值，拼接后加商户密钥取 MD5 */
export function epaySign(params: Record<string, string>) {
  const str = Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  return md5(str + config.pay.epayKey)
}

/** 生成跳转支付的地址 */
export function payUrl(o: OrderRow) {
  const token = orderToken(o.order_no)
  if (config.pay.provider === 'mock') return `/api/pay/mock/${o.order_no}?t=${token}`
  const params: Record<string, string> = {
    pid: config.pay.epayPid,
    type: EPAY_TYPE[o.channel_type] ?? 'alipay',
    out_trade_no: o.order_no,
    notify_url: `${config.publicUrl}/api/pay/epay/notify`,
    return_url: `${config.publicUrl}/orders/${o.order_no}?t=${token}`,
    name: `订单 ${o.order_no}`,
    money: o.amount.toFixed(2),
  }
  params.sign = epaySign(params)
  params.sign_type = 'MD5'
  return `${config.pay.epayUrl}/submit.php?${new URLSearchParams(params)}`
}

/** 校验易支付异步通知：商户号与签名都必须匹配 */
export function verifyEpay(params: Record<string, string>) {
  if (!config.pay.epayKey || params.pid !== config.pay.epayPid || !params.sign) return false
  return safeEqual(epaySign(params), params.sign.toLowerCase())
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** 模拟收银台页面 */
export function mockCashier(o: OrderRow, token: string) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>模拟收银台</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f5f7;font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif;color:#1d1d1f}
main{background:#fff;border-radius:16px;padding:32px;width:min(360px,calc(100vw - 32px));box-sizing:border-box;box-shadow:0 2px 12px rgb(0 0 0/6%)}
h1{font-size:20px;margin:0 0 4px}p{margin:6px 0;color:#71717a;font-size:14px}.amt{font-size:32px;font-weight:700;color:#e11d48;margin:20px 0}
button,a{display:block;width:100%;box-sizing:border-box;padding:12px;border-radius:12px;font-size:15px;font-weight:600;text-align:center;text-decoration:none;cursor:pointer}
button{border:0;background:#0071e3;color:#fff;margin-top:8px}a{color:#71717a;margin-top:8px}.warn{background:#fffbeb;color:#b45309;border-radius:10px;padding:10px;font-size:12px}
</style></head><body><main>
<h1>模拟收银台</h1><p>订单号 ${esc(o.order_no)}</p><p>支付方式 ${esc(o.channel_name)}</p>
<div class="amt">￥${o.amount.toFixed(2)}</div>
<p class="warn">当前为模拟支付模式（PAY_PROVIDER=mock），仅用于测试。正式上线前请配置真实支付网关。</p>
<form method="post" action="/api/pay/mock/${esc(o.order_no)}?t=${esc(token)}"><button type="submit">确认支付</button></form>
<a href="/orders/${esc(o.order_no)}?t=${esc(token)}">取消，返回订单</a>
</main></body></html>`
}
