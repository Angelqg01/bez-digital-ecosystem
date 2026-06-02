# 🚀 BeZhas DAO - Guía de Deployment

## 📋 Requisitos Previos

Antes de desplegar el sistema DAO, asegúrate de tener instalado:

- **Node.js** v18+ y npm
- **Hardhat** (se instala automáticamente con las dependencias)
- **MetaMask** o wallet compatible

## 🔧 Instalación

### 1. Instalar Dependencias del Proyecto

```bash
# En la raíz del proyecto
npm install

# Si tienes problemas, prueba con:
npm install --legacy-peer-deps
```

### 2. Verificar Dependencias de Hardhat

Asegúrate de que estas dependencias estén en `package.json`:

```json
{
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^4.0.0",
    "@openzeppelin/contracts": "^5.0.0",
    "hardhat": "^2.19.0"
  }
}
```

Si faltan, instálalas:

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
```

## 🏗️ Deployment en Localhost

### Paso 1: Iniciar Hardhat Node

Abre una **primera terminal** y ejecuta:

```bash
npx hardhat node
```

Verás algo como:

```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
...
```

**🔑 IMPORTANTE:** Copia la dirección y private key de la Account #0 para importarla en MetaMask.

### Paso 2: Ejecutar el Script de Deployment

En una **segunda terminal**, ejecuta:

```bash
npx hardhat run scripts/deploy-dao.js --network localhost
```

Verás la salida del deployment:

```
🚀 Iniciando despliegue de la Arquitectura DAO Completa...

🔑 Desplegando con la cuenta: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
   Balance: 10000.0 ETH

📦 FASE 1: Desplegando Token de Gobernanza y Core...
✅ Token Desplegado: 0x5FbDB2315678afecb367f032d93F642f64180aa3
   Supply inicial: 1,000,000 DGT
🛡️ Plugin Manager (Core) Desplegado: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
   Rol: Guardián de seguridad inmutable

📦 FASE 2: Desplegando Plugins de Negocio...
💰 Tesorería Desplegada: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
👥 HR Plugin Desplegado: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
⚖️ Gobernanza Desplegada: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
📢 Publicidad (DePub) Desplegada: 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707

🔗 FASE 3: Conectando los cables (Autorización de Plugins)...
   ✅ Treasury autorizado
   ✅ HR autorizado
   ✅ Governance autorizado
   ✅ Advertising autorizado

🌱 FASE 4: Sembrando datos iniciales para el Dashboard...
   💰 Tesorería fondeada con 500,000 DGT
   📢 Ad Card #0 creada (Header Banner - 45k impressions/mes)
   👤 Vesting creado para 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
      - Total: 100,000 DGT
      - Cliff: 90 días
      - Duración: 2 años

📝 FASE 5: Generando configuración para el Frontend...
   ✅ Configuración guardada en: ./frontend/src/config/dao-contracts.json
   ✅ Configuración guardada en: ./contracts-config.json

