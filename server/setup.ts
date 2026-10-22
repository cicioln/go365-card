import { randomBytes } from 'node:crypto'
import { hashPassword, safeEqual } from './crypto.ts'
import { one, run } from './db.ts'

// 首次安装：没有管理员时生成一次性安装码，只打印在服务器日志里。
// 打开 /admin 时需要输入安装码才能创建管理员，防止部署后被他人抢先设置。

const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
let setupCode: string | null = null

export const needsSetup = () => !one('SELECT 1 FROM admins LIMIT 1')

export function createAdmin(username: string, password: string) {
  const r = run('INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)', username, hashPassword(password), new Date().toISOString())
  return Number(r.lastInsertRowid)
}

export function initSetup() {
  if (!needsSetup()) return
  // 兼容：设置了 ADMIN_PASSWORD 时直接创建 admin，跳过安装向导
  const pwd = process.env.ADMIN_PASSWORD
  if (pwd) {
    createAdmin('admin', pwd)
    console.log('[init] 已按 ADMIN_PASSWORD 创建管理员 admin')
    return
  }
  // 32 个字符，取模无偏差
  setupCode = Array.from(randomBytes(12), (b) => CODE[b % CODE.length]).join('').replace(/(.{4})(?=.)/g, '$1-')
  console.log([
    '',
    '==================================================',
    '  首次使用：请在浏览器打开 /admin 设置管理员账号',
    `  安装码：${setupCode}`,
    '  （每次启动重新生成，设置完成后失效）',
    '==================================================',
    '',
  ].join('\n'))
}

export function checkSetupCode(code: unknown) {
  return !!setupCode && typeof code === 'string' && safeEqual(code.trim().toUpperCase(), setupCode)
}

export const clearSetupCode = () => {
  setupCode = null
}
