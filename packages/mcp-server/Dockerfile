# ============================================================================
# @bezhas/mcp-server — imagen de producción
# ============================================================================
#
# Contexto de construcción: este directorio (`packages/mcp-server`). El paquete
# lleva su propio `pnpm-lock.yaml`, así que se construye solo, sin el workspace.
#
#   docker build -t bezhas/mcp-server packages/mcp-server
#
# Tres cosas que esta imagen hace a propósito:
#
#   1. INSTALA DESDE EL LOCKFILE. Antes usaba `npm install` sin copiar ningún
#      lockfile, así que cada construcción resolvía versiones nuevas: dos
#      imágenes del mismo commit no contenían el mismo código. Con
#      `--frozen-lockfile` la construcción falla si el lockfile no cuadra con
#      el `package.json`, que es justo lo que se quiere saber.
#
#   2. NO ARRASTRA LAS DEPENDENCIAS DE DESARROLLO. La etapa de compilación
#      necesita TypeScript; la de producción, no. Antes se copiaba el
#      `node_modules` entero de la primera a la segunda, con lo que la imagen
#      publicada llevaba dentro tsc, tsx y vitest.
#
#   3. NO CORRE COMO ROOT. `node:*-slim` trae ya un usuario `node` sin
#      privilegios; el proceso corre con él.

# ─── Etapa 1: compilar ──────────────────────────────────────────────────────
FROM node:24-slim AS builder

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.0.0 --activate

WORKDIR /app

# Primero solo los manifiestos: mientras no cambien, Docker reutiliza la capa
# de instalación y no repite la descarga en cada cambio de código.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build

# ─── Etapa 2: dependencias de producción, y nada más ────────────────────────
FROM node:24-slim AS deps

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.0.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# ─── Etapa 3: la imagen que se publica ──────────────────────────────────────
FROM node:24-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HTTP_PORT=8080

COPY --chown=node:node package.json ./
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 8080

# El servidor expone su propio estado; que el orquestador lo mire en vez de
# dar por vivo cualquier proceso que siga arrancado.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.HTTP_PORT||8080)+'/api/mcp/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `--init` en el `docker run` no está garantizado, así que el cierre ordenado
# lo maneja el propio proceso: `http-server.ts` instala SIGTERM y SIGINT.
CMD ["node", "dist/http-server.js"]
