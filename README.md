# Go365 Card

卡密自动发货商城：Vue 3 前端 + Node.js（Hono + SQLite）后端。

## 运行

需要 Node.js 22.6 及以上（使用内置的 `node:sqlite` 和 TypeScript 类型擦除，无需编译后端）。

```bash
npm install

# 开发：两个终端分别运行
npm run dev:server   # 后端 http://localhost:3000
npm run dev          # 前端 http://localhost:5173，/api 自动转发到后端

# 生产
npm run build
cp .env.example .env  # 修改配置
npm run start:env     # 同一个端口提供页面和接口
```

首次启动会写入演示商品，并创建管理员 `admin`。密码取 `ADMIN_PASSWORD`，未设置时随机生成并打印在控制台，登录后请在「系统设置」修改。

## 上线前必做

1. `PAY_PROVIDER=epay` 并填写 `EPAY_URL / EPAY_PID / EPAY_KEY`。mock 模式下任何拿到订单链接的人都能"支付"。
2. 在后台把每个自动发货商品的演示卡密（`DEMO-` 开头）换成真实卡密。epay 模式首次启动不会生成演示卡密。
3. 配置 HTTPS，并设置 `COOKIE_SECURE=1`；在反向代理后设置 `TRUST_PROXY=1`。
4. 定期备份 `data/` 目录（数据库、上传图片、签名密钥）。丢失 `data/secret` 会导致已发出的订单链接和游客查单密码失效。

## 安全设计

- 价格、手续费、库存全部由服务端计算和校验，客户端传入的金额会被忽略。
- 下单即锁定库存（自动发货锁定具体卡密），超时未支付自动关闭并释放。
- 只有支付网关的签名回调（核对商户号、签名、金额）或管理员手动操作能把订单标记为已支付，重复回调不会重复发货。
- 查看订单需要下单时生成的访问令牌，或用下单账号登录；仅凭订单号看不到卡密。游客查单只返回订单列表，不返回卡密。
- 密码使用 scrypt 加盐哈希；会话为 HttpOnly Cookie，数据库只保存令牌摘要；改密码会让其它设备上的登录失效。
- 验证码在服务端生成和校验，一次性使用；登录、注册、下单、查单都有按 IP 的频率限制。
- 富文本在服务端按白名单过滤；上传图片校验文件头并重新命名；写接口校验请求来源防 CSRF；设置了 CSP 等安全响应头。

## 目录

- `server/`：后端（`routes/` 接口、`orders.ts` 下单与发货、`pay.ts` 支付网关、`db.ts` 数据库）
- `src/`：前端，`src/data/mock.ts` 是前后端共用的类型和演示数据
