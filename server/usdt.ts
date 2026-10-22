import { all, one } from './db.ts'
import { markPaid } from './orders.ts'
import { fail } from './validate.ts'

/**
 * 内置 USDT 收款：买家按唯一金额转账到后台配置的地址，服务端轮询链上转账记录，金额对上即确认到账。
 * 金额以 0.0001 USDT 为单位（pay_units）记录，同一地址上未支付订单的金额互不相同，用来区分是哪笔订单。
 */

export type Chain = 'bsc' | 'tron' | 'eth' | 'polygon'

interface ChainInfo {
  label: string
  /** USDT 合约 */
  token: string
  decimals: number
  rpc: string
  /** EVM：等待的确认块数；首次扫描回看的块数 */
  confirmations?: number
  lookback?: number
}

const env = process.env

export const CHAINS: Record<Chain, ChainInfo> = {
  bsc: {
    label: 'BSC (BEP20)', token: '0x55d398326f99059fF775485246999027B3197955', decimals: 18,
    rpc: env.USDT_RPC_BSC || 'https://bsc-rpc.publicnode.com', confirmations: 3, lookback: 3000,
  },
  eth: {
    label: 'Ethereum (ERC20)', token: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6,
    rpc: env.USDT_RPC_ETH || 'https://ethereum-rpc.publicnode.com', confirmations: 3, lookback: 200,
  },
  polygon: {
    label: 'Polygon', token: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6,
    rpc: env.USDT_RPC_POLYGON || 'https://polygon-bor-rpc.publicnode.com', confirmations: 10, lookback: 1500,
  },
  tron: {
    label: 'TRON (TRC20)', token: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6,
    rpc: env.USDT_RPC_TRON || 'https://api.trongrid.io',
  },
}

export const CHAIN_KEYS = Object.keys(CHAINS) as Chain[]

/** 校验收款地址格式 */
export function checkAddress(chain: Chain, address: string) {
  const ok = chain === 'tron' ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) : /^0x[0-9a-fA-F]{40}$/.test(address)
  if (!ok) fail(`${CHAINS[chain].label} 收款地址格式错误`)
  return address
}

/** 同一地址最多同时有 100 笔未支付订单（尾数 0.0000–0.0099） */
const SLOTS = 100

/**
 * 计算订单应付的 USDT 金额：按汇率换算并保留两位小数，再加上 0.0001 级别的尾数避开其它未支付订单。
 * 必须在创建订单的事务内调用。
 */
export function allocateUnits(chain: Chain, address: string, amount: number, rate: number) {
  // 先四舍五入到 6 位消除浮点误差，再向上取整到 0.01 USDT（= 100 个单位）
  const base = Math.ceil(Math.round((amount / rate) * 1e6) / 1e4) * 100
  if (base <= 0) fail('订单金额过小')
  const taken = new Set(all<{ pay_units: number }>(
    "SELECT pay_units FROM orders WHERE status = 'pending' AND pay_chain = ? AND pay_address = ? AND pay_units BETWEEN ? AND ?",
    chain, address, base, base + SLOTS - 1,
  ).map((r) => r.pay_units))
  for (let k = 0; k < SLOTS; k++) if (!taken.has(base + k)) return base + k
  fail('当前待支付订单过多，请稍后再试', 503)
}

export const unitsToUsdt = (units: number) => (units / 10_000).toFixed(4)

/** 订单到期后继续等待链上确认的时间：临近到期才转账的订单不会被误关 */
export const USDT_GRACE_MS = 10 * 60_000

// ---- 链上查询 ----

/** 链上转账；EVM 链只带块号，用到时再查块时间 */
interface Transfer { id: string; to: string; units: number; time?: number; block?: string }

const toUnits = (value: bigint, decimals: number) => Number(value / 10n ** BigInt(decimals - 4))

