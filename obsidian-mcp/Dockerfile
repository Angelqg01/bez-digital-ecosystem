FROM node:22.23.4-alpine

WORKDIR /app

RUN corepack enable

# pnpm-workspace.yaml lleva los overrides de seguridad registrados en el lockfile:
# sin él, --frozen-lockfile aborta con ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
ENV MCP_PORT=4007

EXPOSE 4007

CMD ["node", "src/index.js"]
