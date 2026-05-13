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

# Next inlines NEXT_PUBLIC_* env vars at build time, so we need them as
# build args (not just runtime env). Provide sensible defaults so a bare
# `docker build` still produces a working image; override in your build
# pipeline (Dokploy: Build → Build Args) when these need to change.
ARG NEXT_PUBLIC_EVENT_DATE="2026-05-16T19:00:00-03:00"
ARG NEXT_PUBLIC_EVENT_NAME="Jesus Vive Brasil"
ARG NEXT_PUBLIC_WHATSAPP_NUMBER="+447888862904"
ARG NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE="Olá! Quero saber mais sobre o evento Jesus Vive Brasil."
ARG NEXT_PUBLIC_YOUTUBE_LIVE_ID=""
ARG NEXT_PUBLIC_META_PIXEL_ID=""
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN=""
ENV NEXT_PUBLIC_EVENT_DATE=$NEXT_PUBLIC_EVENT_DATE
ENV NEXT_PUBLIC_EVENT_NAME=$NEXT_PUBLIC_EVENT_NAME
ENV NEXT_PUBLIC_WHATSAPP_NUMBER=$NEXT_PUBLIC_WHATSAPP_NUMBER
ENV NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE=$NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE
ENV NEXT_PUBLIC_YOUTUBE_LIVE_ID=$NEXT_PUBLIC_YOUTUBE_LIVE_ID
ENV NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID
ENV NEXT_PUBLIC_PLAUSIBLE_DOMAIN=$NEXT_PUBLIC_PLAUSIBLE_DOMAIN

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
