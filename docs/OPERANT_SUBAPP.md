# OPERANT como SubApp de BeZhas

OPERANT (gestión empresarial autónoma: 10 departamentos de agentes IA) se sirve
por el Gateway de BeZhas y forma parte de las suscripciones del ecosistema.

> Las cifras de este documento salen de `api/config/operant-services.js` y
> `api/config/usage-pricing.js`. Si cambian los precios de Anthropic o las
> cuotas, se regeneran solas — y los tests de
> `api/__tests__/config/operant-services.test.js` fallan si el margen de un plan
> baja del 50%.

---

## 1. Reparto de responsabilidades

| | BeZhas (`api/`) | OPERANT (`business-ops/`) |
|---|---|---|
| Identidad | api-key del Gateway (`app_registry`) | — |
| Entitlements y plan | sí (`middleware/subapp-entitlement.js`) | — |
| Cuota y facturación | sí (`services/operantUsage.js`) | — |
| Ejecución de agentes | — | sí |
| Cadena de auditoría | ancla la raíz merkle en L2 | genera y encadena los registros |

El cliente **nunca** habla con OPERANT. Se autentica contra el Gateway con su
api-key de siempre; BeZhas decide si tiene derecho, cuánto cuesta y lo apunta, y
solo entonces llama al puente interno (`/bridge`, protegido con
`OPERANT_INTERNAL_KEY`).

---

## 2. Qué ofrece cada plan

| | Starter | Creator Pro | Business | Enterprise VIP |
|---|---|---|---|---|
| **Plan** (sin IVA) | 0 €/mes · pago por uso | 99 €/mes | 499 €/mes | 2.499 €/mes |
| **Módulo OPERANT** | — (pago por uso) | +39 €/mes | +249 €/mes | +1.199 €/mes |
| **Departamentos** | Ventas, Soporte | +Marketing, Finanzas | +RRHH, Operaciones, Legal, Blockchain Ops | +Tesorería, Fundraising (los 10) |
| **Tareas incluidas/mes** | 0 (todo por uso) | 300 | 2.000 | 9.000 |
| **Tope de tareas *frontier*** | — | 100 | 600 | 3.000 |
| **Tareas simultáneas** | 1 | 3 | 8 | 25 |
| **Peticiones/min** | 60 | 300 | 1.200 | 6.000 |
| **Autonomía** | `draft` — todo queda en borrador | `assisted` — envía riesgo bajo | `autonomous` — envía salvo línea roja | `governed` — + políticas votadas en la DAO |
| **Anclaje de auditoría** | ninguno | semanal | diario | continuo (lotes de 5 min) |
| **Retención** | 30 días | 180 días | 2 años | 7 años (mercantil ES) |
| **Prueba gratis** | 15 días | — | — | — |

### Capacidades on-chain (acumulativas)

| Capacidad | Desde | Qué es |
|---|---|---|
| `auditChainLocal` | Starter | Auditoría encadenada por hash (SHA-256), verificable off-chain |
| `auditAnchor` | Creator Pro | Raíz merkle anclada en L2: prueba inmutable ante due diligence |
| `bezRewards` | Creator Pro | El consumo acumula staking en $BEZ al APY del plan (18,75 % / 25 % / 31,25 %) |
| `bezSettlement` | Business | Pago a proveedores en $BEZ desde la wallet de dispersión (siempre con HITL) |
| `nftCertificates` | Business | Entregables y cierres de auditoría emitidos como NFT verificable |
| `onchainHitl` | Business | Las aprobaciones humanas quedan firmadas y registradas on-chain |
| `daoPolicies` | Enterprise VIP | Las políticas de los agentes se cambian por votación en BeZhasDAO |
| `dedicatedEdgeNode` | Enterprise VIP | Inferencia y datos dentro de la infraestructura del cliente |

---

## 3. Coste y precio de una tarea

Una **tarea** no es una llamada al LLM: es una orquestación (el manager enruta →
N especialistas ejecutan → guardarraíles + escritura en la auditoría). El perfil
medido es ≈ 15.000 tokens de entrada / 3.000 de salida.

Los departamentos cuya salida lee un cliente real corren en Opus (`frontier`);
el trabajo interno, en Sonnet (`mid`).

