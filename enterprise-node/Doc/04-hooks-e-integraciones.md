# Hooks e Integraciones

Los hooks salientes permiten enviar eventos del nodo a sistemas externos: ERP, CRM, backend SaaS, data warehouse, monitorizacion o automatizaciones internas.

## Crear un hook

```bash
curl -X POST http://localhost:4100/hooks \
  -H "Authorization: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"ERP\",\"url\":\"https://erp.example.com/bezhas\",\"event_type\":\"blockchain.event\",\"secret\":\"CAMBIA_ESTO\"}"
```

## Tipos de evento

- `blockchain.event`: evento indexado desde contratos on-chain.
- `erp.webhook.received`: payload recibido en `/webhook`.
- `hook.test`: prueba manual.
- `*`: recibe todos los eventos.
- `blockchain.*`: recibe eventos con prefijo.

## Firma

Si configuras `secret`, el nodo envia:

```http
X-BeZhas-Signature: HMAC_SHA256(body, secret)
```

El receptor debe recalcular la firma antes de procesar el payload.

## Buenas practicas

- Usa HTTPS.
- Usa secrets diferentes por cliente.
- Filtra por `event_type` para reducir coste y ruido.
- Mantén timeouts bajos.
- Reintentos avanzados deben implementarse en una fase posterior con cola persistente.

## Rentabilidad

Los hooks son una superficie clara de monetizacion: se puede cobrar por volumen entregado, por integracion premium o por SLA. El `.env` incluye `REVENUE_WEBHOOK_FEE_EUR` para calcular escenarios.

