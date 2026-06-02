# 🎯 Header con Funcionalidades de Wallet y Autenticación - BeZhas Platform

## 📋 Resumen de Funcionalidades Integradas

Este documento detalla todas las funcionalidades de wallet, venta de BEZ tokens y autenticación integradas en el Header de la plataforma.

---

## ✨ NUEVAS FUNCIONALIDADES

### 1. 🔐 **Autenticación Dual (Web2 + Web3)**

#### **Opciones de Autenticación:**

**A) Autenticación Web2 (Tradicional)**
- **Botón "Iniciar Sesión"** → Redirige a `/login`
- **Botón "Registrarse"** → Redirige a `/register`
- Sistema de email/password
- JWT tokens para sesiones

**B) Autenticación Web3 (Wallet)**
- **Botón "Conectar Wallet"** → Abre modal de WalletConnect/Web3Modal
- Soporta:
  - MetaMask
  - WalletConnect
  - Coinbase Wallet
  - Rainbow Wallet
  - Trust Wallet
  - Y más...

---

### 2. 💰 **Sistema de Compra de BEZ Tokens**

#### **Características:**

**Botón "Comprar BEZ"**
- Visible solo cuando la wallet está conectada
- Abre modal de compra interactivo
- Integrado con el contrato `TokenSale.sol`

#### **Funcionalidades del Modal de Compra:**

```javascript
// Características principales:
✅ Muestra precio actual de BEZ en ETH
✅ Input para cantidad en ETH
✅ Cálculo automático de tokens BEZ a recibir
✅ Muestra balance actual de ETH
✅ Validación de fondos suficientes
✅ Transacción on-chain directa
✅ Actualización automática de balance post-compra
```

**Flujo de Compra:**
1. Usuario hace clic en "Comprar BEZ"
2. Modal muestra precio: `0.0001 ETH por BEZ` (o precio del contrato)
3. Usuario ingresa cantidad de ETH (ej: 0.1 ETH)
4. Sistema calcula: `0.1 / 0.0001 = 1000 BEZ`
5. Usuario confirma transacción en wallet
6. Tokens se transfieren inmediatamente
7. Balance actualizado en tiempo real

---

### 3. 👛 **Menú de Wallet Desplegable**

#### **Información Mostrada:**

**Cuando la wallet está conectada:**
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

**Componentes del Menú:**
- Dirección de wallet (formato corto)
- Balance de ETH en tiempo real
- Balance de BEZ tokens en tiempo real
- Link a perfil de usuario
- Botón para desconectar wallet

---

### 4. 🎨 **Estados Visuales del Header**

#### **Estado: Usuario NO Conectado**
```
┌────────────────────────────────────────────────────┐
│ [Buscar...]  [🌙] [Iniciar Sesión] [Registrarse]  │
│              [Conectar Wallet] [🔔]                │
└────────────────────────────────────────────────────┘
```

#### **Estado: Usuario Conectado**
```
┌────────────────────────────────────────────────────┐
│ [Buscar...]  [Comprar BEZ] [🌙] [0x1234...5678 ▼] │
│              [🔔]                                   │
└────────────────────────────────────────────────────┘
```

---

## 🔧 INTEGRACIÓN TÉCNICA

### **Contratos Inteligentes Integrados:**

#### **1. TokenSale.sol**
```solidity
// Funciones utilizadas:
- buyTokens(uint256 amount) payable
- price() view returns (uint256)
- tokensSold() view returns (uint256)
```

**Dirección:** `0x0165878A594ca255338adfa4d48449f69242Eb8F`

#### **2. BezhasToken.sol (ERC20)**
```solidity
// Funciones utilizadas:
- balanceOf(address account) view returns (uint256)
- transfer(address to, uint256 amount) returns (bool)
- approve(address spender, uint256 amount) returns (bool)
```

**Dirección:** `0x5FbDB2315678afecb367f032d93F642f64180aa3`

---

### **Hooks de Wagmi Utilizados:**

```javascript
import { 
  useAccount,      // Estado de conexión de wallet
  useDisconnect,   // Función para desconectar
  useBalance,      // Balance de ETH nativo
} from 'wagmi';

import { useWeb3Modal } from '@web3modal/wagmi/react';
```

---

### **Contextos Integrados:**

#### **1. AuthContext**
```javascript
const { user, logout } = useAuth();

// Proporciona:
- user: Datos del usuario autenticado (Web2)
- logout: Función para cerrar sesión
- login: Función para iniciar sesión
- register: Función para registrarse
```

#### **2. ThemeContext**
```javascript
const { theme, toggleTheme } = useTheme();

// Maneja tema claro/oscuro
```

