# Be-VIP - Calculadora de Recompensas On-Chain

## 🎯 Descripción

Be-VIP es una dApp Web3 que migra el sistema de tokenomics de BeZhas a blockchain. Permite a los usuarios calcular sus recompensas en tokens BEZ de forma transparente on-chain mediante un smart contract desplegado en Polygon.

## 🏗️ Arquitectura

```
Be-VIP/
├── Smart Contract (Solidity)
│   └── BeZhasRewardsCalculator.sol - Lógica de cálculo on-chain
│
├── Frontend (React + Wagmi)
│   ├── BeVIP.jsx - Página principal
│   ├── VIPSimulator.jsx - Simulador con sliders
│   ├── EarningsDisplay.jsx - Visualización de ganancias
│   ├── VIPTierSelector.jsx - Selector de nivel VIP
│   └── RewardsChart.jsx - Gráficos comparativos
│
└── Web3 Integration
    ├── config.js - Configuración de contratos
    └── BeZhasRewardsCalculator.json - ABI del contrato
```

## 💎 Características

### Smart Contract
- ✅ **100% On-Chain**: Todos los cálculos se ejecutan en blockchain
- ✅ **Transparencia Total**: Código verificable en PolygonScan
- ✅ **Gas Optimizado**: Funciones pure (sin estado) = gas mínimo
- ✅ **Inmutable**: Lógica de recompensas no puede ser modificada

### Tokenomics
**Valores de Tokens (BEZ):**
- Post: 10 BEZ
- Comentario: 3 BEZ
- Me Gusta: 1 BEZ
- Compartido: 5 BEZ
- Interacción Premium: 15 BEZ
- Referido: 50 BEZ

**Límites Diarios:**
- Posts: 10
- Comentarios: 50
- Me Gusta: 100
- Compartidos: 20
- Interacciones Premium: 5
- Referidos: 3

**Multiplicadores de Nivel (1-10):**
- Nivel 1: 100%
- Nivel 5: 140%
- Nivel 10: 300%

**Bonus por Racha:**
- 7 días: +5%
- 30 días: +10%
- 90 días: +20%

**Multiplicadores VIP:**
- Sin VIP: 100%
- VIP Bronze (1 mes): 150%
- VIP Silver (3 meses): 200%
- VIP Gold (6 meses): 250%
- VIP Diamond (9 meses): 300%

### Frontend Features
- 🎨 **UI Moderna**: Glassmorphism con Tailwind CSS
- 📊 **Gráficos Interactivos**: Chart.js con comparativas
- 🔐 **Wallet Connection**: Wagmi + Web3Modal
- ⚡ **Real-time Calculation**: Cálculo instantáneo on-chain
- 📱 **Responsive**: Adaptado a mobile, tablet y desktop
- 🌙 **Dark/Light Theme**: Respeta el tema global

## 🚀 Instalación y Setup

### 1. Instalar Dependencias

```bash
# Frontend
cd frontend
npm install chart.js react-chartjs-2

# Backend (Hardhat)
cd ..
npm install
```

### 2. Compilar Smart Contract

```bash
npx hardhat compile
```

### 3. Desplegar a Polygon (Testnet o Mainnet)

#### Opción A: Polygon Amoy (Testnet)
```bash
# Configurar .env
PRIVATE_KEY=tu_private_key_aqui
POLYGONSCAN_API_KEY=tu_api_key_aqui

# Deploy
npx hardhat run scripts/deploy-rewards-calculator.js --network polygonAmoy
```

#### Opción B: Polygon Mainnet
```bash
npx hardhat run scripts/deploy-rewards-calculator.js --network polygon
```

### 4. Verificar Contrato

```bash
npx hardhat verify --network polygonAmoy <CONTRACT_ADDRESS>
```

### 5. Actualizar Frontend

Editar `frontend/src/contracts/config.js`:

```javascript
export const REWARDS_CONTRACT = {
  address: '0xTU_DIRECCION_DEL_CONTRATO',
  chainId: 80002, // 137 para mainnet
};
```

### 6. Iniciar Aplicación

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

Abrir: http://localhost:5173/be-vip

## 📖 Uso

### Para Usuarios

1. **Conectar Wallet**
   - Click en "Connect Wallet" en el header
   - Seleccionar MetaMask, WalletConnect, etc.
   - Aprobar la conexión

2. **Configurar Acciones Diarias**
   - Ajustar sliders según tu actividad esperada
   - Posts, comentarios, likes, shares, etc.

3. **Configurar Datos de Usuario**
   - Nivel (1-10)
   - Racha de login (días consecutivos)

4. **Seleccionar Nivel VIP**
   - Estándar (gratis)
   - Bronze, Silver, Gold, Diamond

5. **Calcular Recompensas**
   - Click en "Calcular Recompensas On-Chain"
   - Esperar confirmación de blockchain
   - Ver resultados: diario, trimestral, anual

6. **Analizar Gráfico**
   - Comparar diferentes niveles VIP
   - Ver proyección a lo largo del tiempo

### Para Desarrolladores

#### Llamar al Contrato desde Frontend

```javascript
import { useContractRead } from 'wagmi';
import { REWARDS_CONTRACT } from './contracts/config';
import RewardsCalculatorABI from './contracts/BeZhasRewardsCalculator.json';

const { data, isLoading } = useContractRead({
  address: REWARDS_CONTRACT.address,
  abi: RewardsCalculatorABI.abi,
  functionName: 'calculateDailyRewards',
  args: [
    {
      posts: 5n,
      comments: 20n,
      likes: 50n,
      shares: 10n,
      premiumInteractions: 3n,
      referrals: 1n
    },
    {
      level: 5n,
      loginStreak: 15n,
      vipTier: 0n
    }
  ]
});
```

