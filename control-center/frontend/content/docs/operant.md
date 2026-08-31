# OPERANT — gestión empresarial autónoma

OPERANT pone 10 departamentos de agentes IA a trabajar dentro de tu empresa —
ventas, soporte, marketing, finanzas, RRHH, operaciones, legal, blockchain ops,
tesorería y fundraising — y deja constancia de **cada decisión que toman** en una
cadena de auditoría anclada en BeZhas L2.

Es una SubApp del ecosistema: se activa sobre tu suscripción, se usa con la misma
api-key que el resto del Gateway y se factura en la misma línea de consumo. No
hay contrato aparte ni credenciales nuevas que gestionar.

## Cómo empezar

Activa la SubApp sobre tu suscripción, aprovisiona tu espacio y lanza la primera
tarea. Tres llamadas.

```bash
# 1. Activar OPERANT en tu suscripción
curl -X POST https://api.bez.digital/api/gateway/v1/subscription/activate \
  -H "x-api-key: $BEZHAS_API_KEY" \
  -H "content-type: application/json" \
  -d '{"subapp":"operant"}'

# 2. Aprovisionar tu espacio (los límites salen de tu plan)
curl -X POST https://api.bez.digital/api/operant/tenants/provision \
  -H "x-api-key: $BEZHAS_API_KEY"

# 3. Lanzar una tarea
curl -X POST https://api.bez.digital/api/operant/tasks \
  -H "x-api-key: $BEZHAS_API_KEY" \
  -H "content-type: application/json" \
  -d '{"department":"support","input":"El cliente ACME reclama la factura de marzo"}'
```

Con el SDK:

```js
import { BeZhasConnect } from '@bezhas/connect';

const bezhas = new BeZhasConnect({ apiKey: process.env.BEZHAS_API_KEY });
const operant = bezhas.service('operant');

await operant.call('provision');

const r = await operant.call('run', {
  department: 'sales',
  input: 'Prepara una propuesta para ACME, sector logística, 40 camiones',
});

console.log(r.output);    // el entregable
console.log(r.billing);   // { billedAs: 'quota', credits: 197, ... }
console.log(r.auditHash); // su registro en la cadena de auditoría
```

## Los 10 departamentos

| Departamento | Qué hace |
| --- | --- |
| **Ventas** | Prospección y scoring de leads, secuencias de outreach, negociación asistida, propuestas |
| **Soporte** | Triaje de tickets, base de conocimiento, resolución automática, escalado y CSAT |
| **Marketing** | Contenido y copy, SEO, cola social con aprobación, tests A/B |
| **Finanzas** | Facturación y cobros, previsión de tesorería, categorización de gasto, conciliación, desembolso en $BEZ |
| **RRHH** | Cribado de CV con redacción de datos personales, agenda de entrevistas, onboarding, asesoría laboral |
| **Operaciones** | Coordinación de proyectos, compras, reposición de inventario, informes |
| **Legal / Compliance** | Revisión de contratos, asesoría regulatoria (MiCA, DAC8, GDPR), checklist DPIA, screening de sanciones |
| **Blockchain Ops** | Monitor on-chain, optimizador de gas, vigilancia de slashing, compliance on-chain |
| **Tesorería** | Runway y escenarios, tokenomics, vesting, gestión de liquidez |
| **Fundraising** | Scoring de inversores, outreach a fondos, cap table, data room |

Los departamentos que mueven activos, tocan datos personales o comprometen
legalmente (Finanzas, RRHH, Legal, Blockchain Ops, Tesorería, Fundraising)
**siempre** piden aprobación humana en esas acciones, sea cual sea tu plan y tu
nivel de autonomía. No es configurable a propósito.

## Qué incluye cada plan

|  | Starter | Creator Pro | Business | Enterprise VIP |
| --- | --- | --- | --- | --- |
| **Precio del módulo** | pago por uso | 39 €/mes | 249 €/mes | 1.199 €/mes |
| **Departamentos** | Ventas, Soporte | +Marketing, Finanzas | +RRHH, Operaciones, Legal, Blockchain Ops | los 10 |
| **Tareas incluidas/mes** | pago por uso | 300 | 2.000 | 9.000 |
| **Tareas simultáneas** | 1 | 3 | 8 | 25 |
| **Peticiones/min** | 60 | 300 | 1.200 | 6.000 |
| **Autonomía** | borrador | asistida | autónoma | gobernada por DAO |
| **Auditoría anclada** | — | semanal | diaria | continua |
| **Historial** | 30 días | 180 días | 2 años | 7 años |

### Niveles de autonomía

