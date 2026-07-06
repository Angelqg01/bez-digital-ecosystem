# 🎯 Casos de Uso Reales — Ejemplos de Código

**Guía práctica con ejemplos listos para copiar/pegar**

---

## 📑 Casos de Uso por Industria

### 🚢 CASO 1: Tienda Online Europea (WooCommerce)

**Necesidad:** Vender online con pagos en EUR + tracking de envíos.

**Solución:** Plugin WordPress + CargoLink API

**Paso 1: Instalar Plugin**
```bash
# Descargar bezhas-hub-v2.0.0.zip
# WordPress → Plugins → Upload → Activate
```

**Paso 2: Configurar en Admin**
```
Settings → BeZhas Configuration
  API Key: [tu_key_aqui]
  Webhook Secret: [tu_secret]
  Payment Methods: Bank, Card, Crypto
```

**Paso 3: Código de Integración (PHP)**
```php
<?php
// functions.php o plugin.php

// Hook cuando se completa el pago en WooCommerce
add_action('woocommerce_payment_complete', function($order_id) {
    $order = wc_get_order($order_id);
    
    // Obtener datos de envío
    $address = $order->get_shipping_address_1();
    $city = $order->get_shipping_city();
    
    // Llamar API para crear transacción de cargo
    $curl = curl_init();
    curl_setopt_array($curl, [
        CURLOPT_URL => 'https://api.bez.digital:3001/api/cargolink/transactions',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'x-api-key: ' . get_option('bezhas_api_key'),
            'Content-Type: application/json'
        ],
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'posRef' => $order->get_order_number(),
            'origin' => get_option('woocommerce_store_city'),
            'destination' => $city,
            'items' => array_map(function($item) {
                return [
                    'sku' => $item->get_product_id(),
                    'quantity' => $item->get_quantity(),
                    'weight' => $item->get_product()->get_weight()
                ];
            }, $order->get_items())
        ])
    ]);
    
    $response = curl_exec($curl);
    $result = json_decode($response, true);
    
    if ($result['txId']) {
        // Guardar ID de transacción en orden
        $order->update_meta_data('_bezhas_tx_id', $result['txId']);
        $order->save();
        
        // Nota en orden
        $order->add_order_note('BeZhas Cargo TX: ' . $result['txId']);
    }
});

// Webhook: actualizar tracking en WooCommerce
add_action('rest_api_init', function() {
    register_rest_route('bezhas-hub/v1', '/webhooks', [
        'methods' => 'POST',
        'callback' => 'handle_bezhas_webhook',
        'permission_callback' => '__return_true'
    ]);
});

function handle_bezhas_webhook($request) {
    $body = $request->get_body();
    $signature = $request->get_header('x-bezhas-signature');
    
    // Verificar firma
    $expected_sig = hash_hmac('sha256', $body, 
        get_option('bezhas_webhook_secret'));
    
    if (!hash_equals($expected_sig, $signature)) {
        return new WP_Error('invalid_sig', 'Invalid signature', 
            ['status' => 401]);
    }
    
    $data = json_decode($body, true);
    
    // Buscar orden por txId
    $orders = wc_get_orders([
        'meta_key' => '_bezhas_tx_id',
        'meta_value' => $data['txId']
    ]);
    
    if (!empty($orders)) {
        $order = $orders[0];
        
        // Actualizar estado según evento
        switch ($data['status']) {
            case 'customs_cleared':
                $order->update_status('processing', 
                    'Aduanas completado');
                break;
            case 'delivered':
                $order->update_status('completed', 
                    'Entregado');
                break;
        }
        
        // Email al cliente
        if ($data['status'] === 'delivered') {
            wp_mail($order->get_billing_email(),
                'Tu pedido fue entregado',
                'Tu pedido #' . $order->get_id() . 
                ' ha sido entregado en ' . $data['deliveredAt']
            );
        }
    }
    
    return ['ack' => true];
}
?>
```

