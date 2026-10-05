# BeZhas Enterprise SDK

SDK completo para integración con servicios empresariales de BeZhas Platform.

## 📦 Instalación

```bash
pnpm add @bezhas/sdk
```

## 🚀 Quick Start

```javascript
import { initBeZhasSDK } from 'bezhas-enterprise-sdk';

// Inicializar SDK
const sdk = initBeZhasSDK({
  apiUrl: 'https://api.bezhas.com',
  chainId: 80002, // Amoy Testnet
  contracts: {
    marketplace: '0x...',
    token: '0x...',
    nft: '0x...'
  },
  // APIs de terceros
  maerskApiKey: process.env.MAERSK_API_KEY,
  tntApiKey: process.env.TNT_API_KEY,
  vintedApiKey: process.env.VINTED_API_KEY,
  moonpayApiKey: process.env.MOONPAY_API_KEY
});

// Usar el SDK
const price = await sdk.bezcoin.getPrice();
console.log(`BEZ Price: $${price.priceUSD}`);
```

## 📚 Módulos Disponibles

### 🚢 Maersk Logistics

Integración completa con Maersk para logística de containers.

```javascript
// Rastrear container
const tracking = await sdk.maersk.trackContainer('MAEU1234567');
console.log(`Status: ${tracking.status}`);
console.log(`Location: ${tracking.location.current}`);
console.log(`ETA: ${tracking.estimatedArrival}`);

// Reservar envío
const booking = await sdk.maersk.bookShipment({
  origin: {
    code: 'CNSHA',
    address: 'Shanghai Port, China'
  },
  destination: {
    code: 'ESBCN',
    address: 'Barcelona Port, Spain'
  },
  containerType: '40HC',
  cargo: {
    description: 'Electronics',
    weight: 25000,
    value: 50000,
    hsCode: '8517'
  },
  pickupDate: '2026-02-01',
  deliveryDate: '2026-03-01',
  incoterms: 'FOB'
});

// Obtener cotización
const quote = await sdk.maersk.getQuote({
  origin: 'CNSHA',
  destination: 'ESBCN',
  containerType: '40HC',
  weight: 25000,
  volume: 67
});
console.log(`Price: $${quote.price}`);
console.log(`Transit Time: ${quote.transitTime} days`);

// Ver horarios
const schedules = await sdk.maersk.getSchedule({
  fromPort: 'CNSHA',
  toPort: 'ESBCN',
  departureDate: '2026-02-01'
});
```

### 📦 TNT Express

Servicio de paquetería express internacional.

```javascript
// Crear envío
const shipment = await sdk.tnt.createShipment({
  sender: {
    name: 'BeZhas Store',
    company: 'BeZhas SL',
    address: 'Calle Example 123',
    city: 'Madrid',
    country: 'ES',
    postalCode: '28001',
    phone: '+34600000000',
    email: 'store@bezhas.com'
  },
  receiver: {
    name: 'John Doe',
    company: 'Tech Corp',
    address: 'Rue Example 45',
    city: 'Paris',
    country: 'FR',
    postalCode: '75001',
    phone: '+33600000000',
    email: 'john@example.com'
  },
  package: {
    weight: 2.5, // kg
    length: 40,  // cm
    width: 30,
    height: 15,
    description: 'Electronics',
    value: 299
  },
  service: 'express', // express, economy, overnight
  insurance: true
});

console.log(`Tracking: ${shipment.trackingNumber}`);
console.log(`Label: ${shipment.labelUrl}`);
console.log(`Estimated Delivery: ${shipment.estimatedDelivery}`);

// Rastrear paquete
const tracking = await sdk.tnt.trackPackage('TNT123456789');
console.log(`Status: ${tracking.status}`);
console.log(`Location: ${tracking.location}`);
console.log(`Delivered: ${tracking.delivered}`);

// Generar etiqueta
const label = await sdk.tnt.generateLabel('SHIPMENT-123');
console.log(`Label URL: ${label.labelUrl}`);
```

### 👕 Vinted Integration

Integración con Vinted para venta automática y gestión de inventario.

```javascript
// Publicar artículo
const item = await sdk.vinted.listItem({
  title: 'Designer Jacket - Size M',
  description: 'Brand new designer jacket, never worn',
  price: 85,
  currency: 'EUR',
  category: 'jackets',
  brand: 'Zara',
  size: 'M',
  condition: 'new',
  color: 'black',
  photos: [
    'https://example.com/photo1.jpg',
    'https://example.com/photo2.jpg'
  ],
  shipping: {
    method: 'custom',
    price: 5
  },
  autoAcceptEnabled: false,
  bezhasIntegration: true
});

console.log(`Vinted URL: ${item.vintedUrl}`);
console.log(`BeZhas ID: ${item.bezhasId}`);

// Sincronizar inventario
const sync = await sdk.vinted.syncInventory();
console.log(`Items synced: ${sync.itemsSynced}`);
console.log(`New items: ${sync.newItems}`);
console.log(`Sold items: ${sync.soldItems}`);

// Procesar venta con envío automático
const sale = await sdk.vinted.handleSale({
  saleId: 'VINTED-12345',
  autoShip: true,
  generateLabel: true,
  notifyBuyer: true
});

console.log(`Order ID: ${sale.orderId}`);
console.log(`Tracking: ${sale.trackingNumber}`);
console.log(`Label: ${sale.labelUrl}`);

// Configurar envío automático
await sdk.vinted.configureAutoShipping({
  enabled: true,
  defaultCarrier: 'tnt',
  autoGenerateLabel: true,
  autoNotifyBuyer: true,
  defaultPackaging: 'envelope',
  insuranceDefault: true
});
```

