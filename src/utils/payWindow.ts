/**
 * 新窗口打开支付页。
 * 必须在点击事件里同步调用 open()，否则浏览器会拦截弹窗；拿到支付地址后再 go(url)。
 * 弹窗被拦截时退回当前页跳转。
 */
export function openPayWindow() {
  const w = window.open('', '_blank')
  if (w) {
    w.opener = null
    w.document.title = '正在跳转支付…'
    w.document.body.innerHTML =
      '<p style="font:15px system-ui,sans-serif;color:#71717a;text-align:center;margin-top:40vh">正在跳转支付页面…</p>'
  }
  return {
    /** 打开成功返回 true；弹窗被拦截时在当前页跳转，返回 false */
    go(url: string) {
      if (w && !w.closed) {
        w.location.href = new URL(url, location.href).href
        return true
      }
      location.href = url
      return false
    },
    close() {
      if (w && !w.closed) w.close()
    },
  }
}