| Nivel | Qué significa |
| --- | --- |
| **Borrador** | Los agentes preparan, nunca envían. Todo queda esperando tu visto bueno. |
| **Asistida** | Envían lo de riesgo bajo (responder un ticket, publicar un borrador aprobado); el resto pasa por ti. |
| **Autónoma** | Actúan salvo línea roja: mover activos, dato personal o compromiso legal siguen pidiendo aprobación. |
| **Gobernada** | Autónoma, y además las políticas de los agentes se cambian por votación en BeZhasDAO, no por configuración. |

### Capacidades on-chain

| Capacidad | Desde | Qué te da |
| --- | --- | --- |
| Auditoría encadenada | Starter | Cada decisión enlazada por hash: alterar una rompe la cadena y se ve. |
| Anclaje en L2 | Creator Pro | La raíz de tu auditoría, en la cadena y con fecha. Prueba ante due diligence. |
| Recompensas en $BEZ | Creator Pro | El consumo de OPERANT acumula staking al APY de tu plan. |
| Pagos en $BEZ | Business | Paga proveedores desde la wallet de dispersión (siempre con aprobación humana). |
| Certificados NFT | Business | Entregables y cierres de auditoría emitidos como NFT verificable. |
| Aprobaciones on-chain | Business | Quién aprobó qué y cuándo, firmado y registrado. |
| Políticas por DAO | Enterprise VIP | Las reglas de los agentes se votan, no se configuran. |
| Edge Node dedicado | Enterprise VIP | Inferencia y datos dentro de tu propia infraestructura. |

## Qué se factura

Una **tarea** no es una llamada a un modelo: es un trabajo completo — el manager
del departamento enruta, los especialistas ejecutan, los guardarraíles revisan y
todo queda escrito en la auditoría.

OPERANT se activa como módulo sobre tu suscripción, y su precio **incluye la
cuota de tareas de tu plan**. Sale más barato que comprar esas mismas tareas
sueltas:

| Plan | Módulo | Tareas incluidas | Comprarlas sueltas costaría | Ahorras |
| --- | --- | --- | --- | --- |
| Creator Pro | 39 €/mes | 300 | 45,11 € | −14 % |
| Business | 249 €/mes | 2.000 | 296,08 € | −16 % |
| Enterprise VIP | 1.199 €/mes | 9.000 | 1.353,30 € | −11 % |

En Starter no hay módulo que pagar: cada tarea se factura desde la primera, sin
cuota ni cuota fija.

Por encima de la cuota, las tareas se facturan por créditos al precio del pago
por uso:

| Tipo de tarea | Departamentos | Precio por tarea |
| --- | --- | --- |
| **Frontier** | Ventas, Marketing, Fundraising | 0,1969 € |
| **Estándar** | los otros 7 | 0,1271 € |

Las tareas *frontier* usan el modelo más capaz porque su salida la lee un cliente
tuyo: una propuesta comercial o un email a un inversor no admiten el mismo motor
que un informe interno.

Unidad de facturación: **1 crédito = 0,001 €**. Es el mismo crédito que el resto
del Gateway, así que tu factura lleva una sola línea de consumo.

> **Sobre la cuota.** Los planes de pago traen un tope de tareas *frontier*
> dentro de la cuota (100 en Creator Pro, 600 en Business, 3.000 en Enterprise
> VIP). Al agotarlo, los departamentos estándar siguen entrando en cuota con
> normalidad; las frontier pasan a pago por uso.
>
> **Por qué el módulo cuesta distinto en cada plan.** Los demás módulos del
> catálogo abren un endpoint y ya está. OPERANT ejecuta agentes: cada tarea
> consume cómputo real, y lo que cambia entre planes es cuántas trae incluidas.
> Un precio plano habría significado cobrar de más en Creator Pro o regalar el
> cómputo en Enterprise.

Consulta tu consumo en cualquier momento:

```bash
curl https://api.bez.digital/api/operant/usage -H "x-api-key: $BEZHAS_API_KEY"
```

```json
{
  "planId": "business",
  "quota":   { "includedTasks": 2000, "usedTasks": 418, "remainingTasks": 1582,
               "frontierCap": 600, "frontierUsed": 96 },
  "overage": { "tasks": 0, "credits": 0, "eur": 0 },
  "byDepartment": [{ "department": "support", "tasks": 240, "credits": 30720 }]
}
```

Si agotas la cuota y no tienes el pago por uso activado, la siguiente tarea
responde `402` en vez de ejecutarse. Preferimos frenarte a cobrarte algo que no
esperabas.

## Aprobaciones humanas

Cuando un agente topa con una línea roja, la acción queda retenida y aparece en
la cola. Nada sale hasta que un humano decide.

```js
const { approvals } = await operant.call('approvals');

await operant.call('resolveApproval', {
  approvalId: approvals[0].id,
  decision: 'approve',
  reason: 'Importe dentro del presupuesto de marzo',
});
```

Con `onchainHitl` (Business en adelante), esa decisión queda firmada y entra en
la auditoría anclada: se puede demostrar después quién aprobó qué.

