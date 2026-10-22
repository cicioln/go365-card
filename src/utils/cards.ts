/**
 * 卡密文本的拆分与展示。
 * - line：每行一条（普通卡密 / CDK）
 * - blank：用空行分隔，一条卡密可以有多行（账号 + 密码 + 辅助信息等）
 */
export type CardSplit = 'line' | 'blank'

export function splitCards(text: string, mode: CardSplit): string[] {
  const t = text.replace(/\r\n?/g, '\n')
  if (mode === 'line') return t.split('\n').map((s) => s.trim()).filter(Boolean)
  return t
    .split(/\n[ \t]*\n/)
    .map((block) => block.split('\n').map((s) => s.trim()).filter(Boolean).join('\n'))
    .filter(Boolean)
}

export const joinCards = (cards: string[], mode: CardSplit) => cards.join(mode === 'line' ? '\n' : '\n\n')

/** 已有卡密里只要有一条是多行的，就按空行分隔显示 */
export const guessSplit = (cards: string[]): CardSplit => (cards.some((c) => c.includes('\n')) ? 'blank' : 'line')

export interface CardField {
  key: string
  value: string
}

// 「字段名 : 值」，字段名不超过 30 个字符；排除 https://xxx 这类链接
const FIELD = /^([^:：\n]{1,30}?)\s*[:：]\s*(.+)$/

/** 尝试把卡密解析成字段列表；不是「字段名: 值」格式时返回 null，按原文显示 */
export function parseFields(card: string): CardField[] | null {
  const lines = card.split('\n').filter((s) => s.trim())
  if (lines.length < 2) return null
  const fields: CardField[] = []
  for (const line of lines) {
    const m = FIELD.exec(line.trim())
    if (!m || m[2].startsWith('//')) return null
    fields.push({ key: m[1].trim(), value: m[2].trim() })
  }
  return fields
}
