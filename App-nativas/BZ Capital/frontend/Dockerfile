FROM node:22-alpine AS base
RUN npm install -g pnpm@11

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --ignore-workspace --no-frozen-lockfile --ignore-scripts

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# La URL de la API se incrusta en el build (sin esto llama a http://localhost:3003).
ARG NEXT_PUBLIC_API_URL=https://api.bezhas.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 5174
ENV PORT=5174
CMD ["node", "server.js"]
