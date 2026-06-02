# Oracle NetSuite — BeZhas Webhook Integration

> Template de integración para notarizar transacciones Oracle NetSuite en la blockchain BeZhas L2.

## Resumen

Configurar Oracle NetSuite para enviar webhooks al Edge Node de BeZhas mediante RESTlets (SuiteScript 2.x). Cada transacción registrada (ventas, compras, inventario) se notariza automáticamente en la blockchain.

## Arquitectura

```
Oracle NetSuite  →  RESTlet (SuiteScript 2.x)  →  BeZhas Edge Node  →  Blockchain L2
(User Event)        (https.post)                   (notarización)       (registro inmutable)
```

## Requisitos

- Oracle NetSuite account con SuiteScript 2.x habilitado
- Rol con permisos: **SuiteScript**, **Web Services**, **REST Web Services**
- Token-Based Authentication (TBA) configurado
- Credenciales BeZhas: `webhookSecret` del onboarding

## Paso 1: Script de Envío (SuiteScript 2.x)

Crear archivo `bezhas_webhook_sender.js` y subirlo a **File Cabinet → SuiteScripts**:

```javascript
/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @description Envía eventos a BeZhas Edge Node para notarización blockchain
 */
define(['N/https', 'N/crypto', 'N/encode', 'N/runtime', 'N/log', 'N/record'],
function(https, crypto, encode, runtime, log, record) {

    const EDGE_NODE_URL = 'https://<tu-edge-node-ip>:4200/api/webhook/ingest';
    const WEBHOOK_SECRET = '<TU_WEBHOOK_SECRET>';

    /**
     * Genera firma HMAC-SHA256
     */
    function generateSignature(payload) {
        var hmac = crypto.createHmac({
            algorithm: crypto.HashAlg.SHA256,
            key: crypto.createSecretKey({ secret: WEBHOOK_SECRET })
        });
        hmac.update({ input: payload });
        return hmac.digest({ outputEncoding: encode.Encoding.HEX }).toLowerCase();
    }

    /**
     * Envía evento al Edge Node
     */
    function sendToBeZhas(eventType, documentId, amount, currency, sector, metadata) {
        var timestamp = new Date().toISOString();

        var payload = JSON.stringify({
            event: eventType,
            documentId: String(documentId),
            amount: parseFloat(amount) || 0,
            currency: currency || 'USD',
            sector: sector || 'general',
            source: 'oracle-netsuite',
            timestamp: timestamp,
            metadata: metadata || {}
        });

        var signature = generateSignature(payload);

        try {
            var response = https.post({
                url: EDGE_NODE_URL,
                headers: {
                    'Content-Type': 'application/json',
                    'X-BeZhas-Signature': signature,
                    'X-BeZhas-Timestamp': timestamp
                },
                body: payload
            });

            var result = JSON.parse(response.body);
            log.audit('BeZhas Webhook', 'txHash: ' + result.txHash + ' | block: ' + result.blockNumber);
            return result;
        } catch (e) {
            log.error('BeZhas Webhook Error', e.message);
            return null;
        }
    }

    /**
     * afterSubmit — Se ejecuta después de guardar el registro
     */
    function afterSubmit(context) {
        if (context.type === context.UserEventType.DELETE) return;

        var rec = context.newRecord;
        var recType = rec.type;
        var recId = rec.id;

        var eventMap = {
            'salesorder':       { event: 'sales_order_created',   sector: 'Retail' },
            'purchaseorder':    { event: 'purchase_order_created', sector: 'supply_chain' },
            'invoice':          { event: 'customer_invoice',       sector: 'Finanzas' },
            'vendorbill':       { event: 'vendor_invoice',         sector: 'Finanzas' },
            'vendorpayment':    { event: 'payment_executed',       sector: 'Finanzas' },
            'itemfulfillment':  { event: 'outbound_delivery',      sector: 'Logística' },
            'itemreceipt':      { event: 'goods_receipt',          sector: 'Logística' },
            'inventoryadjustment': { event: 'stock_movement',      sector: 'Manufactura' },
        };

        var mapping = eventMap[recType];
        if (!mapping) return; // Tipo de registro no mapeado

        var full = record.load({ type: recType, id: recId });

        var amount = full.getValue('total') || full.getValue('amount') || 0;
        var currency = full.getText('currency') || 'USD';
        var entity = full.getText('entity') || '';
        var tranId = full.getValue('tranid') || recId;

        var isNew = context.type === context.UserEventType.CREATE;
        var eventType = isNew ? mapping.event : mapping.event.replace('created', 'updated');

        var result = sendToBeZhas(
            eventType,
            tranId,
            amount,
            currency,
            mapping.sector,
            {
                netsuiteId: recId,
                entity: entity,
                recordType: recType,
                action: isNew ? 'create' : 'edit'
            }
        );

        // Guardar txHash en campo personalizado (custbody_bezhas_tx)
        if (result && result.txHash) {
            try {
                record.submitFields({
                    type: recType,
                    id: recId,
                    values: { custbody_bezhas_tx: result.txHash }
                });
            } catch (e) {
                log.error('BeZhas Save txHash', e.message);
            }
        }
    }

    return { afterSubmit: afterSubmit };
});
```