### 💎 Sistema VIP

Sistema completo de membresías con beneficios exclusivos.

```javascript
// Suscribirse
const subscription = await sdk.vip.subscribe({
  tier: 'gold', // bronze, silver, gold, platinum
  duration: 12, // meses
  paymentMethod: 'stripe',
  autoRenew: true
});

console.log(`Subscription ID: ${subscription.subscriptionId}`);
console.log(`NFT Badge: ${subscription.nftBadgeId}`);

// Ver beneficios
const benefits = await sdk.vip.getBenefits('platinum');
console.log(`Discount: ${benefits.discount}%`);
console.log(`Shipping Discount: ${benefits.shippingDiscount}%`);
console.log(`Free Shipping: ${benefits.freeShipping}`);
console.log(`BEZ Bonus: ${benefits.nftBonus}%`);
console.log(benefits.features);

// Estado actual
const status = await sdk.vip.getStatus();
console.log(`Tier: ${status.tier}`);
console.log(`Active: ${status.isActive}`);
console.log(`Total Savings: €${status.totalSavings}`);
console.log(`NFT Badge: ${status.nftBadge}`);

// Mejorar nivel
await sdk.vip.upgrade('platinum');

// Ver ahorros
const savings = await sdk.vip.getSavingsHistory();
console.log(`Total Saved: €${savings.totalSavings}`);
console.log('Monthly Breakdown:', savings.monthlyBreakdown);
console.log('By Category:', savings.byCategory);

// Reclamar recompensas
const rewards = await sdk.vip.claimRewards();
console.log(`BEZ Coins: ${rewards.bezCoins}`);
console.log('NFTs:', rewards.nfts);
```

### 💰 BEZ-Coin con MoonPay

Compra, intercambio y staking de BEZ-Coin.

```javascript
// Comprar con MoonPay (Fiat)
const purchase = await sdk.bezcoin.buyWithMoonPay({
  amount: 100, // USD
  currency: 'USD',
  paymentMethod: 'credit_card',
  returnUrl: 'https://bezhas.com/success'
});

// Redirigir al usuario
window.location.href = purchase.moonpayUrl;

console.log(`BEZ Amount: ${purchase.bezAmount}`);
console.log(`Bonus: ${purchase.bonusAmount}`);
console.log(`Total: ${purchase.totalBez}`);

// Comprar con Stripe
const stripePurchase = await sdk.bezcoin.buyWithStripe({
  amount: 100,
  currency: 'USD'
});

window.location.href = stripePurchase.checkoutUrl;

// Intercambiar crypto
const swap = await sdk.bezcoin.swap({
  fromToken: 'USDT',
  amount: 500,
  slippage: 0.5,
  deadline: 20
});

console.log(`Received: ${swap.amountOut} BEZ`);
console.log(`Price Impact: ${swap.priceImpact}%`);

// Ver precio
const price = await sdk.bezcoin.getPrice();
console.log(`Price: $${price.priceUSD}`);
console.log(`24h Change: ${price.change24h}%`);
console.log(`Volume: $${price.volume24h}`);
console.log(`Market Cap: $${price.marketCap}`);

// Historial de precios
const history = await sdk.bezcoin.getPriceHistory('24h');
console.log('Price History:', history.prices);
console.log(`High: $${history.high}`);
console.log(`Low: $${history.low}`);

// Staking
const stake = await sdk.bezcoin.stake(10000, 365);
console.log(`Stake ID: ${stake.stakeId}`);
console.log(`APY: ${stake.apy}%`);
console.log(`End Date: ${stake.endDate}`);
console.log(`Estimated Rewards: ${stake.estimatedRewards} BEZ`);

// Ver recompensas
const rewards = await sdk.bezcoin.getStakingRewards();
console.log(`Total Staked: ${rewards.totalStaked} BEZ`);
console.log(`Total Rewards: ${rewards.totalRewards} BEZ`);
console.log(`Claimable: ${rewards.claimableRewards} BEZ`);

// Transferir
const transfer = await sdk.bezcoin.transfer(
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  1000
);

console.log(`TX Hash: ${transfer.txHash}`);
```

## 🔧 Configuración Avanzada

