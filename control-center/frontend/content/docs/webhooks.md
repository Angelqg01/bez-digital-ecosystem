# Webhooks de pagos

Los webhooks avisan a tu sistema cuando un pago de BeZhas Pay cambia de estado, sin que tengas que consultar la API cada pocos segundos. BeZhas firma cada entrega para que puedas comprobar que viene de BeZhas y que nadie la ha modificado por el camino.

> Los webhooks se gestionan con la **api-key** de tu organización (`X-API-Key`). No se pueden registrar con un token OAuth de un conector de IA: registrar un destino que recibe tus pagos es una decisión de tu equipo técnico, no de un agente.

## Eventos

| Evento | Cuándo se envía |
|---|---|
| `payment.settled` | El pago está liquidado. Es el valor por defecto si no indicas eventos. |
| `payment.failed` | El pago no se pudo completar. |
| `payment.expired` | La orden de pago caducó sin completarse. |
| `payment.refunded` | Se ha devuelto el importe al pagador. |

## Registrar un webhook

```bash
curl -X POST https://api.bez.digital/api/gateway/v1/webhooks/register \
  -H "X-API-Key: $BEZHAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://tu-empresa.com/webhooks/bezhas","events":["payment.settled","payment.refunded"]}'
```

La respuesta incluye el campo `secret`. **Solo se muestra esta vez**: guárdalo en tu gestor de secretos. Si lo pierdes, vuelve a registrar la misma URL y se generará uno nuevo (el anterior deja de valer).

Registrar de nuevo una URL que ya existe actualiza sus eventos y rota el secreto; no crea un duplicado.

## Qué recibe tu servidor

Cada entrega es un `POST` con el evento en el cuerpo y estas cabeceras:

| Cabecera | Contenido |
|---|---|
| `X-BeZhas-Signature` | `sha256=<hex(HMAC-SHA256(secret, cuerpo_en_bruto))>` |
| `X-BeZhas-Event` | Nombre del evento, p. ej. `payment.settled` |
| `X-BeZhas-Delivery` | Identificador de la entrega. Úsalo para ignorar duplicados. |

Responde con un código `2xx` en menos de 10 segundos. Cualquier otra respuesta, o no responder, cuenta como fallo y se reintenta.

## Verificar la firma

Calcula el HMAC sobre el **cuerpo en bruto**, tal como llega, antes de parsear el JSON. Si lo parseas y lo vuelves a serializar, el orden o los espacios pueden cambiar y la firma no coincidirá.

```js
const crypto = require('crypto');

function firmaValida(secret, rawBody, cabecera) {
    const esperada = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(esperada);
    const b = Buffer.from(String(cabecera || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

Usa siempre una comparación en tiempo constante (`timingSafeEqual`). Una comparación normal de cadenas permite adivinar la firma midiendo el tiempo de respuesta.

## Reintentos

Si una entrega falla, se reintenta con espera exponencial: 1 minuto, luego 2, 4, 8… con un máximo de una hora entre intentos, hasta 8 intentos en total. Agotados los intentos, la entrega queda como `dead` y puedes reenviarla a mano.

```bash
# Entregas recientes (filtra con ?status=pending|delivered|dead)
curl https://api.bez.digital/api/gateway/v1/webhooks/deliveries?status=dead \
  -H "X-API-Key: $BEZHAS_API_KEY"

# Reenviar una entrega fallida
curl -X POST https://api.bez.digital/api/gateway/v1/webhooks/deliveries/123/retry \
  -H "X-API-Key: $BEZHAS_API_KEY"
```

Como un evento puede llegar más de una vez, tu manejador debe ser **idempotente**: guarda el `X-BeZhas-Delivery` procesado y, si vuelve a llegar, responde `200` sin repetir la acción.

## Gestionar tus webhooks

| Acción | Endpoint |
|---|---|
| Listar | `GET /api/gateway/v1/webhooks` (nunca devuelve el secreto) |
| Desactivar | `DELETE /api/gateway/v1/webhooks/:id` |
| Ver entregas | `GET /api/gateway/v1/webhooks/deliveries` |
| Reenviar | `POST /api/gateway/v1/webhooks/deliveries/:id/retry` |

## Buenas prácticas

- Usa HTTPS en tu URL de destino.
- Verifica la firma **antes** de hacer nada con el contenido.
- No confíes solo en el webhook para entregar valor: ante la duda, consulta el estado del pago en la API.
- Guarda el secreto en un gestor de secretos, nunca en el repositorio.

## Ver también

- [Pagos y gas](/docs/pagos-y-gas)
- [Referencia de API](/docs/api-reference)
- [BeZhas MCP: conecta tu IA](/mcp)
