# ===================================================
# BeZhas Frontend-Next - Next.js Multi-Stage Dockerfile
# ===================================================

# ===== STAGE 1: Dependencies =====
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@11

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# ===== STAGE 2: Builder =====
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@11

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Set environment variables for build-time
ARG VITE_API_URL=https://api.bez.digital
ARG VITE_CHAIN_ID=137
ARG VITE_NETWORK=polygon

ENV NEXT_PUBLIC_API_URL=$VITE_API_URL \
    NEXT_PUBLIC_CHAIN_ID=$VITE_CHAIN_ID \
    NEXT_PUBLIC_NETWORK=$VITE_NETWORK

# Build Next.js app
RUN pnpm run build

# ===== STAGE 3: Production =====
FROM node:20-alpine AS production
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Copy built app
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

# Change ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 8080

ENV PORT 8080
ENV NODE_ENV production

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

CMD ["node_modules/.bin/next", "start"]
