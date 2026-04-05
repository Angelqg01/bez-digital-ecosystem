# 🎯 Guía Rápida de Decisión - Integración BezCoin

## 📌 ¿Qué Patrón Usar en Mi Página?

Esta guía te ayuda a decidir **en 30 segundos** qué patrón de integración BezCoin necesitas.

---

## 🔍 Diagrama de Decisión

```
¿Tu página realiza transacciones con BEZ?
    │
    ├─ NO → ¿Solo necesitas mostrar el balance?
    │       │
    │       ├─ SÍ → 📊 PATRÓN 1: Balance Display
    │       │       Ejemplos: Header, Dashboard, Stats
    │       │
    │       └─ NO → ❌ No necesitas integración BezCoin
    │
    └─ SÍ → ¿Qué tipo de transacción?
            │
            ├─ Compras de Items/NFTs/Servicios
            │   → 🛍️ PATRÓN 2: Compras con Verificación
            │      Ejemplos: Marketplace, Shop, VIP
            │
            ├─ Envío de Tokens (Donaciones/Propinas)
            │   → 💝 PATRÓN 3: Donaciones y Propinas
            │      Ejemplos: ProfileView, Feed, Groups
            │
            └─ Mostrar Historial de Transacciones
                → 📜 PATRÓN 4: Transaction History
                   Ejemplos: Wallet, Rewards, Activity
```

---

## 📊 PATRÓN 1: Balance Display (Solo Lectura)

### ✅ Úsalo cuando:
- Solo necesitas **mostrar** el balance del usuario
- No hay transacciones en la página
- Quieres dar acceso rápido al botón "Comprar BEZ"
- Es una página informativa o de navegación

### 📄 Páginas Implementadas:
- ✅ Header.jsx
- ✅ ShopPage.jsx (header)
- ✅ RewardsPage.jsx (header)
- ✅ BeZhasFeed.jsx (header)

### 💻 Código Base:
```jsx
import { FaCoins } from 'react-icons/fa';
import { useBezCoin } from '../context/BezCoinContext';

const { balance, setShowBuyModal } = useBezCoin();

// Versión mínima
<div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg">
  <FaCoins className="text-yellow-300" size={18} />
  <span className="font-bold">{parseFloat(balance).toFixed(2)} BEZ</span>
</div>
```

### 📏 Complejidad: **Baja** (5 líneas)
### ⏱️ Tiempo de implementación: **5 minutos**

---

## 🛍️ PATRÓN 2: Compras con Verificación

### ✅ Úsalo cuando:
- Usuario **compra** items, NFTs, servicios, suscripciones
- Necesitas **verificar balance** antes de la transacción
- Quieres **flujo automático** si balance es insuficiente
- La acción tiene un **costo específico** en BEZ

### 📄 Páginas Implementadas:
- ✅ MarketplacePage.jsx (compra NFTs)
- ✅ BeVIP.jsx (suscripciones VIP)

### 💻 Código Base:
```jsx
import { useBezCoin } from '../context/BezCoinContext';
import BuyBezCoinModal from '../components/modals/BuyBezCoinModal';
import InsufficientFundsModal from '../components/modals/InsufficientFundsModal';

const { 
  balance, 
  verifyAndProceed, 
  showBuyModal, 
  setShowBuyModal, 
  insufficientFundsModal, 
  setInsufficientFundsModal 
} = useBezCoin();

const handlePurchase = async (item) => {
  await verifyAndProceed(
    item.price,                    // Precio del item
    `Comprar ${item.name}`,        // Nombre de la acción
    async () => {
      // Tu lógica de compra
      await executePurchase(item);
      toast.success('¡Compra exitosa!');
    }
  );
};

// Al final del componente
<BuyBezCoinModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
<InsufficientFundsModal {...insufficientFundsModal} />
```

### 📏 Complejidad: **Media** (50 líneas)
### ⏱️ Tiempo de implementación: **20 minutos**

### 🎯 Casos de Uso:
- ✅ Comprar NFTs en Marketplace
- ✅ Activar suscripción VIP
- ✅ Comprar items en Shop
- ✅ Pagar por servicios premium
- ✅ Desbloquear contenido exclusivo

---

## 💝 PATRÓN 3: Donaciones y Propinas

### ✅ Úsalo cuando:
- Usuario **envía** BEZ a otro usuario
- Es una transacción **peer-to-peer**
- Puede incluir un **mensaje opcional**
- No hay un "producto" específico, solo transferencia

### 📄 Páginas Implementadas:
- ✅ ProfileView.jsx (donaciones)
- ✅ BeZhasFeed.jsx (propinas en posts)

