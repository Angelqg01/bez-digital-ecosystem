# ── Stage 1: Install dependencies ────────────
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# ── Stage 2: Production image ────────────────
FROM node:18-alpine
WORKDIR /app

RUN addgroup -S bezhas && adduser -S bezhas -G bezhas

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN chown -R bezhas:bezhas /app
USER bezhas

EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:4100/health',r=>{if(r.statusCode!==200)process.exit(1)}).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
