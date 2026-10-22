# Go365 Card

卡密自动发货商城：Vue 3 前端 + Node.js（Hono + SQLite）后端。

## Docker 部署（推荐）

推送到 main 分支后，GitHub Actions 会自动构建镜像并发布到 `ghcr.io/cicioln/go365-card`（支持 amd64 / arm64）。

```bash
curl -O https://raw.githubusercontent.com/cicioln/go365-card/main/docker-compose.yml
docker compose up -d
docker compose logs      # 查看安装码
```

1. 浏览器打开 `http://服务器IP:3000/admin`，输入日志中的安装码，设置管理员账号。
2. 进入「支付渠道」，填写易支付的网关地址、商户号、密钥，确认站点地址，切换为易支付。
3. 在「商品管理」把演示卡密（`DEMO-` 开头）换成真实卡密。

不需要 `.env`。数据保存在名为 `shop-data` 的 Docker 卷中，更新镜像（`docker compose pull && docker compose up -d`）不会丢失。

安装码每次启动重新生成，设置完管理员后失效；忘记看可以 `docker compose restart` 后再查日志。

### 可选的 .env

需要改端口、在反向代理后部署，或想用环境变量固定支付配置时，参考 [.env.example](.env.example) 创建 `.env`。环境变量会覆盖后台设置，后台对应项变为只读。

## 本地运行

需要 Node.js 22.6 及以上（使用内置的 `node:sqlite` 和 TypeScript 类型擦除，无需编译后端）。

```bash
npm install

# 开发：两个终端分别运行
npm run dev:server   # 后端 http://localhost:3000
npm run dev          # 前端 http://localhost:5173，/api 自动转发到后端

# 生产
npm run build
npm start            # 同一个端口提供页面和接口；使用 .env 时改为 npm run start:env
```

## 上线前必做

1. 后台「支付渠道」切换为易支付。模拟支付下任何拿到订单链接的人都能"支付"，后台顶部会一直显示警告。
2. 把自动发货商品的演示卡密换成真实卡密。
3. 配置 HTTPS（Cookie 会自动只走 HTTPS）；在 Nginx / Caddy 后部署时设置 `TRUST_PROXY=1`。
4. 定期备份数据卷（数据库、上传图片、签名密钥）。丢失签名密钥会导致已发出的订单链接和游客查单密码失效。

## 安全设计

- 价格、手续费、库存全部由服务端计算和校验，客户端传入的金额会被忽略。
- 下单即锁定库存（自动发货锁定具体卡密），超时未支付自动关闭并释放。
- 只有支付网关的签名回调（核对商户号、签名、金额）或管理员手动操作能把订单标记为已支付，重复回调不会重复发货。
- 查看订单需要下单时生成的访问令牌，或用下单账号登录；仅凭订单号看不到卡密。游客查单只返回订单列表，不返回卡密。
- 首次安装需要只出现在服务器日志里的安装码，防止部署后被他人抢先设置管理员。
- 支付密钥保存在服务端，后台接口只返回"是否已设置"，不回传明文。
- 支付回调地址使用后台保存的站点地址，不信任请求头中的 Host。
- 密码使用 scrypt 加盐哈希；会话为 HttpOnly Cookie，数据库只保存令牌摘要；改密码会让其它设备上的登录失效。
- 验证码在服务端生成和校验，一次性使用；登录、注册、下单、查单、安装都有按 IP 的频率限制。
- 富文本在服务端按白名单过滤；上传图片校验文件头并重新命名；写接口校验请求来源防 CSRF；设置了 CSP 等安全响应头。

## 目录

- `server/`：后端（`routes/` 接口、`orders.ts` 下单与发货、`pay.ts` 支付网关、`settings.ts` 后台可改的配置、`setup.ts` 首次安装、`db.ts` 数据库）
- `src/`：前端，`src/data/mock.ts` 是前后端共用的类型和演示数据
