FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-workspace

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
ENV MCP_PORT=4007

EXPOSE 4007

CMD ["node", "src/index.js"]
