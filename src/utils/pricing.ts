import type { Product } from '../data/mock.ts'

/** 按数量匹配批发价（前后端共用，最终价格以服务端计算为准） */
export function unitPriceFor(p: Pick<Product, 'price' | 'wholesale'>, qty: number) {
  let price = p.price
  for (const w of p.wholesale) if (qty >= w.minQty) price = Math.min(price, w.unitPrice)
  return price
}