======================================================================
🎉 ¡SISTEMA DAO COMPLETAMENTE DESPLEGADO!
======================================================================
```

### Paso 3: Verificar Archivos de Configuración

El script genera automáticamente estos archivos:

```
frontend/src/config/dao-contracts.json
contracts-config.json
deployed-contracts.json
```

Contenido de ejemplo:

```json
{
  "network": "localhost",
  "chainId": "31337",
  "deployer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "contracts": {
    "token": {
      "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "name": "DAO Governance Token",
      "symbol": "DGT"
    },
    "pluginManager": {
      "address": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      "name": "PluginManager (Core)"
    },
    "treasury": {
      "address": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      "name": "TreasuryPlugin"
    },
    ...
  }
}
```

## 🌐 Configurar MetaMask

### 1. Agregar Red Localhost

En MetaMask:
- Clic en el selector de red → "Add Network" → "Add a network manually"
- Configuración:
  ```
  Network Name: Hardhat Localhost
  RPC URL: http://127.0.0.1:8545
  Chain ID: 31337
  Currency Symbol: ETH
  ```

### 2. Importar Cuenta de Test

- Clic en el icono de cuenta → "Import Account"
- Pega la **Private Key** de Account #0 (del paso 1)
- Verás 10,000 ETH disponibles

### 3. Importar Token DGT

- En MetaMask → "Import Tokens"
- Pega la dirección del token (del archivo `dao-contracts.json`)
- Verás tu balance de DGT tokens

## 🖥️ Iniciar el Frontend

En una **tercera terminal**:

```bash
cd frontend
npm run dev
```

Abre tu navegador en: **http://localhost:5173**

## 🎯 Probar el Sistema

### Navegación Principal

- **Landing**: http://localhost:5173/dao
- **Treasury**: http://localhost:5173/dao/treasury
- **Talent**: http://localhost:5173/dao/talent
- **Governance**: http://localhost:5173/dao/governance
- **Advertising**: http://localhost:5173/dao/advertising

### Flujos de Prueba

#### 1. Treasury - Rebalanceo Automático

1. Ve a `/dao/treasury`
2. Observa el indicador de riesgo (70% exposure)
3. Clic en "Ejecutar Rebalanceo"
4. Confirma la transacción en MetaMask
5. Verifica que el exposure baje a 50%

#### 2. Talent - Vesting

1. Ve a `/dao/talent`
2. Observa el progress bar de vesting
3. Si hay tokens disponibles, clic en "Reclamar Ahora"
4. Confirma la transacción
5. Verifica que tu balance DGT aumente

#### 3. Governance - Crear Propuesta

1. Ve a `/dao/governance`
2. Clic en "Nueva Propuesta"
3. Llena el formulario
4. **Importante**: Aprueba primero 1,000 DGT tokens
5. Confirma el depósito de stake
6. Propuesta creada y visible en la lista

#### 4. Advertising - Rentar Ad Space

1. Ve a `/dao/advertising`
2. Selecciona un Ad Card disponible
3. Ajusta el slider de días de renta
4. Observa la distribución automática (50/30/20)
5. Clic en "Confirmar Renta"
6. Aprueba y ejecuta la transacción

## 🧪 Testing

### Compilar Contratos

```bash
npx hardhat compile
```

### Ejecutar Tests (cuando estén disponibles)

```bash
npx hardhat test
npx hardhat test test/TreasuryPlugin.test.js
```

### Ver Coverage

```bash
npx hardhat coverage
```

## 🔄 Re-deployment

Si necesitas re-desplegar (por ejemplo, después de cambios en contratos):

1. **Detén** Hardhat Node (Ctrl+C)
2. **Elimina** carpetas de cache:
   ```bash
   rm -rf artifacts cache
   ```
3. **Re-inicia** Hardhat Node
4. **Re-ejecuta** el script de deployment
5. **Actualiza** MetaMask:
   - Configuración → Avanzado → "Clear activity tab data"
   - Re-importa el token DGT con la nueva dirección

## 🐛 Troubleshooting

### Error: "Insufficient funds"

**Causa**: La cuenta de MetaMask no tiene ETH suficiente.

**Solución**: Asegúrate de estar usando la cuenta importada con 10,000 ETH.

### Error: "Nonce too high"

**Causa**: MetaMask tiene nonces incorrectos después de re-deployment.

**Solución**:
1. MetaMask → Configuración → Avanzado
2. "Clear activity tab data"
3. Reinicia MetaMask

### Error: "Cannot read property 'address' of undefined"

**Causa**: El archivo `dao-contracts.json` no se generó correctamente.

**Solución**:
1. Verifica que el script de deployment terminó sin errores
2. Busca manualmente los archivos:
   ```bash
   find . -name "dao-contracts.json"
   ```
3. Verifica que el frontend esté leyendo el archivo correcto

### Frontend no se conecta

**Causa**: RPC URL incorrecta o red no configurada.

**Solución**:
1. Verifica que Hardhat Node esté corriendo
2. En MetaMask, cambia a la red "Hardhat Localhost"
3. Refresca la página del frontend

## 📚 Recursos Adicionales

- **Documentación Completa**: `contracts/dao/DAO_COMPLETE_GUIDE.md`
- **Arquitectura**: `contracts/dao/DAO_ARCHITECTURE.md`
- **Hardhat Docs**: https://hardhat.org/getting-started
- **OpenZeppelin**: https://docs.openzeppelin.com/contracts

## 🚀 Deployment a Testnet (Sepolia)

Para desplegar en Sepolia u otra testnet:

1. Configura `.env`:
   ```env
   PRIVATE_KEY=your_private_key
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
   ETHERSCAN_API_KEY=your_etherscan_key
   ```

2. Ejecuta:
   ```bash
   npx hardhat run scripts/deploy-dao.js --network sepolia
   ```

3. Verifica en Etherscan:
   ```bash
   npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
   ```

---

**Última Actualización**: Noviembre 18, 2025  
**Versión**: v2.0  
**Soporte**: BeZhas DAO Team