#### Llamar al Contrato desde Hardhat

```javascript
const BeZhasRewardsCalculator = await ethers.getContractAt(
  "BeZhasRewardsCalculator",
  "0xCONTRACT_ADDRESS"
);

const result = await BeZhasRewardsCalculator.calculateDailyRewards(
  { posts: 5, comments: 20, likes: 50, shares: 10, premiumInteractions: 3, referrals: 1 },
  { level: 5, loginStreak: 15, vipTier: 0 }
);

console.log("Daily Rewards:", ethers.formatEther(result.totalWithVIP), "BEZ");
```

## 🧪 Testing

### Test Manual en Frontend
1. Navegar a http://localhost:5173/be-vip
2. Conectar wallet
3. Ajustar sliders y calcular
4. Verificar que los resultados coincidan con el contrato

### Test en Hardhat Console
```bash
npx hardhat console --network polygonAmoy

const contract = await ethers.getContractAt(
  "BeZhasRewardsCalculator",
  "0xCONTRACT_ADDRESS"
);

const result = await contract.calculateDailyRewards(
  { posts: 5, comments: 20, likes: 50, shares: 10, premiumInteractions: 3, referrals: 1 },
  { level: 5, loginStreak: 15, vipTier: 9 }
);

console.log("Total VIP:", ethers.formatEther(result.totalWithVIP));
```

## 🔍 Verificación de Cálculos

### Ejemplo: Usuario Nivel 5, Sin VIP, 15 días racha

**Acciones:**
- 5 posts × 10 BEZ = 50 BEZ
- 20 comentarios × 3 BEZ = 60 BEZ
- 50 likes × 1 BEZ = 50 BEZ
- 10 shares × 5 BEZ = 50 BEZ
- 3 premium × 15 BEZ = 45 BEZ
- 1 referido × 50 BEZ = 50 BEZ

**Total Base:** 305 BEZ

**Multiplicador Nivel 5:** 140%
- 305 × 1.4 = 427 BEZ

**Bonus Racha 15 días:** +5%
- 427 × 1.05 = 448.35 BEZ

**Sin VIP (100%):**
- 448.35 × 1.0 = **448.35 BEZ/día**

**Con VIP Diamond (300%):**
- 448.35 × 3.0 = **1,345.05 BEZ/día**

**Anual (VIP Diamond):**
- 1,345.05 × 365 = **490,943.25 BEZ/año**

## 📊 Costos de Gas

| Operación | Gas Estimado | Costo (MATIC) |
|-----------|--------------|---------------|
| Deploy Contract | ~800,000 | ~0.08 MATIC |
| Calculate Rewards | ~50,000 | ~0.005 MATIC |
| Get Daily Limits | ~25,000 | ~0.0025 MATIC |
| Get Token Values | ~25,000 | ~0.0025 MATIC |

*Nota: Precios basados en 100 gwei gas price*

## 🛡️ Seguridad

- ✅ **No State Modification**: Funciones pure = sin riesgo de ataques
- ✅ **Input Validation**: Require statements en todos los límites
- ✅ **Overflow Protection**: Solidity 0.8+ built-in
- ✅ **No External Calls**: Sin dependencias externas = sin vectores de ataque

## 🐛 Troubleshooting

### Error: "Contract not deployed"
```bash
# Verificar que el contrato esté desplegado
npx hardhat run scripts/deploy-rewards-calculator.js --network polygonAmoy
```

### Error: "Wrong network"
```javascript
// Verificar chainId en config.js
export const REWARDS_CONTRACT = {
  chainId: 80002, // Amoy testnet
  // chainId: 137, // Polygon mainnet
};
```

### Error: "Insufficient funds"
```
# Obtener MATIC de testnet faucet:
https://faucet.polygon.technology/
```

### Error: "Gas estimation failed"
```javascript
// Añadir gas limit manualmente
const { data } = useContractRead({
  ...contractConfig,
  gas: 100000n
});
```

## 📚 Recursos

- [Polygon Docs](https://docs.polygon.technology/)
- [Wagmi Docs](https://wagmi.sh/)
- [Hardhat Docs](https://hardhat.org/docs)
- [Chart.js Docs](https://www.chartjs.org/docs/)
- [Solidity Docs](https://docs.soliditylang.org/)

## 🤝 Contribuciones

Para contribuir al proyecto Be-VIP:

1. Fork el repositorio
2. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -m 'Add: nueva funcionalidad'`
4. Push a la rama: `git push origin feature/nueva-funcionalidad`
5. Abrir Pull Request

## 📝 Licencia

MIT License - Ver LICENSE file para detalles

## 👥 Equipo

- **Smart Contract**: BeZhas Development Team
- **Frontend**: BeZhas UI/UX Team
- **Web3 Integration**: BeZhas Blockchain Team

## 🎉 Agradecimientos

- Polygon por la infraestructura blockchain
- OpenZeppelin por las bibliotecas de seguridad
- Wagmi team por las React hooks de Web3
- Chart.js por las visualizaciones

---

**Versión:** 1.0.0  
**Última actualización:** Enero 2025  
**Soporte:** support@bezhas.com
