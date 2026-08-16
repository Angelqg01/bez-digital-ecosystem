# ── Stage 1: Install dependencies ────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# ── Stage 2: Production image ────────────────
FROM node:22-alpine
WORKDIR /app
RUN addgroup -S bezhas && adduser -S bezhas -G bezhas
RUN npm install -g pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# gcp-deploy.sh copia agent-lib/ dentro de api/ antes de construir, asi que
# aqui acaba en /app/agent-lib. El enlace existe porque el codigo resuelve la
# biblioteca con path.resolve(__dirname, '..', '..', 'agent-lib'): desde
# /app/services eso da /agent-lib, fuera de /app. Sin el enlace, la API
# arranca pero se queda sin sus cinco agentes.
RUN ln -s /app/agent-lib /agent-lib && chown -R bezhas:bezhas /app
USER bezhas

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3001/api/health').then(r=>{if(!r.ok) throw new Error('unhealthy');}).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