**Paso 4: Resultado**
✅ Cliente compra → Auto-pago → Auto-tracking → Email cuando se entrega

---

### 🏭 CASO 2: ERP Corporativo (Node.js Backend)

**Necesidad:** Sistema ERP que centraliza pagos, inventario, logística.

**Solución:** API REST + Node.js backend + webhooks

**Código Backend (Express.js)**
```javascript
// src/services/bezhas-service.js
import axios from 'axios';
import crypto from 'crypto';

class BeZhasService {
  constructor() {
    this.client = axios.create({
      baseURL: process.env.BEZHAS_API_URL,
      headers: {
        'x-api-key': process.env.BEZHAS_API_KEY
      }
    });
  }

  // Procesar pago de proveedor
  async paySupplier(supplierData) {
    const response = await this.client.post('/api/gateway/v1/pay', {
      amountUSD: supplierData.amount,
      paymentMethod: 'bank', // SEPA/SWIFT
      email: supplierData.email,
      metadata: {
        supplierId: supplierData.id,
        invoiceId: supplierData.invoiceId
      }
    });

    return response.data; // { iban, reference, ... }
  }

  // Crear envío masivo
  async createBulkShipment(shipments) {
    const transactions = await Promise.all(
      shipments.map(ship => 
        this.client.post('/api/cargolink/transactions', {
          posRef: ship.id,
          origin: ship.warehouse,
          destination: ship.address,
          items: ship.items
        })
      )
    );

    return transactions.map(t => t.data);
  }

  // Obtener precio token en tiempo real
  async getTokenPrice() {
    const response = await this.client.get(
      '/api/gateway/v1/price?from=BEZ&to=USD'
    );
    return response.data.price; // e.g., 2.45
  }

  // Verify webhook signature
  verifyWebhook(body, signature) {
    const hash = crypto
      .createHmac('sha256', process.env.WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(signature)
    );
  }
}

export default new BeZhasService();
```

**Rutas de Pago**
```javascript
// src/routes/payments.js
import express from 'express';
import BezhasService from '../services/bezhas-service.js';
import db from '../db.js'; // Tu BD (PostgreSQL, etc)

const router = express.Router();

// POST /api/payments/supplier
router.post('/supplier', async (req, res) => {
  try {
    const { supplierIds, amount } = req.body;

    // Validar
    const suppliers = await db.query(
      'SELECT * FROM suppliers WHERE id = ANY($1)',
      [supplierIds]
    );

    if (suppliers.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Procesar pagos en BeZhas
    const payments = await Promise.all(
      suppliers.map(supplier =>
        BezhasService.paySupplier({
          id: supplier.id,
          email: supplier.email,
          amount: amount / suppliers.length,
          invoiceId: req.body.invoiceId
        })
      )
    );

    // Guardar en BD
    await db.query(
      `INSERT INTO payments (supplier_id, bezhas_payment_id, status)
       VALUES ${suppliers.map((_, i) => 
         `($${i*3+1}, $${i*3+2}, 'pending')`
       ).join(',')}`,
      suppliers.flatMap((s, i) => [
        s.id,
        payments[i].paymentId
      ])
    );

    res.json({
      success: true,
      paymentCount: payments.length,
      totalAmount: amount,
      reference: payments[0].reference
    });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /webhooks/bezhas
router.post('/webhooks/bezhas', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    // Verificar firma
    if (!BezhasService.verifyWebhook(
      req.body,
      req.headers['x-bezhas-signature']
    )) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(req.body);
    console.log('Webhook event:', payload.event, payload.data);

    switch (payload.event) {
      case 'payment.completed':
        // Actualizar BD
        await db.query(
          'UPDATE payments SET status = $1 WHERE bezhas_payment_id = $2',
          ['completed', payload.data.paymentId]
        );
        // Trigger: marcar orden como pagada
        break;

      case 'cargo.delivered':
        // Actualizar BD, notificar cliente
        await db.query(
          'UPDATE shipments SET delivered_at = NOW() WHERE tx_id = $1',
          [payload.data.txId]
        );
        break;
    }

    res.json({ ack: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

**Resultado esperado:**
✅ Panel ERP muestra pagos pendientes → Click "Pagar con BeZhas" → Auto-transferencia SEPA → Confirmación automática

---

### 🎁 CASO 3: App React con SDK

**Necesidad:** App SPA que integra pagos + estadísticas.

**Solución:** SDK @bezhas/connect + React

**Código React**
```jsx
// src/components/PaymentCheckout.jsx
import React, { useState } from 'react';
import { BeZhasConnect } from '@bezhas/connect';