## Auditoría demostrable

Cada decisión de cada agente entra en un registro encadenado por hash. Eso hace
que una alteración sea **detectable**, pero solo para quien tenga la cadena
entera — o sea, nosotros. Y "nuestro log dice que no lo hemos tocado" no es una
prueba para tu auditor.

Por eso la raíz de cada tramo se ancla en BeZhas L2. Ahí la prueba deja de
depender de nosotros y pasa a tener fecha en una cadena pública.

```bash
# Ancla el tramo pendiente
curl -X POST https://api.bez.digital/api/operant/audit/anchor \
  -H "x-api-key: $BEZHAS_API_KEY"

# Comprueba la integridad de tu cadena y sus anclas
curl https://api.bez.digital/api/operant/audit/verify \
  -H "x-api-key: $BEZHAS_API_KEY"

# Demuestra un registro concreto contra su ancla
curl https://api.bez.digital/api/operant/audit/proof/$AUDIT_HASH \
  -H "x-api-key: $BEZHAS_API_KEY"
```

Dos detalles que te interesan:

- **Tus datos no salen para notarizarlos.** Lo que se ancla son hashes, nunca el
  contenido. Los correos, los leads y los CV se quedan en tu espacio; la prueba
  criptográfica viaja sola.
- **La prueba de inclusión es verificable por tu cuenta.** El endpoint de prueba
  te devuelve la hoja y la ruta merkle; puedes validarlas contra el contrato
  on-chain sin pasar por nosotros. Que es justo lo que hace que sirva de prueba.

## Referencia de la API

Todo bajo `/api/operant`, autenticado con tu api-key del Gateway (`x-api-key`).

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `GET` | `/catalog` | Catálogo de departamentos y tarifas (público) |
| `GET` | `/health` | Estado del runtime de agentes |
| `GET` | `/entitlements` | Qué desbloquea tu plan |
| `GET` | `/departments` | Departamentos disponibles y precio por tarea |
| `POST` | `/tenants/provision` | Alta o reconfiguración de tu espacio |
| `GET` | `/tenants/me` | Tu configuración actual |
| `POST` | `/tasks` | Lanza una tarea a un departamento |
| `GET` | `/tasks/:taskId` | Estado, salida y coste de una tarea |
| `GET` | `/approvals` | Cola de aprobaciones pendientes |
| `POST` | `/approvals/:approvalId` | Aprueba o rechaza |
| `GET` | `/usage` | Cuota, excedente y consumo del ciclo |
| `POST` | `/audit/anchor` | Ancla el tramo de auditoría pendiente |
| `GET` | `/audit/verify` | Integridad de la cadena y sus anclas |
| `GET` | `/audit/proof/:hash` | Prueba de inclusión de un registro |

`GET /entitlements` funciona aunque no tengas OPERANT activado: devuelve qué te
daría activarlo, para que puedas decidir sin llamadas a comercial.

## Errores que verás

| Código | Qué pasó | Qué hacer |
| --- | --- | --- |
| `403 SUBAPP_NOT_ACTIVATED` | OPERANT no está en tu suscripción | `POST /api/gateway/v1/subscription/activate` |
| `403 DEPARTMENT_NOT_IN_PLAN` | Ese departamento no entra en tu plan | La respuesta te dice a qué planes sí |
| `409 TENANT_NOT_PROVISIONED` | Falta aprovisionar tu espacio | `POST /api/operant/tenants/provision` |
| `402 QUOTA_EXHAUSTED` | Cuota agotada y sin pago por uso | Activa el pago por uso o espera al ciclo |
| `403 ANCHOR_NOT_IN_PLAN` | Tu plan no incluye anclaje on-chain | Disponible desde Creator Pro |
| `503` | El runtime de agentes no responde | Reintenta; no se te cobra nada |

## Preguntas frecuentes

**¿Los agentes pueden mover dinero sin que yo lo sepa?**
No. Cualquier movimiento de activos es línea roja y pasa por aprobación humana en
todos los planes, incluido Enterprise VIP con autonomía gobernada.

**¿Puedo empezar sin comprometerme?**
Sí. Starter da 15 días gratis y después solo pagas las tareas que lances, sin
módulo ni cuota fija. Cuando el volumen compense, activar el módulo del plan te
sale entre un 11 % y un 16 % más barato que seguir pagando tarea a tarea.

**¿Qué pasa con mis datos si me doy de baja?**
El historial se conserva según la retención de tu plan y después se elimina. Las
anclas on-chain permanecen — son hashes, no contenido, y son tu prueba de lo que
ocurrió.

**¿Puedo usar OPERANT desde mi ERP?**
Sí. `@bezhas/connect` tiene clientes en JavaScript, Python, Java y .NET, y
adaptadores para WooCommerce, SAP y Odoo. Ver [SDK e integraciones](/docs/sdk-integraciones).
