# ── Stage 1: Install + Build ─────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
# Next.js incrusta NEXT_PUBLIC_* en el JavaScript del navegador AL COMPILAR.
# Pasarlas solo al arrancar el contenedor (como hacía el despliegue) no sirve:
# el código del cliente caía a 'http://localhost:3001/api' y el login, el
# panel de admin y los streams apuntaban al ordenador del visitante.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_CHAIN_ID
ARG NEXT_PUBLIC_BEZ_TOKEN
ARG NEXT_PUBLIC_ADMIN_WALLET
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL \
    NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID \
    NEXT_PUBLIC_BEZ_TOKEN=$NEXT_PUBLIC_BEZ_TOKEN \
    NEXT_PUBLIC_ADMIN_WALLET=$NEXT_PUBLIC_ADMIN_WALLET \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
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
