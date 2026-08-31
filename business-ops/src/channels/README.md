# Canales de entrada

Cada canal recibe mensajes y los reenvía a `tenants.handle(tenantId, input)`.

- **WebChannel** — widget de chat embebido (websocket/HTTP).
- **TelegramChannel** — reusar el patrón del bot BeZhas (node-telegram-bot-api).
- **WhatsAppChannel** — vía API de WhatsApp Business.
- **EmailInboundChannel** — webhook de email entrante.

Patrón mínimo de un canal:

```js
// al recibir un mensaje:
const taskId = await tenants.handle(tenantId, {
  text: msg.text, channel: 'telegram', customerId: msg.from.id,
});
```
