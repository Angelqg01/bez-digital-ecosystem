# 🌙 MoonPay Integration - BeZhas Platform

## 📋 Resumen

Integración completa de **MoonPay** en BeZhas para permitir la compra y venta de criptomonedas directamente desde la plataforma usando dinero fiat (tarjetas, bancos, PayPal, etc.).

---

## 🎯 Características Implementadas

### ✅ Frontend (React)

1. **Servicio MoonPay** (`moonpay.service.js`)
   - `buildBuyUrl()` - Genera URL para comprar crypto
   - `buildSellUrl()` - Genera URL para vender crypto
   - `buildNFTUrl()` - Genera URL para comprar NFTs
   - `openMoonPayPopup()` - Abre widget en ventana popup
   - Soporte para 10+ criptomonedas (ETH, BTC, MATIC, USDC, etc.)
   - Soporte para 8+ monedas fiat (USD, EUR, GBP, etc.)

2. **Componente Modal** (`MoonPayModal.jsx`)
   - Modal interactivo con selección de crypto y fiat
   - Configuración de cantidad (opcional)
   - Email pre-llenado (opcional)
   - Integración con wallet conectada
   - Apertura en ventana popup
   - Toast notifications

3. **Botones de Acceso Rápido** (`MoonPayQuickActions.jsx`)
   - Botón "Comprar Crypto" (verde)
   - Botón "Vender Crypto" (naranja)
   - Integrado en página de perfil

4. **Integración en Profile**
   - Sección "Acciones Rápidas" con MoonPay
   - Acceso directo desde Overview tab

### ✅ Backend (Node.js/Express)

1. **Rutas API** (`moonpay.routes.js`)
   - `GET /api/moonpay/transaction/:id` - Obtener estado de transacción
   - `GET /api/moonpay/transactions` - Listar transacciones del usuario
   - `POST /api/moonpay/webhook` - Recibir notificaciones de MoonPay
   - `GET /api/moonpay/currencies` - Listar cryptos soportadas
   - Autenticación con JWT
   - Validación de parámetros

2. **Variables de Entorno**
   ```env
   # Frontend (.env)
   VITE_MOONPAY_API_KEY_TEST=pk_test_demo
   VITE_MOONPAY_API_KEY_LIVE=
   VITE_MOONPAY_ENVIRONMENT=sandbox
   
   # Backend (.env)
   MOONPAY_SECRET_KEY=
   ```

---

## 🔧 Configuración

### 1. Obtener API Keys de MoonPay

