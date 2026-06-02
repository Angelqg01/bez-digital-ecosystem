#!/bin/bash

# test-local-install.sh
# Escrito para Windows Git Bash o Linux
# Este script enlaza el SDK y el MCP localmente para evitar errores 404 de NPM.

echo "🚀 Iniciando configuración de enlaces locales para BeZhas SDK..."

# 1. Entrar al SDK y crear el enlace global
echo "📦 Enlazando @bezhas/sdk..."
cd sdk
pnpm install
pnpm link --global
cd ..

# 2. Entrar al MCP y crear el enlace global
echo "📦 Enlazando @bezhas/mcp-server..."
cd packages/mcp-server
pnpm install
pnpm link --global
cd ../..

# 3. Enlazar en el Backend
echo "🔗 Conectando paquetes en el Backend..."
cd backend
pnpm link --global @bezhas/sdk @bezhas/mcp-server
cd ..

# 4. Enlazar en el Frontend
echo "🔗 Conectando paquetes en el Frontend..."
cd frontend
pnpm link --global @bezhas/sdk
cd ..

echo "✅ Configuración completada. Los paquetes ahora se resuelven localmente."
echo "💡 Para verificar, intenta ejecutar: node -e \"console.log(require('@bezhas/sdk'))\""
