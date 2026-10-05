# ── Stage 1: Install + Build ─────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
# NEXT_PUBLIC_* se incorpora al bundle en tiempo de BUILD, no de ejecución. El
# .gcloudignore excluye .env.*, así que sin esto el build no recibe ninguna URL
# y el front cae al valor por defecto del código (http://localhost:3001/api):
# el panel cargaría pero el login iría a localhost. Sobrescribible con
# --build-arg para otros entornos.
ARG NEXT_PUBLIC_API_URL=https://api.bezhas.com/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
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
