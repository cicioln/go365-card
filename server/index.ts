import { Hono, type Context } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { HTTPException } from 'hono/http-exception'
import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
import { existsSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { config, MODE, ROOT, UPLOAD_DIR } from './config.ts'
import { prune as pruneCaptcha } from './captcha.ts'
import { closeExpired } from './orders.ts'
import { db, findPost, getSite, one } from './db.ts'
import { plainText, resolveMeta, type DetailMeta } from '../src/utils/seo.ts'
import { pruneBuckets, pruneSessions } from './security.ts'
import { epayReady, payConfig } from './settings.ts'
import { pollUsdt } from './usdt.ts'
import { initSetup } from './setup.ts'
import { pub } from './routes/public.ts'
import { pay } from './routes/pay.ts'
import { admin } from './routes/admin.ts'

const app = new Hono()

app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    // index.html 里有一段内联脚本用于提前应用深色主题
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    // 支付网关在后台可随时修改，跳转网关使用 location.href 而非表单提交，这里只允许本站表单
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
  },
  crossOriginEmbedderPolicy: false,
}))

// 防 CSRF：写操作必须来自本站页面。
// 支付相关接口除外：网关异步通知来自第三方服务器，模拟收银台的表单提交 Origin 为 null，二者分别由签名和订单令牌保护
const sameOrigin = (origin: string, host: string) => {
  try {
    return new URL(origin).host === host
  } catch {
    return false // 包括 Origin: null
  }
}
app.use('/api/*', async (c, next) => {
  const m = c.req.method
  if (m !== 'GET' && m !== 'HEAD' && !c.req.path.startsWith('/api/pay/')) {
    const origin = c.req.header('origin')
    const host = c.req.header('host')
    if (origin && host && !sameOrigin(origin, host)) throw new HTTPException(403, { message: '非法请求来源' })
  }
  await next()
})

app.use('/api/*', bodyLimit({ maxSize: 6 * 1024 * 1024, onError: (c) => c.json({ error: '请求内容过大' }, 413) }))
app.use('/api/*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
})

app.route('/api', pub)
app.route('/api/pay', pay)
app.route('/api/admin', admin)
app.all('/api/*', (c) => c.json({ error: '接口不存在' }, 404))

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: '服务器错误，请稍后再试' }, 500)
})

// 上传的图片
app.use('/uploads/*', serveStatic({
  root: relative(process.cwd(), UPLOAD_DIR),
  rewriteRequestPath: (p) => p.replace(/^\/uploads/, ''),
  onFound: (_p, c) => {
    c.header('Cache-Control', 'public, max-age=31536000, immutable')
    c.header('X-Content-Type-Options', 'nosniff')
  },
}))

// 前端静态文件（生产环境），其余路径回落到 index.html 由前端路由处理
const DIST = resolve(ROOT, 'dist')
if (existsSync(DIST)) {
  const indexHtml = readFileSync(resolve(DIST, 'index.html'), 'utf8')
  app.use('/assets/*', serveStatic({
    root: relative(process.cwd(), DIST),
    onFound: (_p, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable'),
  }))
  // 首屏就输出后台设置的标题、描述、关键词和标签图标：搜索引擎不执行 JS 也能拿到，且不会先闪默认图标
  const esc = (s: string) => s.replace(/[&"<>]/g, (ch) => `&#${ch.charCodeAt(0)};`)
  const LT_ESCAPE = String.fromCharCode(92) + 'u003c'
  const [head, rest] = indexHtml.split('</head>')
  const baseHead = head
    .replace(/\s*<title>[\s\S]*?<\/title>/, '')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<link rel="icon"[^>]*>/, '')
  /** 商品、文章详情页按 slug 查标题和描述 */
  const detailOf = (path: string): DetailMeta | null => {
    const m = /^\/(products|posts)\/([^/]+)\/?$/.exec(path)
    if (!m) return null
    const slug = decodeURIComponent(m[2])
    if (m[1] === 'products') {
      const p = one<{ title: string; description: string }>('SELECT title, description FROM products WHERE slug = ?', slug)
      return p ? { title: p.title, description: p.description } : null
    }
    const p = findPost(slug)
    return p && { title: p.title, description: p.summary || plainText(p.content) }
  }
  const renderIndex = (c: Context) => {
    const site = getSite()
    const path = c.req.path
    let detail: DetailMeta | null = null
    try {
      detail = detailOf(path)
    } catch {
      /* 非法的 URL 编码，按普通页面处理 */
    }
    const meta = resolveMeta(site, path, detail)
    const icon = site.favicon || site.logo || '/logo.svg'
    const tags = [
      `<title>${esc(meta.title)}</title>`,
      `<meta name="description" content="${esc(meta.description)}" />`,
      meta.keywords && `<meta name="keywords" content="${esc(meta.keywords)}" />`,
      meta.noindex && '<meta name="robots" content="noindex" />',
      `<meta property="og:site_name" content="${esc(site.siteName)}" />`,
      `<meta property="og:title" content="${esc(meta.title)}" />`,
      `<meta property="og:description" content="${esc(meta.description)}" />`,
      `<meta property="og:type" content="${detail ? 'article' : 'website'}" />`,
      `<link rel="icon" href="${esc(icon)}" />`,
      // 站点设置直接写进页面，前端启动时就有正确的名称和 Logo，不必等接口返回（避免闪一下默认名称）
      // JSON 里的 < 转义成 unicode 形式，防止站点名称中的 </script> 提前结束脚本
      `<script>window.__SITE__=${JSON.stringify(site).replace(/</g, LT_ESCAPE)}</script>`,
    ].filter(Boolean)
    return c.html(`${baseHead}\n    ${tags.join('\n    ')}\n  </head>${rest}`)
  }
  // index.html 不能交给静态中间件直接返回，否则拿不到后台设置的 SEO 信息
  app.get('/', renderIndex)
  app.get('/index.html', renderIndex)
  app.use('*', serveStatic({ root: relative(process.cwd(), DIST) }))
  app.get('*', renderIndex)
}

// 定时任务：关闭超时订单、清理过期会话与限流记录
setInterval(() => {
  try {
    const n = closeExpired()
    if (n) console.log(`[cron] 已关闭 ${n} 个超时未支付订单`)
    pruneSessions()
    pruneBuckets()
    pruneCaptcha()
  } catch (e) {
    console.error('[cron]', e)
  }
}, 60_000).unref()
closeExpired()

// 内置 USDT 收款：每 20 秒查询一次链上转账（没有待支付的 USDT 订单时不发请求）
setInterval(() => void pollUsdt().catch((e) => console.error('[usdt]', e)), Number(process.env.USDT_POLL_SECONDS || 20) * 1000).unref()

// docker stop 时发送 SIGTERM：关闭数据库后退出，避免写入中断
for (const sig of ['SIGTERM', 'SIGINT'] as const)
  process.on(sig, () => {
    console.log(`[server] 收到 ${sig}，正在退出`)
    try {
      db.close()
    } catch {
      /* 已关闭 */
    }
    process.exit(0)
  })

serve({ fetch: app.fetch, port: config.port }, () => {
  const pay = payConfig()
  console.log(`[server] http://localhost:${config.port}  运行模式：${MODE === 'dev' ? '开发（含演示数据）' : '生产'}  支付模式：${pay.provider === 'mock' ? '模拟支付（仅开发测试用）' : epayReady(pay) ? '易支付' : '易支付未配置（只能用内置 USDT 收款）'}${existsSync(DIST) ? '' : '（未找到 dist，只提供 API）'}`)
  initSetup()
})
