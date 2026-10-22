import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Product } from '../data/mock'
import { getProductsByIds, unitPriceFor } from '../api'
import { load, save } from './storage'

export interface CartItem {
  productId: number
  qty: number
}

// 购物车只在浏览器保存商品 id 与数量；价格、库存每次从服务端刷新，下单时由服务端重新计算
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>(load('cart', []))
  const products = ref<Record<number, Product>>({})
  watch(items, (v) => save('cart', v), { deep: true })

  /** 从服务端刷新商品信息，并移除已下架的商品 */
  async function refresh() {
    if (!items.value.length) return
    const list = await getProductsByIds(items.value.map((i) => i.productId))
    products.value = Object.fromEntries(list.map((p) => [p.id, p]))
    items.value = items.value.filter((i) => products.value[i.productId])
  }

  const detailed = computed(() =>
    items.value
      .map((i) => {
        // 售罄的商品不计入；库存减少后数量按库存截断
        const product = products.value[i.productId]
        if (!product || product.stock <= 0) return null
        const qty = Math.min(i.qty, product.stock)
        const unit = unitPriceFor(product, qty)
        return { ...i, qty, product, unit, subtotal: +(unit * qty).toFixed(2) }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  )
  const count = computed(() =>
    items.value.reduce((s, i) => {
      const p = products.value[i.productId]
      return s + (p ? Math.max(0, Math.min(i.qty, p.stock)) : i.qty)
    }, 0),
  )
  const total = computed(() => +detailed.value.reduce((s, i) => s + i.subtotal, 0).toFixed(2))

  function add(p: Product, qty = 1) {
    if (p.stock <= 0) return
    products.value[p.id] = p
    const existing = items.value.find((i) => i.productId === p.id)
    if (existing) existing.qty = Math.min(p.stock, existing.qty + qty)
    else items.value.push({ productId: p.id, qty: Math.min(p.stock, qty) })
  }

  function setQty(productId: number, qty: number) {
    const item = items.value.find((i) => i.productId === productId)
    const p = products.value[productId]
    if (item && p) item.qty = Math.max(1, Math.min(p.stock, Math.floor(qty) || 1))
  }

  function remove(productId: number) {
    items.value = items.value.filter((i) => i.productId !== productId)
  }

  function clear() {
    items.value = []
  }

  return { items, detailed, count, total, refresh, add, setQty, remove, clear }
})
