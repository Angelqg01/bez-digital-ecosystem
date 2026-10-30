FROM node:22.23.4-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3003
CMD ["node", "server.js"]
