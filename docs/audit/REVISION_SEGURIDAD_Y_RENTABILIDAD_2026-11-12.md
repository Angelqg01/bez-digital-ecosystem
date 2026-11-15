# Revisión de seguridad y rentabilidad de BeZhas

**Fecha:** 12 de noviembre de 2026  
**Alcance:** revisión estática preliminar del backend, facturación de IA, OPERANT y marketplace. No constituye una auditoría completa del monorepo ni de los contratos inteligentes.

## Resumen ejecutivo

Se identificaron dos problemas de facturación en el sistema heredado `ai-billing`, un posible camino de consumo de OPERANT Starter sin facturación efectiva y una diferencia material entre los costes proyectados por el código y los de la documentación comercial.

Prioridad de trabajo:

1. Deshabilitar o corregir las rutas heredadas de `ai-billing` para que no otorguen planes ni marquen facturas pagadas sin liquidación real.
2. Exigir una forma de cobro activa antes de aceptar trabajo PAYG de OPERANT y registrar de forma idempotente el consumo.
3. Hacer atómica la reserva de cuota antes de ejecutar tareas.
4. Alinear precios, hipótesis de coste y márgenes entre backend y documentación.

## Hallazgos de seguridad y facturación

### H1 — Suscripción de IA sin cobro verificado

**Severidad:** Alta, sujeto a disponibilidad de cuentas con identificadores numéricos en el flujo heredado.

`POST /api/ai-billing/subscribe` acepta el nivel indicado por una persona autenticada. `purchaseSubscription` crea o actualiza `ai_subscriptions` y devuelve el precio, pero no inicia un pago ni verifica una compra confirmada. La ruta está montada en la API.

El esquema heredado declara `user_id INTEGER`, por lo que hay que confirmar qué cuentas pueden usarlo actualmente. La incompatibilidad con identificadores UUID podría hacer que algunos intentos fallen, pero no sustituye la comprobación de pago.

**Referencias:**