| Tier | Departamentos | Modelo | Llamadas IA | Coste real | Precio (+25 %) | Créditos |
|---|---|---|---|---|---|---|
| `frontier` | Ventas, Marketing, Fundraising | `claude-opus-4-8` | 3 | 0,1575 € | **0,1969 €** | 197 |
| `mid` | los otros 7 | `claude-sonnet-5` | 2 | 0,1017 € | **0,1271 €** | 128 |

Desglose de los 0,1575 € de una tarea frontier:

| Concepto | € |
|---|---|
| Claude (15k in / 3k out en Opus, USD→EUR 0,93) | 0,1395 |
| Cómputo BeZhas (`operant_task`: orquestación, memoria vectorial, guardarraíles, auditoría) | 0,0180 |
| **Coste** | **0,1575** |
| Margen +25 % | 0,0394 |
| **Precio** | **0,1969** |

Unidad de facturación: **1 crédito = 0,001 €**, redondeando siempre hacia arriba
(nunca se factura por debajo del coste). Es el mismo crédito que el resto del
Gateway, así que el cliente ve una sola línea de consumo en su factura de Stripe.

### Costes auxiliares (`api/config/usage-pricing.js`)

| Acción | € |
|---|---|
| `operant_task` | 0,0180 |
| `operant_specialist` (especialista extra) | 0,0060 |
| `operant_anchor` (una tx merkle por lote) | 0,0120 |
| `operant_approval` (resolver un HITL) | 0,0008 |

---

## 3.bis Precio del módulo — cómo se fijó

OPERANT es el único módulo del catálogo con coste marginal grande: su precio
**incluye la cuota de tareas del plan**, y servirla cuesta cómputo real. Por eso
el precio va por plan (la cuota va por plan) y no es comp-able con los slots
gratis del bundle.

Cada precio está dentro de una ventana con dos bordes duros:

- **suelo** = coste de servir la cuota entera (consumo 100 %)
- **techo** = lo que costaría comprar esa misma cuota suelta a pago por uso

| Plan | Suelo | Techo | Precio | Ahorro cliente | Margen @45 % | @85 % | @100 % |
|---|---|---|---|---|---|---|---|
| Creator Pro | 36,14 € | 45,11 € | **39 €** | −13,5 % | 58,3 % | 21,2 % | 7,3 % |
| Business | 237,24 € | 296,08 € | **249 €** | −15,9 % | 57,1 % | 19,0 % | 4,7 % |
| Enterprise VIP | 1.186,38 € | 1.353,30 € | **1.199 €** | −11,4 % | 55,5 % | 15,9 % | 1,1 % |

Por debajo del suelo se pierde dinero justo con el cliente que más usa el
producto; por encima del techo al cliente le sale mejor no activarlo y pagar por
uso, y el módulo no se vende. Los tres precios dejan margen positivo **incluso a
consumo del 100 %**, que es el escenario que hunde a los productos de IA con
precio plano.

⚠️ **`alwaysBilled` no es opcional.** Antes de esa marca, el bundle comp-aba los
N módulos más caros: un Business con 3 slots libres activaba OPERANT y la
plataforma servía hasta 1.186 €/mes de cómputo facturando 0 €. Ver
`App-nativas/Bezhas-Hub/frontend/src/config/pricing.js`.

Guardas: `src/config/pricing.test.js` (comportamiento del calculador) y
`src/config/operant-subapp.test.js` (el precio no se sale de la ventana, y el
espejo público no se separa del catálogo del backend).

---

## 4. Por qué las cuotas son las que son

OPERANT no consume la bolsa de `aiActions` del plan, que es común a todo el
ecosistema: una tarea frontier vale por 3 acciones, así que un cliente que solo
usara OPERANT dejaría a cero al resto de SubApps.

Las cuotas están dimensionadas para conservar **≥ 50 % de margen bruto en el peor
mix posible** (agotar el tope frontier y gastar el resto en mid):

| Plan | Precio | Coste máximo | Margen |
|---|---|---|---|
| Creator Pro | 99 € | 36,14 € | **63,5 %** |
| Business | 499 € | 237,24 € | **52,5 %** |
| Enterprise VIP | 2.499 € | 1.186,38 € | **52,5 %** |

Enterprise incluye 9.000 tareas y no 10.000 porque el anclaje continuo son 8.640
tx/mes ≈ 104 €/mes: con 10.000 el margen caía por debajo del 50 %.

### Al agotar la cuota

La tarea se factura por créditos al precio del pago por uso. Si la app **no
tiene un customer de Stripe** al que cobrar, la respuesta es `402` con
instrucciones — no se ejecuta y no se regala:

