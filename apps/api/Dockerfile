FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/database ./packages/database
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @commercepilot/database db:generate
RUN pnpm --filter @commercepilot/database build
RUN pnpm --filter @commercepilot/api build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/database ./packages/database
COPY apps/api ./apps/api

COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/src/generated ./packages/database/src/generated
COPY --from=builder /app/apps/api/dist ./apps/api/dist

RUN pnpm install --prod --frozen-lockfile

EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