1. Registrarse en [MoonPay Dashboard](https://dashboard.moonpay.com/signup)
2. Verificar cuenta (KYC)
3. Obtener API Keys:
   - **Test (Sandbox)**: `pk_test_xxxxx` / `sk_test_xxxxx`
   - **Live (Production)**: `pk_live_xxxxx` / `sk_live_xxxxx`

### 2. Configurar Frontend

Editar `frontend/.env`:

```env
VITE_MOONPAY_API_KEY_TEST=pk_test_tu_clave_aqui
VITE_MOONPAY_API_KEY_LIVE=pk_live_tu_clave_aqui
VITE_MOONPAY_ENVIRONMENT=sandbox  # o 'production'
```

### 3. Configurar Backend

Editar `backend/.env`:

```env
MOONPAY_SECRET_KEY=sk_test_tu_clave_secreta
```

### 4. Configurar Webhooks (Opcional)

En MoonPay Dashboard:
1. Settings → Webhooks
2. URL: `https://tu-dominio.com/api/moonpay/webhook`
3. Events: `transaction_created`, `transaction_updated`, `transaction_completed`, `transaction_failed`

---

## 💻 Uso

### Para Usuarios

1. **Conectar Wallet**
   - Ir a perfil
   - Conectar MetaMask u otra wallet

2. **Comprar Crypto**
   - Click en "Comprar Crypto" (botón verde)
   - Seleccionar cryptocurrency (ETH, MATIC, etc.)
   - Seleccionar moneda fiat (USD, EUR, etc.)
   - Ingresar cantidad (opcional)
   - Click "Comprar con MoonPay"
   - Completar pago en ventana popup

3. **Vender Crypto**
   - Click en "Vender Crypto" (botón naranja)
   - Seleccionar crypto a vender
   - Seleccionar moneda a recibir
   - Completar en MoonPay

### Para Desarrolladores

#### Abrir MoonPay programáticamente

```javascript
import { buildBuyUrl, openMoonPayPopup } from '../services/moonpay.service';
import { useWeb3 } from '../context/Web3Context';

const MyComponent = () => {
  const { address } = useWeb3();

  const handleBuy = () => {
    const url = buildBuyUrl({
      currencyCode: 'eth',
      walletAddress: address,
      baseCurrencyCode: 'usd',
      baseCurrencyAmount: '100',
      email: 'user@example.com',
      colorCode: '#7C3AED',
    });

    openMoonPayPopup(url, {
      width: 450,
      height: 700,
      onClose: () => {
        console.log('MoonPay cerrado');
      }
    });
  };

  return <button onClick={handleBuy}>Comprar ETH</button>;
};
```

#### Usar componente modal

```javascript
import MoonPayModal from '../components/moonpay/MoonPayModal';

const MyPage = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Comprar Crypto
      </button>

      <MoonPayModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        mode="buy"  // o 'sell'
        initialCurrency="eth"
      />
    </>
  );
};
```

#### Verificar transacción desde backend

```javascript
// Frontend
const checkTransaction = async (txId) => {
  const response = await fetch(`/api/moonpay/transaction/${txId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  console.log('Transaction status:', data.transaction.status);
};
```

---

## 🌐 Cryptos Soportadas

| Código | Nombre | Símbolo |
|--------|--------|---------|
| `eth` | Ethereum | ETH |
| `btc` | Bitcoin | BTC |
| `matic` | Polygon | MATIC |
| `usdc` | USD Coin | USDC |
| `usdt` | Tether | USDT |
| `sol` | Solana | SOL |
| `ada` | Cardano | ADA |
| `dot` | Polkadot | DOT |
| `avax` | Avalanche | AVAX |
| `link` | Chainlink | LINK |

---

## 💰 Monedas Fiat Soportadas

| Código | Nombre | Símbolo |
|--------|--------|---------|
| `usd` | US Dollar | $ |
| `eur` | Euro | € |
| `gbp` | British Pound | £ |
| `cad` | Canadian Dollar | CA$ |
| `aud` | Australian Dollar | A$ |
| `jpy` | Japanese Yen | ¥ |
| `mxn` | Mexican Peso | MX$ |
| `brl` | Brazilian Real | R$ |

---

## 📊 Flujos de Transacción

### Compra (Buy)

```
1. Usuario → Click "Comprar Crypto"
2. BeZhas → Genera URL MoonPay con parámetros
3. MoonPay → Abre en popup
4. Usuario → Completa KYC (primera vez)
5. Usuario → Ingresa datos de pago
6. MoonPay → Procesa pago
7. MoonPay → Envía crypto a wallet
8. MoonPay → Notifica a BeZhas (webhook)
9. BeZhas → Actualiza balance/notifica usuario
```

### Venta (Sell)

```
1. Usuario → Click "Vender Crypto"
2. Usuario → Envía crypto a dirección de MoonPay
3. MoonPay → Recibe confirmación blockchain
4. MoonPay → Convierte a fiat
5. MoonPay → Envía dinero a cuenta bancaria/tarjeta
6. MoonPay → Notifica a BeZhas (webhook)
```

---

## 🔒 Seguridad

- ✅ No almacenamos información de pago (manejado por MoonPay)
- ✅ KYC manejado por MoonPay (compliance)
- ✅ Webhook signature verification (implementar)
- ✅ JWT authentication en endpoints backend
- ✅ Validación de wallet addresses
- ✅ HTTPS requerido en producción

---

## 💵 Comisiones

- **MoonPay Fee**: ~1% - 4.5% por transacción
- **Network Fees**: Variables según blockchain
- **Total**: Usuario ve costo total antes de confirmar

---

## 🧪 Testing

### Modo Sandbox

1. Configurar `VITE_MOONPAY_ENVIRONMENT=sandbox`
2. Usar `pk_test_xxxxx` API key
3. Datos de prueba:
   - **Email**: test@moonpay.com
   - **Card**: 4000 0000 0000 0077
   - **CVV**: 123
   - **Expiry**: 12/25

### Tarjetas de Prueba

| Número | Resultado |
|--------|-----------|
| 4000000000000077 | Éxito |
| 4000000000000002 | Rechazada |
| 4000000000000010 | Requiere 3DS |

---

## 🚀 Deployment

### Frontend

1. Cambiar a production:
   ```env
   VITE_MOONPAY_ENVIRONMENT=production
   VITE_MOONPAY_API_KEY_LIVE=pk_live_xxxxx
   ```

2. Build:
   ```bash
   npm run build
   ```

### Backend

1. Configurar secret key:
   ```env
   MOONPAY_SECRET_KEY=sk_live_xxxxx
   ```

2. Configurar webhook URL en MoonPay Dashboard

3. Reiniciar servidor

---

## 📱 Capturas de Pantalla

### Botones en Profile
![MoonPay Buttons](ubicados en sección "Acciones Rápidas")

### Modal de Compra
![Buy Modal](modal interactivo con selección de crypto y fiat)

### Widget MoonPay
![MoonPay Widget](popup con interfaz de pago)

---

## 🔗 Enlaces Útiles

- [MoonPay Docs](https://dev.moonpay.com/docs)
- [API Reference](https://dev.moonpay.com/reference)
- [Dashboard](https://dashboard.moonpay.com)
- [Webhook Guide](https://dev.moonpay.com/docs/webhooks)
- [Sandbox Testing](https://dev.moonpay.com/docs/faq-sandbox-testing)

---

## ⚠️ Limitaciones Actuales

1. **Sin webhook signature verification** - Implementar para producción
2. **Sin historial de transacciones en UI** - Agregar en futuro
3. **Sin notificaciones push** - Solo toasts
4. **Solo popup window** - No iframe embebido

---

## 🔮 Mejoras Futuras

- [ ] Historial de transacciones en profile
- [ ] Notificaciones push para estado de transacciones
- [ ] Integración con sistema de rewards
- [ ] Compra directa de tokens BEZ custom
- [ ] Límites de compra personalizados
- [ ] Descuentos por volumen
- [ ] Referral program

---

## 🐛 Troubleshooting

### Popup bloqueado

**Problema**: El navegador bloquea la ventana popup

**Solución**: 
```javascript
// Usuario debe permitir popups en configuración del navegador
// O hacer click en el botón directamente (no desde console)
```

### API Key inválida

**Problema**: "Invalid API key"

**Solución**:
1. Verificar que la key empiece con `pk_test_` o `pk_live_`
2. Verificar que esté en `.env` correcto
3. Reiniciar servidor de desarrollo

### Wallet no conectada

**Problema**: "Conecta tu Wallet primero"

**Solución**:
1. Click en "Connect Wallet" en header
2. Aprobar conexión en MetaMask
3. Refrescar página si es necesario

---

## 📞 Soporte

Para soporte de MoonPay:
- Email: support@moonpay.com
- Discord: [MoonPay Community](https://discord.gg/moonpay)
- Docs: https://dev.moonpay.com

---

**Implementado por**: BeZhas Development Team  
**Fecha**: Noviembre 2025  
**Versión**: 1.0.0
