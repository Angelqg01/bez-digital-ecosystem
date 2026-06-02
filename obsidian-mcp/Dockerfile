FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
ENV MCP_PORT=4007

EXPOSE 4007

CMD ["npm", "start"]