async function request(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`)
  return res.json() as Promise<any>
}

async function rpc(chain: Chain, method: string, params: unknown[]) {
  const r = await request(CHAINS[chain].rpc, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (r.error) throw new Error(`${chain} ${method}: ${r.error.message}`)
  return r.result
}

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const CHUNK = 2000
/** EVM 链下一个待扫描的块；没有待支付订单时清空，下次从最近的块重新开始 */
const cursors = new Map<Chain, number>()
const blockTimes = new Map<string, number>()

async function blockTime(chain: Chain, hex: string) {
  const key = `${chain}:${hex}`
  if (!blockTimes.has(key)) {
    if (blockTimes.size > 500) blockTimes.clear()
    blockTimes.set(key, Number((await rpc(chain, 'eth_getBlockByNumber', [hex, false])).timestamp) * 1000)
  }
  return blockTimes.get(key)!
}

async function evmTransfers(chain: Chain, addresses: string[]): Promise<Transfer[]> {
  const info = CHAINS[chain]
  const head = Number(await rpc(chain, 'eth_blockNumber', [])) - info.confirmations!
  let from = cursors.get(chain) ?? head - info.lookback!
  const out: Transfer[] = []
  const topics = addresses.map((a) => `0x${a.slice(2).toLowerCase().padStart(64, '0')}`)
  // 每轮最多扫 5 段，落后太多时分几轮追上
  for (let i = 0; i < 5 && from <= head; i++) {
    const to = Math.min(from + CHUNK - 1, head)
    const logs = await rpc(chain, 'eth_getLogs', [{
      fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}`, address: info.token, topics: [TRANSFER_TOPIC, null, topics],
    }])
    for (const l of logs as { topics: string[]; data: string; transactionHash: string; logIndex: string; blockNumber: string }[])
      out.push({
        id: `${l.transactionHash}:${Number(l.logIndex)}`,
        to: `0x${l.topics[2].slice(26)}`,
        units: toUnits(BigInt(l.data), info.decimals),
        block: l.blockNumber,
      })
    from = to + 1
    cursors.set(chain, from)
  }
  return out
}

async function tronTransfers(address: string, since: number): Promise<Transfer[]> {
  const info = CHAINS.tron
  const q = new URLSearchParams({
    only_to: 'true', only_confirmed: 'true', limit: '200', contract_address: info.token, min_timestamp: String(since),
  })
  const headers: Record<string, string> = env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': env.TRONGRID_API_KEY } : {}
  const r = await request(`${info.rpc}/v1/accounts/${address}/transactions/trc20?${q}`, { headers })
  return (r.data as { transaction_id: string; to: string; value: string; block_timestamp: number }[])
    .filter((t) => t.to === address)
    .map((t) => ({ id: t.transaction_id, to: t.to, units: toUnits(BigInt(t.value), info.decimals), time: t.block_timestamp }))
}

// ---- 对账 ----

interface PendingRow { order_no: string; pay_chain: Chain; pay_address: string; pay_units: number; created_at: string }

/** 把一笔转账匹配到未支付订单：地址、金额一致，且转账发生在下单之后；每笔转账只能用一次 */
async function settle(chain: Chain, orders: PendingRow[], t: Transfer) {
  const o = orders.find((x) => x.pay_address.toLowerCase() === t.to.toLowerCase() && x.pay_units === t.units)
  if (!o) return
  const time = t.block ? await blockTime(chain, t.block) : t.time ?? 0
  if (time < Date.parse(o.created_at)) return
  if (one('SELECT 1 FROM orders WHERE trade_no = ?', t.id)) return
  const total = one<{ amount: number }>('SELECT amount FROM orders WHERE order_no = ?', o.order_no)
  if (total && markPaid(o.order_no, t.id, total.amount) === 'ok')
    console.log(`[usdt] 订单 ${o.order_no} 已到账 ${unitsToUsdt(t.units)} USDT（${chain} ${t.id}）`)
}

let running = false

/** 定时调用：扫描所有有待支付 USDT 订单的链 */
export async function pollUsdt() {
  if (running) return
  running = true
  try {
    const pending = all<PendingRow>(
      "SELECT order_no, pay_chain, pay_address, pay_units, created_at FROM orders WHERE status = 'pending' AND pay_chain != ''",
    )
    for (const chain of CHAIN_KEYS) {
      const orders = pending.filter((o) => o.pay_chain === chain)
      if (!orders.length) {
        cursors.delete(chain)
        continue
      }
      try {
        const addresses = [...new Set(orders.map((o) => o.pay_address))]
        const transfers = chain === 'tron'
          ? (await Promise.all(addresses.map((a) =>
              tronTransfers(a, Math.min(...orders.filter((o) => o.pay_address === a).map((o) => Date.parse(o.created_at))))))).flat()
          : await evmTransfers(chain, addresses)
        for (const t of transfers) await settle(chain, orders, t)
      } catch (e) {
        console.warn(`[usdt] ${chain} 查询失败：${(e as Error).message}`)
      }
    }
  } finally {
    running = false
  }
}
