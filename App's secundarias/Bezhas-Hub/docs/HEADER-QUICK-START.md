# 🚀 Guía Rápida: Header con Wallet y Compra de BEZ Tokens

## 📖 Resumen Ejecutivo

Se han integrado **TODAS** las funcionalidades de wallet, autenticación y compra de tokens BEZ en el Header de la plataforma BeZhas. Ahora los usuarios pueden:

✅ Iniciar sesión con email/password (Web2)  
✅ Conectar wallet (MetaMask, WalletConnect, etc.)  
✅ Comprar BEZ tokens directamente desde el header  
✅ Ver balances de ETH y BEZ en tiempo real  
✅ Gestionar su cuenta desde un menú desplegable  

---

## 🎯 Funcionalidades Implementadas

### 1️⃣ **Autenticación Dual (Web2 + Web3)**

| Método | Botón | Ruta | Descripción |
|--------|-------|------|-------------|
| Web2 | "Iniciar Sesión" | `/login` | Email + Password tradicional |
| Web2 | "Registrarse" | `/register` | Crear cuenta nueva |
| Web3 | "Conectar Wallet" | - | MetaMask, WalletConnect, etc. |

### 2️⃣ **Sistema de Compra de BEZ Tokens**

**Características:**
- Botón "Comprar BEZ" (visible solo cuando wallet está conectada)
- Modal interactivo con calculadora en tiempo real
- Integración directa con contrato `TokenSale.sol`
- Actualización automática de balance post-compra

**Flujo de Compra:**
```
Usuario → Clic "Comprar BEZ" → Ingresa ETH → Sistema calcula BEZ → Confirma → ¡Tokens recibidos!
```

### 3️⃣ **Menú de Wallet Inteligente**

**Información mostrada:**
- ✅ Dirección de wallet (formato abreviado)
- ✅ Balance de ETH en tiempo real
- ✅ Balance de BEZ en tiempo real
- ✅ Link a perfil de usuario
- ✅ Botón para desconectar

---

## 💻 Cómo Usar

### Para Usuarios Nuevos (Sin Wallet)

**Opción 1: Registro Tradicional**
```
1. Clic en "Registrarse"
2. Ingresar email y password
3. Confirmar cuenta
4. ¡Listo! Ya puedes explorar
```

**Opción 2: Conectar Wallet Directamente**
```
1. Clic en "Conectar Wallet"
2. Seleccionar MetaMask (o tu wallet favorita)
3. Autorizar conexión
4. ¡Tu cuenta se crea automáticamente!
```

### Para Usuarios Existentes

**Iniciar Sesión con Email:**
```
1. Clic en "Iniciar Sesión"
2. Ingresar credenciales
3. Acceder a la plataforma
```

**Conectar Wallet:**
```
1. Clic en "Conectar Wallet"
2. Autorizar en wallet
3. Ver balance en header
```

### Comprar BEZ Tokens

**Paso a Paso:**
```
1. Conectar wallet (si aún no lo has hecho)
2. Hacer clic en botón "Comprar BEZ" 
3. En el modal, ingresar cantidad de ETH
4. Ver cálculo automático de BEZ tokens
5. Hacer clic en "Comprar BEZ Tokens"
6. Confirmar transacción en tu wallet
7. ¡Esperar confirmación y recibir tokens!
```

**Ejemplo:**
```
Ingresas: 0.1 ETH
Precio: 0.0001 ETH por BEZ
Recibes: 1,000 BEZ tokens
```

---

## 📊 Información de Tokens

### BEZ Token (BeZhas Token)

| Propiedad | Valor |
|-----------|-------|
| **Símbolo** | BEZ |
| **Decimales** | 18 |
| **Total Supply** | 1,000,000,000 BEZ |
| **Precio Actual** | 0.0001 ETH (~$0.30 USD) |
| **Contrato Token** | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| **Contrato Sale** | `0x0165878A594ca255338adfa4d48449f69242Eb8F` |

### Distribución del Token

```
📊 DISTRIBUCIÓN
├─ 30% - En Circulación (300M BEZ)
├─ 15% - Staking Pool (150M BEZ)
├─ 10% - Rewards (100M BEZ)
├─ 20% - Desarrollo y Marketing (200M BEZ)
├─ 15% - Equipo con vesting 2 años (150M BEZ)
└─ 10% - Liquidez (100M BEZ)
```

