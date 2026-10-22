import { useSiteStore } from '../stores/site'

const SYMBOLS: Record<string, string> = { CNY: '￥', USD: '$' }

/** 按站点设置的货币显示金额（只换符号，不做汇率换算） */
export const currencySymbol = () => SYMBOLS[useSiteStore().site.currency] ?? '￥'
export const money = (n: number) => `${currencySymbol()}${(Number(n) || 0).toFixed(2)}`
