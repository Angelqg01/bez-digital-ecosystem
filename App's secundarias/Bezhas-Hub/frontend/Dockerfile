# ===== ETAPA 1: Build =====
FROM node:18-alpine as build

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies para el build)
RUN npm install

# Copiar el código fuente
COPY . .

# Build de la aplicación React
RUN npm run build

# ===== ETAPA 2: Servir con Nginx =====
FROM nginx:alpine

# Copiar los archivos compilados desde la etapa de build
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuración de Nginx para React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Comando de inicio
CMD ["nginx", "-g", "daemon off;"]