---

## 🛠️ Componentes Creados

### 1. Header.jsx (Modificado)
**Ubicación:** `frontend/src/components/layout/Header.jsx`

**Nuevas características:**
- ✅ Botones de autenticación (Login/Register)
- ✅ Botón "Conectar Wallet"
- ✅ Botón "Comprar BEZ"
- ✅ Menú desplegable de wallet
- ✅ Modal de compra de tokens
- ✅ Actualización de balances en tiempo real

### 2. TokenInfoWidget.jsx (Nuevo)
**Ubicación:** `frontend/src/components/widgets/TokenInfoWidget.jsx`

**Características:**
- ✅ Estadísticas en tiempo real de BEZ
- ✅ Precio, market cap, supply
- ✅ Distribución visual del token
- ✅ Información de contratos
- ✅ Actualización automática cada 30s

---

## 🎨 Estados Visuales del Header

### Estado: Usuario NO Conectado
```
┌──────────────────────────────────────────────────────┐
│  [🔍 Buscar...]  [🌙]  [Iniciar Sesión]             │
│                  [Registrarse]  [Conectar Wallet]    │
│                  [🔔]                                 │
└──────────────────────────────────────────────────────┘
```

### Estado: Usuario Conectado
```
┌──────────────────────────────────────────────────────┐
│  [🔍 Buscar...]  [🛒 Comprar BEZ]  [🌙]              │
│                  [👛 0x1234...5678 ▼]  [🔔]          │
└──────────────────────────────────────────────────────┘
```

### Menú Desplegable (Wallet Conectada)
```
┌─────────────────────────────────┐
│  Wallet Conectada               │
│  0x1234...5678                  │
├─────────────────────────────────┤
│  ETH Balance:    0.5432 ETH     │
│  BEZ Balance:    1,250.00 BEZ   │
├─────────────────────────────────┤
│  👤 Mi Perfil                   │
│  🚪 Desconectar                 │
└─────────────────────────────────┘
```

---

## 🔧 Tecnologías Utilizadas

```javascript
// Web3 Stack
- ethers.js v6       // Interacción con blockchain
- wagmi              // React hooks para Web3
- @web3modal/wagmi   // UI de conexión de wallet
- WalletConnect 2.0  // Protocolo de conexión

// React Stack
- React 18           // Framework principal
- React Router v6    // Navegación
- Lucide React       // Iconos
- Tailwind CSS       // Estilos
```

---

## 📁 Archivos Importantes

### Archivos Modificados
```
frontend/src/components/layout/Header.jsx (500+ líneas)
```

### Archivos Creados
```
frontend/src/components/widgets/TokenInfoWidget.jsx
docs/HEADER-WALLET-FEATURES.md
docs/HEADER-QUICK-START.md (este archivo)
```

### Archivos de Configuración
```
frontend/src/contract-config.js (ABIs y direcciones)
frontend/src/lib/web3/wagmiConfig.js (Configuración Web3)
frontend/src/context/AuthContext.jsx (Contexto de autenticación)
```

---

## 🧪 Testing

### Verificar Conexión de Wallet

```bash
# 1. Iniciar el proyecto
cd frontend
npm run dev

# 2. Abrir en navegador
# http://localhost:5173

# 3. Hacer clic en "Conectar Wallet"
# 4. Seleccionar MetaMask
# 5. Autorizar conexión
# 6. Verificar que aparezca la dirección en el header
```

### Verificar Compra de Tokens

```bash
# Pre-requisitos:
# - Wallet conectada
# - ETH de prueba en la wallet
# - Contratos desplegados

# Pasos:
1. Hacer clic en "Comprar BEZ"
2. Ingresar cantidad: 0.01 ETH
3. Verificar cálculo: 100 BEZ (si precio = 0.0001)
4. Clic en "Comprar BEZ Tokens"
5. Confirmar en MetaMask
6. Esperar confirmación
7. Verificar balance actualizado en header
```

---

## 🐛 Solución de Problemas

### Error: "No se puede conectar la wallet"

**Soluciones:**
```bash
1. Verificar que MetaMask esté instalado
2. Verificar que estés en la red correcta (Localhost/Sepolia)
3. Limpiar caché del navegador
4. Recargar la página
```

### Error: "No se puede comprar tokens"

