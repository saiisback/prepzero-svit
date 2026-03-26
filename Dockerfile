# Stage 1: Base
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# Stage 2: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma/schema.prisma prisma/schema.prisma
COPY prisma.config.ts prisma.config.ts
RUN npm ci

# Stage 3: Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_ vars are baked at build time
ARG NEXT_PUBLIC_APP_URL=https://svit.prepzer0.co.in
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npx prisma generate
RUN npm run build

# Stage 4: Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/src/generated ./src/generated

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
