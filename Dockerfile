FROM node:20-alpine AS base

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

RUN apk add --no-cache postgresql-client

COPY . .

FROM base AS builder
WORKDIR /app

RUN pnpm build

COPY src/migrations ./dist/migrations
RUN pnpm typeorm:migration:run

FROM base AS production
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

EXPOSE ${PORT:-3000}

ENV NODE_ENV=production
ENV PORT=3000
ENV REDIS_PORT=6380

CMD ["pnpm", "start:prod"]