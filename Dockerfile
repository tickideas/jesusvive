# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app

# ---- deps ----
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---- builder ----
FROM base AS builder
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- migrator: production deps only, from the lockfile ----
# Note: this installs the full prod tree just to use drizzle-orm + postgres.
# If image size becomes a concern, narrow this down via `npm prune` or copy
# only the two relevant package trees out of /app/node_modules instead.
FROM base AS migrator
RUN apk add --no-cache libc6-compat
WORKDIR /migrator
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- runner ----
FROM base AS runner
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Next standalone output (server.js + minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migration assets: SQL files + JS migrator + locked production node_modules
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --chown=nextjs:nodejs scripts ./scripts
COPY --from=migrator --chown=nextjs:nodejs /migrator/node_modules ./scripts/node_modules

RUN chmod +x ./scripts/start.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["./scripts/start.sh"]