```json
{ "error": "Agotadas las 300 tareas incluidas en el plan creator_pro…",
  "code": "QUOTA_EXHAUSTED",
  "activate": "POST /api/gateway/v1/subscription/starter/subscribe" }
```

### Medido vs estimado

OPERANT mide tokens **por tenant**, no por tarea. Con una sola tarea en vuelo el
delta es atribuible y llega marcado `attribution: "exact"`: se factura lo medido.
Con varias en paralelo el delta mezcla trabajos y llega `"shared"`: se descarta y
se usa el perfil estimado, que es el **suelo** del coste. La respuesta lo dice
(`billing.basis: "medido" | "estimado"`) y la fila del ledger también.

---

## 5. API

Todo bajo `/api/operant`, con la api-key del Gateway (`x-api-key`).

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/catalog` | Catálogo y tarifas (público) |
| `GET` | `/health` | Estado del runtime de agentes |
| `GET` | `/entitlements` | Qué desbloquea el plan de la app (**no** gateado: sirve el upsell) |
| `GET` | `/departments` | Departamentos disponibles + precio por tarea |
| `POST` | `/tenants/provision` | Alta/reconfiguración del tenant con los límites del plan |
| `GET` | `/tenants/me` | Configuración del tenant |
| `POST` | `/tasks` | Lanza una tarea a un departamento |
| `GET` | `/tasks/:taskId` | Estado, salida y coste |
| `GET` | `/approvals` | Cola de aprobaciones humanas |
| `POST` | `/approvals/:approvalId` | Aprueba o rechaza |
| `GET` | `/usage` | Cuota, overage y coste del ciclo |
| `POST` | `/audit/anchor` | Ancla en L2 la raíz merkle del tramo pendiente |
| `GET` | `/audit/verify` | Integridad de la cadena + anclas on-chain |
| `GET` | `/audit/proof/:auditHash` | Prueba de inclusión de un registro |

Desde el SDK (`@bezhas/connect`):

```js
const operant = bezhas.service('operant');
await operant.call('provision');
const r = await operant.call('run', { department: 'sales', input: 'Prepara una propuesta para ACME' });
console.log(r.billing);   // { billedAs: 'quota', credits: 197, basis: 'medido', … }
```

---

## 6. Auditoría anclada

`AuditLog` de OPERANT encadena cada decisión con el hash de la anterior, lo que
hace **detectable** una alteración — pero solo para quien tenga la cadena entera,
que es el propio proveedor. Anclar la raíz merkle del tramo mueve la prueba fuera
de su alcance, y con fecha.

Detalles que importan:

- OPERANT devuelve **hojas** (hashes), nunca registros: el contenido (correos,
  leads, CV) no sale del tenant para notarizarlo. Eso es lo que hace útil el
  esquema merkle.
- **BeZhas recalcula la raíz** sobre esas hojas antes de anclarla. Anclar el
  número que le dan haría el ancla tan fiable como el servicio auditado.
- Contrato: `TelemetryAnchor.sol` (ya desplegado, genérico), con la clave
  `operant:<tenantId>`. Esquema sha256 con **pares ordenados**, idéntico en los
  tres sitios donde vive: `api/services/operantAnchor.js`,
  `src/platform/auditMerkle.js` y `TelemetryAnchor.verify()` en Solidity. Los
  tests cruzan las dos implementaciones JS; si una deriva, saltan.
- Sin RPC/clave configurados el ancla se calcula y se guarda igual con
  `tx_hash` nulo, y se reintenta: la raíz nunca se pierde.

---

## 7. Despliegue

`docker compose up -d` levanta `bezhas-api` y `bezhas-business-ops` (OPERANT) ya
conectados. La misma variable autentica el puente en los dos lados:

| Variable | Servicio | Nota |
|---|---|---|
| `OPERANT_API_URL` | bezhas-api | `http://bezhas-business-ops:4000` |
| `OPERANT_INTERNAL_KEY` | bezhas-api | = `INTERNAL_API_KEY` de OPERANT |
| `INTERNAL_API_KEY` | business-ops | sin ella el puente **no se monta** |
| `OPERANT_OPERATOR_KEY` | bezhas-api | firma las anclas merkle (opcional) |

Si las claves divergen, `/api/operant/*` responde 503 «puente no autorizado».
La migración `043_operant_subapp.sql` crea `operant_tenants`, `operant_tasks` y
`operant_audit_anchors`.