```javascript
const sdk = initBeZhasSDK({
  // API Base
  apiUrl: 'https://api.bezhas.com',
  apiKey: 'your-api-key',
  
  // Blockchain
  chainId: 80002,
  rpcUrl: 'https://rpc-amoy.polygon.technology',
  
  // Contratos
  contracts: {
    marketplace: '0x...',
    token: '0x...',
    nft: '0x...',
    staking: '0x...'
  },
  
  // APIs Externas
  maerskApiKey: process.env.MAERSK_API_KEY,
  tntApiKey: process.env.TNT_API_KEY,
  vintedApiKey: process.env.VINTED_API_KEY,
  moonpayApiKey: process.env.MOONPAY_API_KEY,
  
  // IPFS
  ipfs: {
    gateway: 'https://ipfs.io/ipfs/',
    pinata: {
      apiKey: process.env.PINATA_API_KEY,
      secretKey: process.env.PINATA_SECRET_KEY
    }
  },
  
  // Cache
  cache: {
    enabled: true,
    ttl: 300 // 5 minutos
  },
  
  // Logging
  logger: {
    level: 'info',
    prefix: '[BeZhas SDK]'
  }
});
```

## 🎯 Casos de Uso

### E-commerce con Envío Automático

```javascript
// 1. Cliente compra producto
const order = await createOrder({ productId: 123, quantity: 1 });

// 2. Aplicar descuento VIP
const vip = await sdk.vip.getStatus();
const discount = vip.benefits?.discount || 0;
const finalPrice = order.price * (1 - discount / 100);

// 3. Procesar pago con BEZ-Coin
await processPayment({ amount: finalPrice, currency: 'BEZ' });

// 4. Crear envío automático con TNT
const shipment = await sdk.tnt.createShipment({
  sender: store.address,
  receiver: order.shippingAddress,
  package: order.packageDetails,
  service: 'express'
});

// 5. Notificar al cliente
await notifyCustomer({
  orderId: order.id,
  trackingNumber: shipment.trackingNumber,
  estimatedDelivery: shipment.estimatedDelivery
});
```

### Venta Multi-Plataforma

```javascript
// Publicar en múltiples marketplaces
const item = {
  title: 'Designer Jacket',
  price: 85,
  photos: ['photo1.jpg', 'photo2.jpg']
};

// Vinted
await sdk.vinted.listItem(item);

// BeZhas Marketplace
await sdk.marketplace.listItem(item);

// Sincronizar inventario
setInterval(async () => {
  await sdk.vinted.syncInventory();
}, 3600000); // cada hora
```

### Container Tracking Dashboard

```javascript
// Monitorear múltiples containers
const containers = ['MAEU1234567', 'MAEU1234568', 'MAEU1234569'];

const trackAll = async () => {
  const trackingData = await Promise.all(
    containers.map(c => sdk.maersk.trackContainer(c))
  );
  
  trackingData.forEach((data, i) => {
    console.log(`Container ${containers[i]}:`);
    console.log(`  Status: ${data.status}`);
    console.log(`  Location: ${data.location.current}`);
    console.log(`  ETA: ${data.estimatedArrival}`);
  });
};

// Actualizar cada 6 horas
setInterval(trackAll, 6 * 60 * 60 * 1000);
```

## 🔐 Seguridad

- ✅ Todas las keys se almacenan en variables de entorno
- ✅ Validación de firmas en webhooks
- ✅ Rate limiting implementado
- ✅ HTTPS obligatorio en producción
- ✅ Tokens JWT para autenticación

## 📊 Manejo de Errores

```javascript
try {
  const result = await sdk.bezcoin.buyWithMoonPay({ amount: 100 });
  if (!result.success) {
    console.error(`Error: ${result.error}`);
    // Manejar error
  }
} catch (error) {
  console.error('SDK Error:', error);
  // Fallback o retry
}
```

## 🧪 Testing

```javascript
// Configurar SDK para testing
const sdk = initBeZhasSDK({
  apiUrl: 'http://localhost:3001',
  chainId: 80002, // Amoy testnet
  // ... otras opciones
});

// Usar datos de prueba
await sdk.maersk.trackContainer('TEST-CONTAINER-123');
```

## 📝 Licencia

MIT

## 🤝 Soporte

- Documentación: https://docs.bezhas.com
- Email: info.bezcoin@bezhas.com
- Discord: https://discord.gg/bezhas
- GitHub: https://github.com/bezhas/bezhas-sdk

## 🚀 Roadmap

- [ ] Integración con más carriers (DHL, FedEx, UPS)
- [ ] Soporte para más marketplaces (eBay, Amazon)
- [ ] APIs de hoteles (Marriott, Hilton, Barceló)
- [ ] Sistema de recompensas gamificado
- [ ] Dashboard analytics
- [ ] Mobile SDK (React Native)

---

**Version:** 2.0.0
**Last Updated:** 4 de Enero 2026
