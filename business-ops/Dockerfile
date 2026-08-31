# business-ops (OPERANT) — plano de operación de empresa.
#
# Mismo patrón que api/Dockerfile: dependencias en una etapa, imagen final
# mínima y sin root. Node 22 porque pnpm@11 exige >=22.13.

# ── Etapa 1: dependencias ─────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
# --prod: fuera nodemon y demás herramientas de desarrollo.
# --ignore-scripts: las dependencias opcionales (minio) no necesitan compilar.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# ── Etapa 2: imagen de ejecución ──────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
RUN addgroup -S bezhas && adduser -S bezhas -G bezhas

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# El almacén SQLite de reserva y los adjuntos necesitan un directorio escribible
# por el usuario sin privilegios. En producción el store es Postgres, pero si
# alguien arranca sin DATABASE_URL el proceso no debe morir por permisos.
RUN mkdir -p /app/data /app/output && chown -R bezhas:bezhas /app
USER bezhas

EXPOSE 4000

# /healthz comprueba store y motor de verdad, no solo que el puerto responda:
# un contenedor que acepta conexiones pero no llega a su base no está sano.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://localhost:4000/healthz').then(r=>r.json()).then(j=>{if(j.status!=='healthy')throw new Error(j.status)}).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