---

## 📊 TOKENOMICS DE BEZ

### **Información del Token:**

| Propiedad | Valor |
|-----------|-------|
| **Símbolo** | BEZ |
| **Nombre** | BeZhas Token |
| **Decimales** | 18 |
| **Supply Total** | 1,000,000,000 BEZ |
| **En Circulación** | 300,000,000 BEZ |
| **Precio Actual** | 0.0001 ETH |
| **Equivalente USD** | ~$0.30 USD |

### **Distribución:**
- 30% - En circulación
- 15% - Staking Pool
- 10% - Rewards y Gamificación
- 20% - Desarrollo y Marketing
- 15% - Equipo (vesting 2 años)
- 10% - Liquidez

---

## 🎯 CASOS DE USO

### **Caso 1: Usuario Nuevo (Sin Wallet)**

```
1. Usuario visita la plataforma
2. Ve botones: "Iniciar Sesión" | "Registrarse" | "Conectar Wallet"
3. Opciones:
   A) Registrarse con email → Crea cuenta Web2
   B) Conectar Wallet → Crea cuenta automática con wallet
```

### **Caso 2: Usuario Existente (Con Wallet)**

```
1. Usuario hace clic en "Conectar Wallet"
2. Selecciona MetaMask/WalletConnect
3. Autoriza conexión
4. Header muestra: [Comprar BEZ] [0x1234...5678]
5. Puede ver balances y comprar tokens
```

### **Caso 3: Compra de BEZ Tokens**

```
1. Usuario conectado hace clic en "Comprar BEZ"
2. Modal se abre con calculadora
3. Ingresa: 0.5 ETH
4. Sistema muestra: Recibirás 5,000 BEZ
5. Confirma transacción en wallet
6. Espera confirmación on-chain
7. Balance actualizado: +5,000 BEZ
```

---

## 🔒 SEGURIDAD

### **Medidas Implementadas:**

✅ **Validación de Inputs**
- Verificación de cantidad mínima
- Validación de balance suficiente
- Sanitización de inputs numéricos

✅ **Protección de Transacciones**
- Try-catch en todas las transacciones
- Mensajes de error descriptivos
- Confirmación antes de ejecutar

✅ **Manejo de Estados**
- Loading states durante transacciones
- Disable buttons durante procesamiento
- Timeouts para evitar transacciones colgadas

✅ **Conexión Segura**
- WalletConnect 2.0
- Encriptación de mensajes
- Verificación de firma

---

## 🎨 DISEÑO Y UX

### **Colores y Gradientes:**

```css
/* Botón Comprar BEZ */
background: linear-gradient(to right, #06b6d4, #3b82f6);

/* Botón Wallet Conectada */
background: linear-gradient(to right, #a855f7, #ec4899);

/* Botón Registrarse */
background: linear-gradient(to right, #06b6d4, #3b82f6);

/* Modal de Compra */
border: 1px solid rgba(6, 182, 212, 0.2);
background: rgba(6, 182, 212, 0.1);
```

### **Animaciones:**

- **Scroll**: Header se oculta al bajar, aparece al subir
- **Hover**: Efecto de elevación en botones
- **Loading**: Spinner circular durante transacciones
- **Dropdown**: Animación suave al abrir menú de wallet

---

## 📱 RESPONSIVE DESIGN

### **Breakpoints:**

**Desktop (> 768px):**
```
- Todos los textos visibles
- Botones con iconos + texto
- Modal centrado con padding
```

**Mobile (< 768px):**
```
- Solo iconos en botones
- Modal full-width con padding reducido
- Menú desplegable ajustado
```

**Ejemplo:**
```jsx
// Desktop
<span className="hidden md:inline">Comprar BEZ</span>

// Mobile - Solo icono
<ShoppingBag size={18} />
```

---

## 🧪 TESTING

### **Cómo Probar las Funcionalidades:**

#### **1. Test de Conexión de Wallet**
```bash
1. Abrir http://localhost:5173
2. Hacer clic en "Conectar Wallet"
3. Seleccionar MetaMask
4. Autorizar conexión
5. Verificar que aparezca dirección en header
```

#### **2. Test de Compra de Tokens**
```bash
1. Conectar wallet con ETH de prueba
2. Hacer clic en "Comprar BEZ"
3. Ingresar cantidad: 0.01 ETH
4. Verificar cálculo: 100 BEZ (si precio = 0.0001)
5. Confirmar transacción
6. Verificar balance actualizado
```

