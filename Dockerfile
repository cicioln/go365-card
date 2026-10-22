# syntax=docker/dockerfile:1

# 依赖都是纯 JavaScript（没有原生模块），所以安装和构建都在构建机的原生平台上完成，
# 目标平台（如 arm64）的镜像只复制文件、不运行任何命令，避免 QEMU 模拟执行 npm 时崩溃。

# ---- 构建：编译前端、检查类型 ----
FROM --platform=$BUILDPLATFORM node:22.22.2-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 生产依赖 ----
FROM --platform=$BUILDPLATFORM node:22.22.2-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force && mkdir -p /out/data

# ---- 运行 ----
FROM node:22.22.2-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
# 后端复用的前端类型、演示数据与工具函数（价格计算、SEO 等）
COPY --chown=node:node src/data/mock.ts ./src/data/mock.ts
COPY --chown=node:node src/types.ts ./src/types.ts
COPY --chown=node:node src/utils ./src/utils
# 数据目录（挂载为卷），以非 root 用户运行
COPY --from=deps --chown=node:node /out/data ./data
USER node
VOLUME /app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/site > /dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "--experimental-strip-types", "server/index.ts"]
