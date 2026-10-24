FROM node:22.23.4-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY src/ ./src/
EXPOSE 3001
CMD ["node", "src/server.js"]