### 💻 Código Base:
```jsx
import { useBezCoin } from '../context/BezCoinContext';
import BuyBezCoinModal from '../components/modals/BuyBezCoinModal';
import InsufficientFundsModal from '../components/modals/InsufficientFundsModal';
import { FaHeart } from 'react-icons/fa';

const { 
  balance, 
  donate, 
  showBuyModal, 
  setShowBuyModal, 
  insufficientFundsModal, 
  setInsufficientFundsModal 
} = useBezCoin();

const [showDonateModal, setShowDonateModal] = useState(false);
const [amount, setAmount] = useState('');
const [message, setMessage] = useState('');

const handleDonate = async () => {
  const success = await donate(
    recipientAddress,
    amount,
    message || 'Donación'
  );

  if (success) {
    toast.success(`¡${amount} BEZ enviados!`, { icon: '💝' });
    setShowDonateModal(false);
  }
};

// Botón principal
<button onClick={() => setShowDonateModal(true)}>
  <FaHeart /> Donar BEZ
</button>

// Modal personalizado (ver ProfileView.jsx)
// Incluir BuyBezCoinModal e InsufficientFundsModal
```

### 📏 Complejidad: **Media-Alta** (150 líneas)
### ⏱️ Tiempo de implementación: **45 minutos**

### 🎯 Casos de Uso:
- ✅ Donar a creadores de contenido
- ✅ Propinas en posts/publicaciones
- ✅ Apoyar grupos/comunidades
- ✅ Enviar gifts a amigos
- ✅ Recompensar contribuciones

---

## 📜 PATRÓN 4: Transaction History

### ✅ Úsalo cuando:
- Necesitas mostrar **historial** de transacciones
- Usuario quiere ver **todas sus operaciones**
- Página de actividad, wallet, o rewards
- Necesitas **filtros** y **exportación**

### 📄 Páginas Implementadas:
- ✅ RewardsPage.jsx (con toggle)

### 💻 Código Base:
```jsx
import TransactionHistory from '../components/bezcoin/TransactionHistory';
import { FaHistory } from 'react-icons/fa';

const [showHistory, setShowHistory] = useState(false);

// Botón toggle
<button onClick={() => setShowHistory(!showHistory)}>
  <FaHistory /> {showHistory ? 'Ocultar' : 'Ver'} Historial
</button>

// Componente
{showHistory && (
  <div className="bg-white rounded-lg p-6">
    <h2>Historial de Transacciones</h2>
    <TransactionHistory />
  </div>
)}
```

### 📏 Complejidad: **Baja** (10 líneas)
### ⏱️ Tiempo de implementación: **5 minutos**

### 🎯 Casos de Uso:
- ✅ Página de Wallet (hub principal)
- ✅ Página de Rewards
- ✅ Panel de actividad
- ✅ Dashboard de usuario

---

## 🎨 Combinaciones de Patrones

### Página Completa = Balance + Acción + Modales

| Página | Patrón 1 | Patrón 2 | Patrón 3 | Patrón 4 |
|--------|----------|----------|----------|----------|
| **Header** | ✅ | ❌ | ❌ | ❌ |
| **ProfileView** | ✅ | ❌ | ✅ | ❌ |
| **Marketplace** | ✅ | ✅ | ❌ | ❌ |
| **ShopPage** | ✅ | 🔄 | ❌ | ❌ |
| **RewardsPage** | ✅ | ❌ | ❌ | ✅ |
| **BeZhasFeed** | ✅ | ❌ | ✅ | ❌ |
| **WalletPage** | ✅ | ❌ | ✅ | ✅ |

**Leyenda:**
- ✅ = Implementado
- 🔄 = Recomendado (delegado a componente hijo)
- ❌ = No aplicable

---

## 🚀 Flujo de Implementación Rápida

### Para Páginas Nuevas (15 minutos)

```bash
# 1. Identifica el patrón (usar diagrama arriba) → 1 min
# 2. Copia el código base del patrón → 2 min
# 3. Ajusta nombres/textos específicos → 3 min
# 4. Implementa la lógica de acción → 5 min
# 5. Agrega los modales si necesarios → 2 min
# 6. Test en navegador → 2 min
```

---

## 📋 Checklist de Integración

### ✅ Imports
```jsx
import { useBezCoin } from '../context/BezCoinContext';
import { FaCoins } from 'react-icons/fa';
// + BuyBezCoinModal si necesario
// + InsufficientFundsModal si necesario
```

### ✅ Hook
```jsx
const { balance, /* otras funciones según patrón */ } = useBezCoin();
```

### ✅ UI Balance
```jsx
<div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg">
  <FaCoins className="text-yellow-300" size={18} />
  <span className="font-bold">{parseFloat(balance).toFixed(2)} BEZ</span>
</div>
```

### ✅ Handler (si aplica)
```jsx
const handleAction = async () => {
  // verifyAndProceed() para compras
  // donate() para donaciones
};
```

### ✅ Modales (si aplica)
```jsx
<BuyBezCoinModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
<InsufficientFundsModal {...insufficientFundsModal} />
```

---

