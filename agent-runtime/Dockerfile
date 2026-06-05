# Use Node.js 20 LTS as base
FROM node:22-slim

# Create app directory
WORKDIR /app

# Copy package files
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

# Install dependencies (production only for smaller image)
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Expose default port (Cloud Run overrides PORT via env)
EXPOSE 8080

# Start the application
# We use bootstrap-v3.js as the main entry point for production
CMD [ "node", "bootstrap-v3.js" ]
