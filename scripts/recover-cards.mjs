// 从 SQLite 数据库文件里找回被删除（被覆盖保存）的可售卡密。
// SQLite 删除数据时只把空间标记为空闲，在被新数据覆盖之前，原内容仍留在 shop.db 和 shop.db-wal 里。
//
// 用法（先停止服务、备份 data 目录，在备份的副本上运行）：
//   node scripts/recover-cards.mjs <包含 shop.db 的目录> [输出文件]
// 输出：每条卡密之间空一行，可在后台「可售卡密 → 空行分隔」模式下直接导入；当前库里已有的卡密会被排除。
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const dir = process.argv[2]
const out = process.argv[3] || 'recovered-cards.txt'
if (!dir || !existsSync(join(dir, 'shop.db'))) {
  console.error('用法：node scripts/recover-cards.mjs <包含 shop.db 的目录> [输出文件]')
  process.exit(1)
}

// 先把原始字节读进内存，再打开数据库（打开 / 关闭数据库可能触发 WAL 合并，覆盖掉残留数据）
const files = ['shop.db', 'shop.db-wal'].filter((f) => existsSync(join(dir, f))).map((f) => ({ name: f, buf: readFileSync(join(dir, f)) }))

/*
 * cards 表一行的存储格式：
 *   记录头 [头长度][product_id 类型][code 类型][status 类型 = 0x1f]["order_no" NULL = 0x00][created_at 类型 = 0x3d]
 *   记录体 [product_id][code 文本][available][2026-01-01T00:00:00.000Z]
 * 可售卡密的 status 是 'available'、order_no 为空，所以每条卡密后面紧跟 "available" + 24 位时间。
 * 由 code 的类型值算出文本长度，就能准确截出整条卡密（包括多行卡密）。
 */
const MARK = Buffer.from('available')
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/
const exact = new Map()
const rough = new Set()

for (const { buf } of files) {
  for (let p = buf.indexOf(MARK); p !== -1; p = buf.indexOf(MARK, p + 1)) {
    if (!ISO.test(buf.toString('latin1', p + 9, p + 33))) continue
    let code = null
    // 往前找记录头尾部的 1f 00 3d，并用其前面的 code 类型值校验长度
    for (let h = p - 4; h >= Math.max(0, p - 6000) && code === null; h--) {
      if (buf[h] !== 0x1f || buf[h + 1] !== 0x00 || buf[h + 2] !== 0x3d) continue
      const serials = []
      if (h >= 1 && buf[h - 1] < 0x80) serials.push(buf[h - 1])
      if (h >= 2 && buf[h - 2] >= 0x80 && buf[h - 1] < 0x80) serials.push(((buf[h - 2] & 0x7f) << 7) | buf[h - 1])
      for (const s of serials) {
        if (s < 13 || s % 2 === 0) continue
        const len = (s - 13) / 2
        const start = p - len
        // 记录头之后是 product_id（0~8 字节），然后才是卡密文本
        if (start >= h + 3 && start <= h + 3 + 8) {
          code = buf.toString('utf8', start, p)
          break
        }
      }
    }
    if (code !== null) {
      const c = code.replace(/\r\n?/g, '\n').trim()
      if (c) exact.set(c, true)
      continue
    }
    // 记录头被破坏时，退而取 "available" 前面一段连续的可打印文本，需要人工核对
    let s = p
    while (s > 0 && p - s < 5000 && (buf[s - 1] >= 0x20 || buf[s - 1] === 0x0a || buf[s - 1] === 0x09 || buf[s - 1] >= 0x80)) s--
    const c = buf.toString('utf8', s, p).replace(/\ufffd/g, '').trim()
    if (c.length >= 4) rough.add(c)
  }
}

// 排除当前库里仍存在的卡密（含锁定、已售出）和订单里已发出的内容
const db = new DatabaseSync(join(dir, 'shop.db'), { readOnly: true })
const known = new Set()
for (const r of db.prepare('SELECT code FROM cards').all()) known.add(String(r.code).trim())
for (const r of db.prepare('SELECT cards FROM order_lines').all())
  for (const c of JSON.parse(String(r.cards) || '[]')) known.add(String(c).trim())
db.close()

const list = [...exact.keys()].filter((c) => !known.has(c))
const roughList = [...rough].filter((c) => !known.has(c) && !list.some((x) => c.endsWith(x)))

let text = list.join('\n\n') + '\n'
if (roughList.length)
  text += `\n\n\n########## 以下 ${roughList.length} 段无法确定边界，开头可能多出几个乱码字符，请人工核对 ##########\n\n` + roughList.join('\n\n') + '\n'
writeFileSync(out, text)

console.log(`找回 ${list.length} 条卡密${roughList.length ? `，另有 ${roughList.length} 段需要人工核对` : ''}，已写入 ${out}`)
if (!list.length && !roughList.length) console.log('没有找到残留数据：可能已被新写入的数据覆盖。')
