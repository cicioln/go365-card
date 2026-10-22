/** 复制文本；非 HTTPS 环境下 navigator.clipboard 不可用时退回 execCommand */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      /* 浏览器不支持 */
    }
    ta.remove()
    return ok
  }
}

/** 下载文本文件（带 BOM，Windows 记事本打开不乱码） */
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob(['﻿' + text.replace(/\r?\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
