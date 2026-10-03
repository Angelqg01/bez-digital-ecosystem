# tx-signer — imagen mínima, sin root, sistema de ficheros de solo lectura en
# compose (el único sitio escribible es el volumen /data).
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S signer && adduser -S signer -G signer \
    && mkdir -p /data && chown signer:signer /data
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER signer
ENV NODE_ENV=production TX_SIGNER_DATA_DIR=/data PORT=4100
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://localhost:4100/healthz').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