**Soluciones:**
```bash
1. Verificar que TokenSale esté desplegado
2. Verificar que haya tokens disponibles
3. Verificar balance de ETH suficiente
4. Verificar que la venta esté activa
5. Revisar errores en consola del navegador
```

### Los balances no se actualizan

**Soluciones:**
```bash
1. Esperar 1-2 bloques para confirmación
2. Refrescar la página
3. Verificar transacción en Etherscan/Blockscout
4. Verificar direcciones de contratos correctas
```

---

## 🎯 Casos de Uso

### Caso 1: Nuevo Usuario Compra Tokens

```
1. Usuario visita BeZhas por primera vez
2. Ve botón "Conectar Wallet"
3. Conecta su MetaMask
4. Ve botón "Comprar BEZ" aparecer
5. Hace clic y abre modal
6. Ingresa 0.5 ETH
7. Sistema muestra: "Recibirás 5,000 BEZ"
8. Confirma transacción
9. Espera confirmación
10. Balance actualizado: +5,000 BEZ
11. ¡Puede empezar a usar la plataforma!
```

### Caso 2: Usuario Existente Revisa Balance

```
1. Usuario ya registrado hace clic en "Iniciar Sesión"
2. Ingresa email y password
3. Después de login, conecta wallet
4. Header muestra su dirección: 0x1234...5678
5. Hace clic en la dirección
6. Menú desplegable muestra:
   - ETH Balance: 2.5432 ETH
   - BEZ Balance: 10,250.00 BEZ
7. Puede ir a "Mi Perfil" o "Desconectar"
```

---

## 🚀 Próximas Mejoras

### Versión 2.1 (Próximamente)
- [ ] Compra con USDC/USDT
- [ ] Integración con Uniswap/SushiSwap
- [ ] Historial de transacciones
- [ ] Exportar a CSV/PDF

### Versión 2.2 (Futuro)
- [ ] Gráficos de precio en tiempo real
- [ ] Notificaciones push de transacciones
- [ ] Multi-wallet support (conectar múltiples wallets)
- [ ] Social login (Google, GitHub)

---

## 📚 Documentación Completa

Para información más detallada, consulta:

- **[HEADER-WALLET-FEATURES.md](./HEADER-WALLET-FEATURES.md)** - Documentación técnica completa
- **[ERRORS-FIXED.md](./ERRORS-FIXED.md)** - Errores corregidos
- **[ADMIN-DASHBOARD-COMPLETE.md](./ADMIN-DASHBOARD-COMPLETE.md)** - Panel de administración

---

## 💡 Tips para Desarrolladores

### Agregar nuevo método de pago

```javascript
// En Header.jsx, agregar nueva función:
const handleBuyWithUSDC = async () => {
  // 1. Aprobar USDC
  // 2. Llamar a buyTokensWithUSDC()
  // 3. Actualizar balances
};
```

### Modificar precio del token

```javascript
// En el contrato TokenSale.sol:
function setPrice(uint256 newPrice) external onlyOwner {
    price = newPrice;
}
```

### Personalizar el header

```javascript
// En Header.jsx, modificar colores:
const buttonGradient = "from-cyan-500 to-blue-500";

// Cambiar a:
const buttonGradient = "from-purple-500 to-pink-500";
```

---

## 📞 Soporte

**¿Necesitas ayuda?**
- 📧 Email: support@bezhas.xyz
- 💬 Discord: [BeZhas Community]
- 📖 Docs: https://docs.bezhas.xyz
- 🐦 Twitter: @BeZhasPlatform
- 🎮 GitHub: https://github.com/bezhas

---

## ✅ Checklist de Implementación

- [x] Integrar botones de autenticación
- [x] Conectar wallet con WalletConnect
- [x] Implementar sistema de compra de tokens
- [x] Mostrar balances en tiempo real
- [x] Crear menú desplegable de wallet
- [x] Agregar modal de compra
- [x] Integrar contratos inteligentes
- [x] Documentar funcionalidades
- [x] Testing de flujos completos

---

**🎉 ¡Todo listo! El Header está completamente funcional con todas las características de wallet y compra de tokens.**

---

**Fecha de Implementación:** 15 de Octubre, 2025  
**Versión:** 2.0.0  
**Desarrollado por:** GitHub Copilot  
**Proyecto:** BeZhas Web3 Social Platform
