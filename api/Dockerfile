# ── Stage 1: Install dependencies ────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# ── Stage 2: Production image ────────────────
FROM node:22-alpine
WORKDIR /app
RUN addgroup -S bezhas && adduser -S bezhas -G bezhas
RUN npm install -g pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN ln -s /app/agent-runtime /agent-runtime && chown -R bezhas:bezhas /app
USER bezhas

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3001/api/health').then(r=>{if(!r.ok) throw new Error('unhealthy');}).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