## Paso 2: Crear Custom Field

1. Ir a **Customization → Lists, Records & Fields → Transaction Body Fields**
2. Crear campo:
   - **Label**: BeZhas TX Hash
   - **ID**: `custbody_bezhas_tx`
   - **Type**: Free-Form Text
   - **Store Value**: ✅
   - **Applies To**: Todas las transacciones relevantes

## Paso 3: Deploy del Script

1. Ir a **Customization → Scripting → Scripts → New**
2. Seleccionar el archivo `bezhas_webhook_sender.js`
3. Tipo: **User Event**
4. Crear **Script Deployment** para cada tipo de registro:

| Record Type | Event | Deployment ID |
|---|---|---|
| Sales Order | afterSubmit | `_bezhas_so` |
| Purchase Order | afterSubmit | `_bezhas_po` |
| Invoice | afterSubmit | `_bezhas_inv` |
| Vendor Bill | afterSubmit | `_bezhas_vb` |
| Vendor Payment | afterSubmit | `_bezhas_vp` |
| Item Fulfillment | afterSubmit | `_bezhas_if` |
| Item Receipt | afterSubmit | `_bezhas_ir` |
| Inventory Adjustment | afterSubmit | `_bezhas_ia` |

5. **Status**: Released
6. **Execute as Role**: Administrator o rol con permisos Web Services

## Paso 4: RESTlet para Consultas (Opcional)

Para consultar el estado de notarización desde NetSuite:

```javascript
/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 */
define(['N/search', 'N/log'], function(search, log) {
    function get(params) {
        var txHash = params.txHash;
        if (!txHash) return { error: 'txHash required' };

        var results = [];
        search.create({
            type: search.Type.TRANSACTION,
            filters: [['custbody_bezhas_tx', 'is', txHash]],
            columns: ['tranid', 'type', 'total', 'entity', 'trandate']
        }).run().each(function(r) {
            results.push({
                tranId: r.getValue('tranid'),
                type: r.getValue('type'),
                total: r.getValue('total'),
                entity: r.getText('entity'),
                date: r.getValue('trandate')
            });
            return true;
        });

        return { txHash: txHash, records: results };
    }

    return { get: get };
});
```

## Eventos NetSuite Recomendados

| Record Type | Event Type (webhook) | Sector |
|---|---|---|
| Sales Order | `sales_order_created` | `Retail` |
| Purchase Order | `purchase_order_created` | `supply_chain` |
| Invoice | `customer_invoice` | `Finanzas` |
| Vendor Bill | `vendor_invoice` | `Finanzas` |
| Vendor Payment | `payment_executed` | `Finanzas` |
| Item Fulfillment | `outbound_delivery` | `Logística` |
| Item Receipt | `goods_receipt` | `Logística` |
| Inventory Adjustment | `stock_movement` | `Manufactura` |

## Payload de Webhook (Referencia)

```json
{
  "event": "sales_order_created",
  "documentId": "SO-12345",
  "amount": 8500.00,
  "currency": "USD",
  "sector": "Retail",
  "source": "oracle-netsuite",
  "timestamp": "2025-01-15T14:30:00Z",
  "metadata": {
    "netsuiteId": 98765,
    "entity": "Acme Corp",
    "recordType": "salesorder",
    "action": "create"
  }
}
```

### Headers requeridos

| Header | Descripción |
|---|---|
| `Content-Type` | `application/json` |
| `X-BeZhas-Signature` | HMAC-SHA256 del body con `webhookSecret` |
| `X-BeZhas-Timestamp` | ISO 8601 UTC timestamp del envío |

## Seguridad

- **HMAC-SHA256**: Firma obligatoria en cada request
- **TLS/SSL**: Solo HTTPS
- **IP Whitelist**: Configurar Edge Node para aceptar solo IPs de NetSuite
- **SuiteScript Governance**: El script consume ~10 units por ejecución, bien dentro de los límites
- **Retry**: Implementar cola de reintentos si el Edge Node no responde (Scheduled Script)

## Troubleshooting

| Problema | Solución |
|---|---|
| SSS_REQUEST_LIMIT_EXCEEDED | Demasiadas llamadas HTTP; usar Map/Reduce para batch |
| INVALID_URL | Verificar que el Edge Node URL es accesible desde NetSuite datacenter |
| HTTP 401 | Regenerar `webhookSecret` en BeZhas onboarding |
| HTTP 503 | Edge Node reiniciando; el script loguea error y continúa |
| custbody_bezhas_tx no aparece | Verificar que el campo aplica al tipo de transacción |
