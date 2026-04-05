FROM node:20-slim AS builder
WORKDIR /app

COPY package.json ./
RUN npm install --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

# ── Production stage ──
FROM node:20-slim
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

ENV NODE_ENV=production
ENV HTTP_PORT=8080

EXPOSE 8080

# Start HTTP wrapper (for Docker inter-service communication)
CMD ["node", "dist/http-server.js"]
