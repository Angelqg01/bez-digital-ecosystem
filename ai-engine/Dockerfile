# ── Stage 1: Install dependencies ────────────
FROM node:22.23.4-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# ── Stage 2: Production image ────────────────
FROM node:22.23.4-alpine
WORKDIR /app
RUN addgroup -S bezhas && adduser -S bezhas -G bezhas
RUN npm install -g pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN chown -R bezhas:bezhas /app
USER bezhas

EXPOSE 3002

# Puerto desde PORT: el compose lo pone a 4001 y el 3002 fijo daba siempre unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3002)+'/api/mcp/health').then(r=>{if(!r.ok) throw new Error('unhealthy');}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
