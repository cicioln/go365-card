# syntax=docker/dockerfile:1

# ---- 构建：编译前端、检查类型 ----
FROM node:22.22.2-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- 运行：只装生产依赖 ----
FROM node:22.22.2-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
# 后端复用的前端类型、演示数据与价格计算
COPY src/data/mock.ts ./src/data/mock.ts
COPY src/types.ts ./src/types.ts
COPY src/utils/pricing.ts ./src/utils/pricing.ts
# 以非 root 用户运行，数据目录挂载为卷
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME /app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/site > /dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "--experimental-strip-types", "server/index.ts"]