#### **3. Test de Autenticación Web2**
```bash
1. Hacer clic en "Iniciar Sesión"
2. Ingresar email/password
3. Verificar redirección a home
4. Verificar que aparezca menú de usuario
```

---

## 🐛 TROUBLESHOOTING

### **Problemas Comunes:**

#### **Error: "No se puede comprar tokens"**
**Solución:**
```bash
1. Verificar que TokenSale esté desplegado
2. Verificar que haya tokens disponibles en el contrato
3. Verificar que el precio esté configurado
4. Verificar balance de ETH suficiente
```

#### **Error: "Wallet no se conecta"**
**Solución:**
```bash
1. Verificar que MetaMask esté instalado
2. Verificar red correcta (Localhost/Sepolia)
3. Verificar que WalletConnect projectId sea válido
4. Limpiar caché del navegador
```

#### **Error: "Balance no se actualiza"**
**Solución:**
```bash
1. Esperar confirmación de transacción
2. Refrescar página
3. Verificar en Etherscan/Blockscout
4. Verificar que la dirección del token sea correcta
```

---

## 🔗 INTEGRACIONES

### **Servicios Externos:**

| Servicio | Propósito | Configuración |
|----------|-----------|---------------|
| **WalletConnect** | Conexión de wallets | projectId en wagmiConfig.js |
| **Ethers.js** | Interacción con blockchain | provider + signer |
| **Wagmi** | React hooks para Web3 | config en main.jsx |
| **Web3Modal** | UI de conexión | tema y opciones |

---

## 📚 REFERENCIAS

### **Archivos Modificados:**

```
frontend/src/components/layout/Header.jsx (PRINCIPAL)
├── Imports agregados:
│   ├── Wallet, ShoppingBag, LogIn, UserPlus, User, LogOut, Coins
│   ├── useWeb3Modal from @web3modal/wagmi/react
│   ├── useAuth from context/AuthContext
│   ├── ethers from ethers
│   └── Contract ABIs y addresses
│
├── Estados agregados:
│   ├── showUserMenu
│   ├── showBuyModal
│   ├── bezBalance
│   ├── ethAmount
│   ├── tokenAmount
│   └── tokenPrice
│
├── Funciones agregadas:
│   ├── fetchBezBalance()
│   ├── fetchTokenPrice()
│   ├── handleBuyTokens()
│   ├── handleDisconnect()
│   └── formatAddress()
│
└── Componentes JSX agregados:
    ├── Botón "Comprar BEZ"
    ├── Botones Login/Register
    ├── Menú desplegable de wallet
    └── Modal de compra de tokens
```

### **Contratos Relacionados:**

```
contracts/TokenSale.sol
contracts/BezhasToken.sol
frontend/src/contract-config.js
```

### **Contextos Relacionados:**

```
frontend/src/context/AuthContext.jsx
frontend/src/context/ThemeContext.jsx
frontend/src/context/Web3Context.jsx
```

---

## 🚀 PRÓXIMOS PASOS

### **Mejoras Planificadas:**

1. **Multi-Currency Support**
   - Comprar BEZ con USDC/USDT
   - Integración con DEX (Uniswap/SushiSwap)

2. **Historial de Transacciones**
   - Ver todas las compras previas
   - Exportar a CSV

3. **Notificaciones Push**
   - Alertas de transacciones confirmadas
   - Notificaciones de precio

4. **Wallet Analytics**
   - Gráficos de balance histórico
   - ROI calculator

5. **Social Login**
   - Login con Google/GitHub
   - Asociar wallet a cuenta social

---

## 💡 TIPS DE DESARROLLO

### **Best Practices:**

```javascript
// ✅ CORRECTO: Manejar errores de wallet
try {
  const tx = await contract.buyTokens(...);
  await tx.wait();
  // Actualizar UI
} catch (error) {
  if (error.code === 4001) {
    // Usuario rechazó transacción
  } else {
    // Otro error
  }
}

// ✅ CORRECTO: Validar inputs
if (!ethAmount || parseFloat(ethAmount) <= 0) {
  return;
}

// ✅ CORRECTO: Formatear números grandes
const formatted = ethers.formatEther(balance);
const parsed = ethers.parseEther(amount);
```

---

## 📞 SOPORTE

**¿Problemas o dudas?**
- 📧 Email: support@bezhas.xyz
- 💬 Discord: [BeZhas Community]
- 📖 Docs: https://docs.bezhas.xyz
- 🐦 Twitter: @BeZhasPlatform

---

**Fecha:** 2025-10-15  
**Versión:** 2.0.0  
**Autor:** GitHub Copilot  
**Proyecto:** BeZhas Web3 Platform
