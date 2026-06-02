# Generic HTTP — BeZhas Webhook Integration

> Template genérico para cualquier sistema que pueda hacer HTTP POST (ERP, CRM, IoT, scripts, cron jobs).

## Resumen

Cualquier sistema que pueda enviar un HTTP POST con JSON puede notarizar transacciones en la blockchain BeZhas. Este documento cubre la especificación del webhook, ejemplos con curl, Python, PHP, Go, y guías para integrar desde cualquier plataforma.

## Endpoint

```
POST https://<tu-edge-node>:4200/api/webhook/ingest
```

## Payload Estándar

```json
{
  "event": "<tipo_evento>",
  "documentId": "<id_documento>",
  "amount": 0.00,
  "currency": "USD",
  "sector": "<sector>",
  "source": "<nombre_sistema>",
  "timestamp": "2025-01-15T14:30:00Z",
  "metadata": {}
}
```

### Campos

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `event` | string | ✅ | Tipo de evento (ver tabla abajo) |
| `documentId` | string | ✅ | ID único del documento/transacción en tu sistema |
| `amount` | number | ❌ | Monto de la transacción (default: 0) |
| `currency` | string | ❌ | Código ISO 4217 (default: `USD`) |
| `sector` | string | ❌ | Sector económico (default: `general`) |
| `source` | string | ✅ | Identificador de tu sistema (`mi-erp`, `crm-v2`, etc.) |
| `timestamp` | string | ✅ | ISO 8601 UTC del momento del evento |
| `metadata` | object | ❌ | Datos adicionales (no incluir PII) |

### Headers Requeridos

| Header | Valor | Descripción |
|---|---|---|
| `Content-Type` | `application/json` | Obligatorio |
| `X-BeZhas-Signature` | `<hmac_hex>` | HMAC-SHA256 del body con `webhookSecret` |
| `X-BeZhas-Timestamp` | `<iso8601>` | Timestamp del envío (anti-replay) |

### Respuesta Exitosa

```json
{
  "success": true,
  "txHash": "0x7a8b9c1d2e3f...",
  "blockNumber": 12345,
  "gasUsed": "21000"
}
```

### Respuesta de Error

```json
{
  "success": false,
  "error": "Invalid signature"
}
```

## Tipos de Evento Estándar

| Event Type | Descripción | Sector sugerido |
|---|---|---|
| `purchase_order_created` | Orden de compra creada | `supply_chain` |
| `sales_order_created` | Orden de venta creada | `Retail` |
| `customer_invoice` | Factura emitida | `Finanzas` |
| `vendor_invoice` | Factura de proveedor | `Finanzas` |
| `payment_executed` | Pago procesado | `Finanzas` |
| `goods_receipt` | Entrada de mercancía | `Logística` |
| `outbound_delivery` | Envío/despacho | `Logística` |
| `stock_movement` | Movimiento de inventario | `Manufactura` |
| `refund_processed` | Reembolso | `Finanzas` |
| `product_created` | Producto registrado | `Retail` |
| `contract_signed` | Contrato firmado | `Legal` |
| `audit_completed` | Auditoría completada | `Gobierno` |
| `sensor_reading` | Lectura de sensor IoT | `Energía` |
| `certificate_issued` | Certificado emitido | `Educación` |
| `custom` | Evento personalizado | (definir) |

> Puedes crear eventos personalizados. El Edge Node acepta cualquier string como `event`.

## Sectores Disponibles

```
Agro, Salud, Educación, Logística, Gobierno, Energía,
Finanzas, Retail, Manufactura, Inmobiliario, Turismo,
Tecnología, Legal, Telecomunicaciones, Construcción, Minería
```

---

## Ejemplos de Integración

### curl

```bash
#!/bin/bash
EDGE_URL="https://tu-edge-node:4200/api/webhook/ingest"
SECRET="tu_webhook_secret"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

PAYLOAD=$(cat <<EOF
{
  "event": "purchase_order_created",
  "documentId": "PO-2025-0042",
  "amount": 15000.00,
  "currency": "EUR",
  "sector": "supply_chain",
  "source": "mi-erp",
  "timestamp": "$TIMESTAMP",
  "metadata": {"vendor": "Proveedor ABC", "items": 5}
}
EOF
)

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST "$EDGE_URL" \
  -H "Content-Type: application/json" \
  -H "X-BeZhas-Signature: $SIGNATURE" \
  -H "X-BeZhas-Timestamp: $TIMESTAMP" \
  -d "$PAYLOAD"
```

### Python

```python
import hashlib
import hmac
import json
import requests
from datetime import datetime, timezone

EDGE_URL = "https://tu-edge-node:4200/api/webhook/ingest"
SECRET = "tu_webhook_secret"

def send_to_bezhas(event: str, document_id: str, amount: float = 0,
                   currency: str = "USD", sector: str = "general",
                   source: str = "python-script", metadata: dict = None):
    timestamp = datetime.now(timezone.utc).isoformat()

    payload = json.dumps({
        "event": event,
        "documentId": document_id,
        "amount": amount,
        "currency": currency,
        "sector": sector,
        "source": source,
        "timestamp": timestamp,
        "metadata": metadata or {}
    }, separators=(",", ":"))

    signature = hmac.new(
        SECRET.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()

    response = requests.post(EDGE_URL, data=payload, headers={
        "Content-Type": "application/json",
        "X-BeZhas-Signature": signature,
        "X-BeZhas-Timestamp": timestamp
    }, timeout=15)

    result = response.json()
    print(f"txHash: {result.get('txHash')} | block: {result.get('blockNumber')}")
    return result


# Ejemplo de uso
send_to_bezhas(
    event="purchase_order_created",
    document_id="PO-2025-0042",
    amount=15000.00,
    currency="EUR",
    sector="supply_chain",
    source="mi-erp-python",
    metadata={"vendor": "Proveedor ABC"}
)
```