const PaymentCheckout = ({ orderId, amount, email }) => {
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [error, setError] = useState(null);

  const handlePayment = async (method) => {
    setLoading(true);
    setError(null);

    try {
      const bezhas = new BeZhasConnect({
        apiKey: process.env.REACT_APP_BEZHAS_API_KEY
      });

      // Crear pago según método
      const order = await bezhas.pay.buy({
        amountUSD: amount,
        paymentMethod: method,
        email: email
      });

      if (method === 'card' || method === 'bank') {
        // Redirigir a checkout
        setPaymentUrl(order.checkoutUrl);
      } else if (method === 'crypto') {
        // Mostrar instrucciones de wallet
        setPaymentUrl(order.walletAddress);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (paymentUrl) {
    return (
      <div className="payment-redirect">
        <p>Redirigiendo a checkout...</p>
        <a href={paymentUrl} className="btn-primary">
          Continuar a pago
        </a>
      </div>
    );
  }

  return (
    <div className="payment-methods">
      <h2>Selecciona forma de pago</h2>
      
      <button 
        onClick={() => handlePayment('card')}
        disabled={loading}
      >
        💳 Tarjeta (Stripe)
      </button>

      <button 
        onClick={() => handlePayment('bank')}
        disabled={loading}
      >
        🏦 Banco (SEPA/SWIFT)
      </button>

      <button 
        onClick={() => handlePayment('crypto')}
        disabled={loading}
      >
        ₿ BEZ Token
      </button>

      {error && <div className="error">{error}</div>}
      {loading && <div>Procesando...</div>}
    </div>
  );
};

export default PaymentCheckout;
```

**Hook personalizado para webhooks**
```jsx
// src/hooks/useBezhasWebhooks.js
import { useEffect } from 'react';
import { webhooks } from '@bezhas/connect';

export function useBezhasWebhooks(onEvent) {
  useEffect(() => {
    const handleWebhook = async (event) => {
      try {
        // Simulación: en producción, esto viene del servidor
        onEvent(event);
      } catch (err) {
        console.error('Webhook error:', err);
      }
    };

    // Listener en backend (via Server-Sent Events o WebSocket)
    const eventSource = new EventSource('/api/webhooks/stream');
    
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      handleWebhook(data);
    };

    return () => eventSource.close();
  }, [onEvent]);
}

// Uso en componente
function OrderStatus({ orderId }) {
  const [status, setStatus] = useState('pending');

  useBezhasWebhooks((event) => {
    if (event.data.orderId === orderId) {
      setStatus(event.event === 'payment.completed' ? 'paid' : 'failed');
    }
  });

  return <div>Status: {status}</div>;
}
```

---

### ⚡ CASO 4: VPP de Energía

**Necesidad:** Agregar del energía y vender en mercado OMIE.

**Solución:** Energy API + SDK

**Código (Node.js)**
```javascript
// src/services/energy-trading.js
import axios from 'axios';

class EnergyTrading {
  constructor(apiKey) {
    this.client = axios.create({
      baseURL: 'https://api.bez.digital:3001',
      headers: { 'x-api-key': apiKey }
    });
  }

  // Obtener precio actual OMIE
  async getCurrentPrice() {
    const response = await this.client.get('/api/energy/price/omie');
    return response.data; // { price, timestamp, trend }
  }

  // Ejecutar trade
  async executeTrade(amount, price) {
    const response = await this.client.post(
      '/api/energy/trade',
      {
        energyMWh: amount,
        priceEUR: price,
        marketType: 'omie',
        direction: 'sell' // o 'buy'
      }
    );
    return response.data;
  }

  // Historial
  async getTradeHistory(limit = 50) {
    const response = await this.client.get(
      `/api/energy/trades?limit=${limit}`
    );
    return response.data;
  }

  // Arbitrage automático
  async setupArbitrage(minMargin = 0.05) {
    const response = await this.client.post(
      '/api/energy/arbitrage/setup',
      {
        minMarginEUR: minMargin,
        autoTrade: true
      }
    );
    return response.data;
  }
}

// Uso
const trading = new EnergyTrading(process.env.BEZHAS_API_KEY);

// Monitorear y tradear cada hora
setInterval(async () => {
  const price = await trading.getCurrentPrice();
  
  console.log(`OMIE Price: €${price.price}/MWh (${price.trend})`);

  // Si el precio está bajo, comprar
  if (price.price < 50) {
    await trading.executeTrade(100, price.price); // 100 MWh
    console.log('Compra ejecutada');
  }

  // Si el precio está alto, vender
  if (price.price > 80) {
    await trading.executeTrade(50, price.price);
    console.log('Venta ejecutada');
  }
}, 3600000); // cada hora
```

---

### 🔐 CASO 5: Sistema de Identidad (BeZhas_ID)

**Necesidad:** Verificar identidad única de usuarios en el ecosistema.

**Solución:** Genesis API

**Código**
```javascript
// Verificar identidad de usuario
async function verifyUserIdentity(userId) {
  const response = await fetch(
    `https://api.bez.digital:3001/api/identity/profile/${userId}`,
    {
      headers: { 'x-api-key': process.env.BEZHAS_API_KEY }
    }
  );

  const profile = await response.json();

  return {
    bezhasId: profile.bezhas_id,
    verified: profile.verified,
    reputation: profile.reputation_score, // 0-100
    lastVerified: profile.last_verified_at
  };
}

// Ejemplo de uso en middleware Express
app.use(async (req, res, next) => {
  const bezhasId = req.headers['x-bezhas-id'];
  
  if (!bezhasId) {
    return res.status(401).json({ error: 'No identity' });
  }

  const identity = await verifyUserIdentity(bezhasId);

  if (!identity.verified) {
    return res.status(403).json({ error: 'Unverified user' });
  }

  // Almacenar en request context
  req.user = { bezhasId, reputation: identity.reputation };
  next();
});
```

---

## 📊 Tabla Comparativa

| Caso | Industria | Método | Complejidad | Tiempo |
|------|-----------|--------|-------------|--------|
| Tienda WooCommerce | E-commerce | Plugin WP | Muy Baja | 5 min |
| ERP corporativo | Manufactura | API REST | Media | 8h dev |
| App React | SaaS | SDK JS | Media | 4h dev |
| Trading Energía | Utilidades | API REST | Alta | 16h dev |
| Verificación ID | Cualquiera | API REST | Baja | 2h dev |

---

## ✅ Checklist de Seguridad

- [ ] API Key en `.env` (nunca en código)
- [ ] Webhook secret guardado localmente
- [ ] Signature verification en TODO webhook
- [ ] HTTPS obligatorio en webhook URL
- [ ] Rate limiting implementado (1000 req/min)
- [ ] Logs de transacciones (para auditoría)
- [ ] Error handling sin exponer secrets
- [ ] Testing en sandbox antes de prod
- [ ] Monitoring de errores 4xx/5xx
- [ ] Backup de datos críticos

---

**¿Preguntas? support@bez.digital**
