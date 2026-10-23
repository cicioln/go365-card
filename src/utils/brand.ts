// 按商品标题推断封面左上角的品牌小字与动态头像颜色
const BRANDS: { re: RegExp; name: string; color: string; short: string }[] = [
  { re: /gemini|google|谷歌/i, name: 'GOOGLE', color: '#4285f4', short: 'GEM' },
  { re: /claude|anthropic/i, name: 'ANTHROPIC', color: '#d97757', short: 'CLD' },
  { re: /grok|xai/i, name: 'xAI', color: '#222222', short: 'GRK' },
  { re: /codex/i, name: 'OPENAI', color: '#222222', short: 'CDX' },
  { re: /gpt|openai|chatgpt/i, name: 'OPENAI', color: '#10a37f', short: 'GPT' },
  { re: /outlook|gmail|mail|邮箱/i, name: 'MAIL', color: '#ea4335', short: 'MAL' },
]

export const brandOf = (title: string) => BRANDS.find((b) => b.re.test(title))?.name ?? ''

/** 动态列表头像：品牌缩写 + 颜色；未识别时取标题前 3 个字母 */
export function avatarOf(title: string) {
  const b = BRANDS.find((x) => x.re.test(title))
  if (b) return { text: b.short, color: b.color }
  return { text: (title.replace(/[^A-Za-z0-9]/g, '').slice(0, 3) || '★').toUpperCase(), color: '#15171c' }
}