### PHP

```php
<?php
$edgeUrl = 'https://tu-edge-node:4200/api/webhook/ingest';
$secret  = 'tu_webhook_secret';

function sendToBeZhas($event, $documentId, $amount = 0, $currency = 'USD',
                      $sector = 'general', $source = 'php-script', $metadata = []) {
    global $edgeUrl, $secret;

    $timestamp = gmdate('Y-m-d\TH:i:s\Z');

    $payload = json_encode([
        'event'      => $event,
        'documentId' => $documentId,
        'amount'     => (float)$amount,
        'currency'   => $currency,
        'sector'     => $sector,
        'source'     => $source,
        'timestamp'  => $timestamp,
        'metadata'   => $metadata ?: new \stdClass(),
    ]);

    $signature = hash_hmac('sha256', $payload, $secret);

    $ch = curl_init($edgeUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            "X-BeZhas-Signature: $signature",
            "X-BeZhas-Timestamp: $timestamp",
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);
    echo "txHash: {$result['txHash']} | block: {$result['blockNumber']}\n";
    return $result;
}

// Ejemplo
sendToBeZhas('customer_invoice', 'INV-2025-112', 3500.00, 'USD', 'Finanzas', 'mi-crm-php');
```

### Go

```go
package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const edgeURL = "https://tu-edge-node:4200/api/webhook/ingest"
const secret = "tu_webhook_secret"

type WebhookPayload struct {
	Event      string      `json:"event"`
	DocumentID string      `json:"documentId"`
	Amount     float64     `json:"amount"`
	Currency   string      `json:"currency"`
	Sector     string      `json:"sector"`
	Source     string      `json:"source"`
	Timestamp  string      `json:"timestamp"`
	Metadata   interface{} `json:"metadata"`
}

func sendToBeZhas(payload WebhookPayload) (map[string]interface{}, error) {
	payload.Timestamp = time.Now().UTC().Format(time.RFC3339)

	body, _ := json.Marshal(payload)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	signature := hex.EncodeToString(mac.Sum(nil))

	req, _ := http.NewRequest("POST", edgeURL, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-BeZhas-Signature", signature)
	req.Header.Set("X-BeZhas-Timestamp", payload.Timestamp)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(respBody, &result)

	fmt.Printf("txHash: %s | block: %v\n", result["txHash"], result["blockNumber"])
	return result, nil
}

func main() {
	sendToBeZhas(WebhookPayload{
		Event:      "goods_receipt",
		DocumentID: "GR-2025-0088",
		Amount:     42000.00,
		Currency:   "USD",
		Sector:     "Logística",
		Source:     "warehouse-go",
		Metadata:   map[string]string{"warehouse": "WH-01", "carrier": "DHL"},
	})
}
```

---

## Firma HMAC-SHA256 (Detalle)

El Edge Node verifica cada request con HMAC-SHA256:

1. Toma el **body completo** (string JSON exacto)
2. Firma con `HMAC-SHA256(body, webhookSecret)`
3. Compara con el header `X-BeZhas-Signature`
4. Si no coincide → `401 Unauthorized`

### Pseudocódigo

```
signature = HMAC_SHA256(
    key   = webhookSecret,
    data  = raw_json_body
)
header["X-BeZhas-Signature"] = hex(signature)
```

> **Importante**: El body debe ser el string JSON exacto que se envía, sin reformatear.

---

## Buenas Prácticas

1. **Idempotencia**: Usa `documentId` único por evento. El Edge Node descarta duplicados del mismo `documentId + event`.
2. **No PII**: No incluir datos personales (emails, nombres, direcciones) en `metadata`. La blockchain es pública.
3. **Retry con backoff**: Si recibes HTTP 5xx, reintentar con backoff exponencial (1s, 2s, 4s, max 3 intentos).
4. **Logging**: Guardar el `txHash` devuelto en tu sistema para auditoría cruzada.
5. **Monitoreo**: Configurar alertas si el webhook falla más de 3 veces consecutivas.
6. **Timestamp anti-replay**: El Edge Node rechaza requests con timestamp > 5 minutos de diferencia.

## Verificar Transacción

Una vez notarizada, puedes verificar la transacción en:

```
https://explorer.bez.digital/tx/<txHash>
```

O via API:

```bash
curl https://tu-edge-node:4200/api/webhook/status/<txHash>
```

Respuesta:

```json
{
  "txHash": "0x7a8b9c...",
  "status": "confirmed",
  "blockNumber": 12345,
  "timestamp": "2025-01-15T14:30:02Z",
  "confirmations": 42
}
```