## 🎯 Ejemplos Rápidos por Tipo de Página

### 📊 Página de Estadísticas/Dashboard
```jsx
// SOLO PATRÓN 1: Balance Display
const { balance } = useBezCoin();
// Mostrar balance + botón comprar
```

### 🛒 Página de Compras (E-commerce)
```jsx
// PATRÓN 1 + PATRÓN 2
const { balance, verifyAndProceed, ...modals } = useBezCoin();
// Balance en header + verifyAndProceed en cada compra
```

### 👤 Página de Perfil
```jsx
// PATRÓN 1 + PATRÓN 3
const { balance, donate, ...modals } = useBezCoin();
// Balance visible + modal de donación
```

### 💰 Página de Wallet
```jsx
// PATRÓN 1 + PATRÓN 3 + PATRÓN 4
const { balance, donate, ...modals } = useBezCoin();
// Balance prominente + enviar tokens + historial completo
```

### 📱 Feed Social
```jsx
// PATRÓN 1 + PATRÓN 3
const { balance, donate, ...modals } = useBezCoin();
// Balance en header + propinas en cada post
```

---

## 🔥 Tips de Optimización

### 1. **Reutiliza el Balance Display**
Crea un componente si usas el mismo diseño en múltiples lugares:

```jsx
// components/BezBalanceDisplay.jsx
export default function BezBalanceDisplay({ size = 'md' }) {
  const { balance } = useBezCoin();
  
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-3 text-lg'
  };
  
  return (
    <div className={`flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg ${sizeClasses[size]}`}>
      <FaCoins className="text-yellow-300" />
      <span className="font-bold">{parseFloat(balance).toFixed(2)} BEZ</span>
    </div>
  );
}

// Uso
<BezBalanceDisplay size="md" />
```

### 2. **Centraliza los Precios**
```jsx
// constants/prices.js
export const PRICES = {
  VIP_1_MONTH: '50',
  VIP_3_MONTHS: '120',
  NFT_MINT: '25',
  POST_BOOST: '10',
  GROUP_CREATE: '100'
};

// Uso
await verifyAndProceed(PRICES.VIP_1_MONTH, 'Activar VIP', ...);
```

### 3. **Handlers Reutilizables**
```jsx
// hooks/useBezActions.js
export function useBezActions() {
  const { verifyAndProceed, donate } = useBezCoin();
  
  const purchaseItem = async (item) => {
    return verifyAndProceed(item.price, `Comprar ${item.name}`, async () => {
      await buyItemAPI(item.id);
      toast.success(`${item.name} comprado!`);
    });
  };
  
  const tipUser = async (user, amount) => {
    return donate(user.address, amount, `Propina para ${user.name}`);
  };
  
  return { purchaseItem, tipUser };
}
```

---

## 📊 Tabla de Decisión Final

| Necesidad | Patrón | Tiempo | Complejidad | Líneas |
|-----------|--------|--------|-------------|--------|
| Solo mostrar balance | Patrón 1 | 5 min | Baja | 5 |
| Comprar items/servicios | Patrón 2 | 20 min | Media | 50 |
| Donar/propinas | Patrón 3 | 45 min | Media-Alta | 150 |
| Ver historial | Patrón 4 | 5 min | Baja | 10 |
| Página completa (Wallet) | 1+3+4 | 60 min | Alta | 200 |

---

## 🎓 Recursos Adicionales

- **BEZCOIN-INTEGRATION-COMPLETE.md** → Guía completa con todos los detalles
- **BEZCOIN-INTEGRATION-EXAMPLES.md** → 5 ejemplos completos paso a paso
- **BEZCOIN-COMPLETE-SYSTEM-OPTIMIZED.md** → Visión general del sistema

---

## ✅ ¿Listo para Implementar?

### Pregúntate:

1. **¿Qué hace mi página?**
   - Muestra info → Patrón 1
   - Vende/compra → Patrón 2
   - Envía tokens → Patrón 3
   - Muestra historial → Patrón 4

2. **¿Cuánto tiempo tengo?**
   - 5 min → Patrón 1 o 4
   - 20 min → Patrón 2
   - 45 min → Patrón 3
   - 60+ min → Combinación

3. **¿Necesito ayuda?**
   - Consulta los ejemplos completos en `BEZCOIN-INTEGRATION-EXAMPLES.md`
   - Revisa las páginas ya implementadas
   - Copia y adapta el código base de arriba

---

## 🚀 ¡A Implementar!

**Recuerda:** El sistema BezCoin ya está funcionando al 100%. Solo necesitas:
1. Elegir el patrón correcto
2. Copiar el código base
3. Personalizar para tu página
4. Agregar los modales
5. ¡Listo!

**Tiempo promedio:** 15-45 minutos por página  
**Complejidad:** Baja a Media (código ya probado y documentado)  
**Resultado:** Funcionalidad completa de tokens en tu página ✨