- [api/routes/ai-billing.js](../../api/routes/ai-billing.js#L145)
- [api/services/aiBillingService.js](../../api/services/aiBillingService.js#L83)
- [api/index.js](../../api/index.js#L435)
- [api/db/migrations/007_ai_billing.sql](../../api/db/migrations/007_ai_billing.sql#L58)

**Acción recomendada:** conectar la activación a Stripe Checkout o a otro flujo de pago autorizado y activar el plan solo desde un webhook verificado. Si este sistema ya no se usa, retirar o cerrar las rutas y servicios heredados.

### H2 — Factura marcada como pagada sin transferir fondos

**Severidad:** Alta, en el flujo heredado de facturación.

`payInvoice` consulta el saldo de una dirección en el Paymaster. Si alcanza, actualiza la factura a `paid` e inserta un registro `processed`, pero no ejecuta una operación on-chain que retire o transfiera ese saldo ni verifica un recibo de pago. La consulta y la actualización tampoco están protegidas por una transacción o una actualización condicional que impida liquidaciones concurrentes.

**Referencia:** [api/services/aiBillingService.js](../../api/services/aiBillingService.js#L125)

**Acción recomendada:** verificar un `txHash` o ejecutar el pago a través del contrato autorizado; validar red, contrato, importe, destinatario, pagador y confirmaciones. Actualizar la factura de forma atómica con condición `status = 'pending'` y registrar el identificador de transacción con restricción de unicidad. No marcarla como pagada por una mera lectura de saldo.

### H3 — OPERANT Starter puede ejecutar consumo PAYG sin cliente Stripe

**Severidad:** Alta en impacto económico potencial; confirmar qué apps pueden activar OPERANT en Starter.

En `checkQuota`, Starter se autoriza siempre como PAYG. No se comprueba que exista un cliente o suscripción Stripe antes de despachar la tarea. Después, `recordTask` intenta registrar el consumo; si no encuentra cliente Starter, `usageBilling.recordUsage` devuelve `reported: false` y el flujo conserva el uso en el ledger, pero la ejecución ya se produjo.

**Referencias:**

- [api/services/operantUsage.js](../../api/services/operantUsage.js#L86)
- [api/services/operantUsage.js](../../api/services/operantUsage.js#L134)
- [api/services/usageBilling.js](../../api/services/usageBilling.js#L105)
- [api/routes/operant.js](../../api/routes/operant.js#L315)

**Acción recomendada:** antes de despachar, comprobar que hay una suscripción de pago por uso válida o una prueba activa con sus límites. Reservar el coste/créditos antes de ejecutar; bloquear el consumo nuevo cuando no se pueda cobrar y proporcionar conciliación idempotente para eventos de Stripe fallidos.

### H4 — Datos de consumo de IA heredados declarados por el cliente

**Severidad:** Media; depende de que estas rutas sigan formando parte del flujo de producto.

`POST /api/ai-billing/record-usage` recibe del cliente `provider`, `model`, `inputTokens` y `outputTokens`, y esos valores pasan directamente al cálculo de factura. No se observa en este flujo una comprobación contra la telemetría del proveedor que demuestre el consumo real. Un cliente puede declarar menos tokens que los usados en una llamada externa, o registrar consumos que no corresponden a una ejecución del servicio.

**Referencias:**

- [api/routes/ai-billing.js](../../api/routes/ai-billing.js#L61)
- [api/services/aiBillingService.js](../../api/services/aiBillingService.js#L16)

**Acción recomendada:** medir el consumo desde el servidor que llama al modelo o validar un identificador de ejecución interno, firmado e idempotente. No usar cantidades de tokens enviadas por el navegador como fuente de facturación.

## Hallazgos de rentabilidad y producto

### R1 — Costes de OPERANT distintos entre el código y la documentación

El cálculo ejecutado desde la configuración actual del backend produce estos costes máximos mensuales estimados, con el peor mix permitido y el anclaje incluido:

| Plan | Coste máximo según backend | Precio del módulo en documentación | Margen bruto implícito del backend | Coste máximo según documentación | Margen publicado |
|---|---:|---:|---:|---:|---:|
| Creator Pro | 30,56 € | 39 € | 21,6 % | 36,14 € | 7,3 % |
| Business | 198,18 € | 249 € | 20,4 % | 237,24 € | 4,7 % |
| Enterprise VIP | 1.018,98 € | 1.199 € | 15,0 % | 1.186,38 € | 1,1 % |

Los valores proceden de ejecutar `worstCaseMonthlyCost` en `api/config/operant-services.js` y compararlos con la tabla de `docs/OPERANT_SUBAPP.md`. Ambos modelos indican margen positivo a cuota completa, pero la diferencia entre ellos es sustancial y dificulta fijar precios y evaluar el riesgo de cambios de tarifas o del uso real.

**Referencias:**

- [api/config/operant-services.js](../../api/config/operant-services.js#L310)
- [api/config/usage-pricing.js](../../api/config/usage-pricing.js#L16)
- [docs/OPERANT_SUBAPP.md](../OPERANT_SUBAPP.md#L113)

**Acción recomendada:** establecer una sola fuente de verdad para costes, cuotas y precios. Añadir a la revisión comercial los costes reales de inferencia, almacenamiento, red, soporte, Stripe y operación. Fijar un margen bruto mínimo y ajustar cuota, precio o límites para cumplirlo en el peor caso, no solo con un promedio.

### R2 — El anclaje continuo concentra costes evitables

El modo continuo define 8.640 anclajes al mes. A 0,012 € por operación en la configuración actual, representa **103,68 €/mes** antes de considerar otros costes de operación.

**Referencias:**

- [api/config/operant-services.js](../../api/config/operant-services.js#L102)
- [api/config/usage-pricing.js](../../api/config/usage-pricing.js#L49)

**Acción recomendada:** ofrecer el anclaje continuo como capacidad premium con precio propio y conservar frecuencias horarias o diarias en planes estándar. Medir el coste real en producción y agrupar lotes cuando el requisito de auditoría lo permita.

### R3 — Los modelos de coste dependen de perfiles estimados

OPERANT usa un perfil de tokens de referencia y emplea datos medidos únicamente cuando el runtime devuelve atribución exacta. En los demás casos aplica el perfil estimado. Eso es útil como aproximación, pero puede infravalorar trabajos con contexto grande, especialistas adicionales o respuestas largas.

**Referencias:**

- [api/config/operant-services.js](../../api/config/operant-services.js#L20)
- [api/services/operantUsage.js](../../api/services/operantUsage.js#L138)

**Acción recomendada:** poner límites de entrada, contexto, salida y especialistas; registrar tokens por tarea; comparar semanalmente coste estimado con coste real del proveedor; y actualizar tarifas, cuotas y precios a partir de esos datos.

## Plan de implementación propuesto

### P0 — Cerrar fugas de facturación

- [ ] Determinar si `/api/ai-billing/*` sigue siendo necesario y qué cuentas pueden autenticarse en ese sistema heredado.
- [ ] Deshabilitar temporalmente `/subscribe` y `/pay-invoice` si no se pueden respaldar con pago verificado.
- [ ] Activar suscripciones solo a partir de eventos Stripe verificados o recibos on-chain confirmados.
- [ ] Cambiar el flujo Starter de OPERANT para exigir una prueba o suscripción de uso válida antes de ejecutar.
- [ ] Reservar el coste antes de lanzar trabajo PAYG; mantener una clave de idempotencia por tarea para reintentos.

### P1 — Hacer cuotas y conciliación fiables

- [ ] Reservar cuota de OPERANT en una operación atómica antes de ejecutar, con límites mensual y frontier.
- [ ] Conciliar tareas ejecutadas contra el ledger y los eventos de Stripe con reintentos idempotentes.
- [ ] Evitar que tokens enviados por el cliente sean la fuente de facturación.
- [ ] Poner topes duros a tokens, contexto, duración y número de especialistas por tarea.

### P2 — Mejorar margen y empaquetado

- [ ] Unificar el cálculo de costes del backend y la documentación comercial.
- [ ] Definir un margen bruto mínimo por plan con el consumo máximo previsto.
- [ ] Separar el anclaje continuo como complemento premium.
- [ ] Instrumentar coste real por cliente, plan, modelo, departamento y tipo de anclaje.
- [ ] Reducir el coste con selección de modelo por tarea, caché de contexto y límites de uso; mantener revisión humana donde el riesgo lo requiera.
- [ ] Concentrar ventas en uno o dos casos B2B con disposición de pago demostrable, cobrar integraciones y convertir pilotos en contratos recurrentes.

## Notas de revisión

- Revisión estática; no se ejecutaron pruebas ni escáneres de dependencias.
- No se revisaron exhaustivamente todos los contratos Solidity, frontends, SubApps, configuración cloud ni dependencias.
- `.env` no aparece versionado en Git; hay archivos locales ignorados. No se leyeron sus valores.
