# ── Stage 1: Install + Build ─────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm build

# ── Stage 2: Production image ────────────────
FROM node:22-alpine
WORKDIR /app
RUN npm install -g pnpm && addgroup -S bezhas && adduser -S bezhas -G bezhas

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.mjs ./next.config.mjs

RUN chown -R bezhas:bezhas /app
USER bezhas

EXPOSE 3000

ENV NODE_ENV=production
ENV CI=true

CMD ["node", "node_modules/next/dist/bin/next", "start"]
