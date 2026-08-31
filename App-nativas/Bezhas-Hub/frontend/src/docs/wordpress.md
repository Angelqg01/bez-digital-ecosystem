# Plugin WordPress — WooCommerce Gateway

Integración nativa para WordPress + WooCommerce.

## Instalación

### Método 1: Desde admin de WordPress

1. **Plugins > Add New**
2. Buscar: "BeZhas Hub"
3. Click **Install Now** → **Activate**

### Método 2: Manual

```bash
# En tu servidor
cd wp-content/plugins/
git clone https://github.com/bezhas/wp-bezhas-hub.git
# O descargar ZIP desde https://bez.digital/plugin/wp

# En admin WordPress:
# Plugins > Activate "BeZhas Hub"
```

### Método 3: Composer

```bash
composer require bezhas/wp-plugin
```

## Configuración

1. **BeZhas Hub > Configuración**
2. Ingresar:
   - **API Key** (de https://bez.digital/developers)
   - **Webhook Secret** (auto-generado)
   - **Red**: Polygon (recomendado) o BSC
   - **Staking**: Activar/desactivar (automático)

3. **WooCommerce > Pagos > BeZhas**
   - Habilitar
   - Título: "Pagar con BeZhas"
   - Descripción: "Pago instantáneo en blockchain"

## Uso en checkout

El cliente ve opción "Pagar con BeZhas" en WooCommerce checkout.

**Flujo**:
1. Selecciona método de pago
2. En el mismo checkout: conecta wallet (MetaMask, etc.) o paga con EUR
3. Confirma → Orden pagada automáticamente
4. Recibe confirmación en correo

## Dashboard en admin

**BeZhas Hub > Dashboard**
- Ventas hoy/semana/mes
- Total liquidado en BEZ
- Rendimiento de staking (si habilitado)
- Transacciones recientes

## Configuración avanzada

### Permitir pago en EUR (con conversión automática)

```php
// En wp-config.php o plugin customizado:
define('BEZHAS_ALLOW_FIAT', true);
define('BEZHAS_FIAT_CURRENCY', 'EUR');
define('BEZHAS_FIAT_PROVIDER', 'stripe'); // stripe | coinbase
```

### Personalizar mensaje de checkout

Filtro WordPress:
```php
add_filter('bezhas_checkout_description', function() {
  return 'Paga con criptomonedas y ahorra hasta 3% en fees';
});
```

### Webhooks personalizados

```php
add_action('bezhas_payment_completed', function($payment_data) {
  // $payment_data->orderId, $payment_data->txHash
  // Tu código aquí: enviar SMS, actualizar inventory, etc.
});
```

## Soporte

- Docs: https://bez.digital/docs/wordpress
- Forum: https://bez.digital/community
- Email: support@bez.digital

## Requisitos

- WordPress 6.0+
- WooCommerce 8.0+
- PHP 8.0+
- OpenSSL (para SIWE)

## Troubleshooting

**Error: "API Key inválida"**
→ Verificar en https://bez.digital/developers/keys

**Webhook no recibe eventos**
→ Verificar que `wp_remote_post()` funciona
→ Comprobar firewall/WAF

**Pago aparece "pending"**
→ Esperar 1-2 minutos (confirmaciones de bloque)
→ Revisar tx en blockchain explorer
