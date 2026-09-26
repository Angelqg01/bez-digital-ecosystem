# ── Stage 1: Install dependencies ────────────
# Alpine, como el resto de servicios: en node:22-slim el binario de pnpm 11
# no arranca (falta libatomic.so.1) y la imagen no llegaba a construirse.
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# ── Stage 2: Production image ────────────────
FROM node:22-alpine
WORKDIR /app
RUN addgroup -S bezhas && adduser -S bezhas -G bezhas

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN chown -R bezhas:bezhas /app
USER bezhas

ENV NODE_ENV=production

# Cloud Run fija PORT (8080); en local, 3099.
EXPOSE 8080

# bootstrap-v3.js es el punto de entrada de producción.
CMD ["node", "bootstrap-v3.js"]
