# Guardrails — lo que hace el producto vendible y legalmente defendible

Un sistema que "cierra deals" y "gestiona personal" de forma autónoma es un riesgo legal
si no tiene frenos. Los guardrails NO son una limitación: son la característica que permite
venderlo.

## Las líneas rojas (`src/guardrails/RedLines.js`)

Acciones que **ningún agente ejecuta sin un humano**, sin excepción:

| Línea roja | Ejemplos |
|---|---|
| Mover dinero | pagos, transferencias, reembolsos |
| Comprometer legalmente | firmar contratos, aceptar términos |
| Decisiones de empleo | contratar, despedir, evaluar desempeño |
| Comunicación pública vinculante | publicar en nombre de la empresa |
| Envío masivo | outbound a > 50 destinatarios (riesgo spam) |
| Mover activos on-chain | transferir BEZ-Coin, tesorería/DAO, staking, operaciones de wallet |
| Cambiar un smart contract | deploy, upgrade, pausa de emergencia, cambio de rol/admin |

## Nota BeZhas: tesorería y contratos

BeZhas opera contratos y wallets reales en producción (BEZ-Coin, Treasury DAO,
QualityEscrow, Hot Wallet — ver direcciones en `config/business/bezhas.json` →
`onchainAssets`). Ningún agente (Finanzas, Operaciones o cualquier otro) puede
iniciar una transferencia, staking, deploy o upgrade sin que un humano apruebe
la acción vía HITL — igual que el dinero fiat, pero además cubierto por las
líneas rojas `crypto_asset_movement` y `smart_contract_change`.

## Cómo funciona el freno

Cuando un agente llama `this.act(action)`:

1. `PolicyEngine.evaluate()` comprueba las líneas rojas universales + la política del tenant.
2. Si cruza una línea roja → devuelve `requiresApproval` → emite `hitl:required`.
3. `HITLGate` notifica al humano (panel/Telegram) y **pausa** la acción.
4. El humano aprueba/rechaza desde la API → la acción se ejecuta o se descarta.
5. Todo queda en `AuditLog` (quién, qué, cuándo, resultado).

### Timeout y escalado (opcional, `HITL_TIMEOUT_MS`/`HITL_ESCALATE_AFTER_MS`)

Por defecto la espera es indefinida (mismo comportamiento de siempre). Si se
configuran ambas variables (ver `.env.example`):

- A los `HITL_ESCALATE_AFTER_MS` sin respuesta, se manda un **segundo aviso**
  siempre al bot de fallback (un nivel por encima del canal original) — la
  espera sigue viva, no se cancela nada todavía.
- A los `HITL_TIMEOUT_MS` sin respuesta, la acción se **cancela sola** (equivale
  a un rechazo, `timedOut: true` en el resultado) — nunca se ejecuta por
  silencio.
- Si el humano decide de todos modos DESPUÉS de que ya se canceló (o dos
  canales resuelven la misma aprobación por una carrera), esa decisión tardía
  no se pierde: queda auditada como `hitl:late-decision`, aunque ya no cambie
  lo ya ejecutado. "Nada desaparece en silencio" sigue siendo el principio,
  también cuando el silencio viene del propio humano.

## RR.HH. y Finanzas: nota especial

Los managers de RR.HH. y Finanzas están diseñados para **asistir, no decidir**:
- RR.HH. filtra CVs y agenda, pero contratar/despedir/evaluar lo decide un humano
  (riesgo legal y de sesgo algorítmico).
- Finanzas concilia y reporta, pero nunca mueve fondos solo.

## Audit log encadenado por hash (policy-as-code auditable)

Desde la Fase 3 del [Plan Parte 3](../../Plan%20Parte%203%20-%20Frameworks%20B2B%20y%20Optimizacion.md),
`PolicyEngine.evaluate()` audita **cada** decisión (`allowed`/`blocked`/`requires_approval`),
no solo las que llegan a HITL — antes, una acción bloqueada por política del
tenant desaparecía sin dejar rastro. Cada registro incluye `rule` (qué línea
roja u override concreto decidió) y `reason`. Los cambios de política
(`setOverride`/`removeOverride`) también quedan auditados con `actor` (quién)
y `previous` (qué había antes).

`AuditLog` (`src/guardrails/AuditLog.js`) encadena los registros por hash
(estilo blockchain ligero: cada uno incluye el hash del anterior, empezando
en génesis `'0'.repeat(64)`). Un `INSERT`-only en la base de datos evita que
la app edite un registro por accidente, pero no evita que alguien con acceso
directo a las filas reescriba una sin dejar huella — el encadenamiento sí lo
hace detectable: `GET /tenants/:id/audit/verify` recalcula la cadena entera
desde el store y señala el punto exacto si algo no cuadra. Pensado para poder
enseñárselo a un inversor o auditor como prueba, no solo como un log más.

`AuditLog.hydrate()` (llamado en `TenantManager.provision()`) recupera el
hash del último registro persistido para que la cadena continúe tras un
reinicio en vez de reiniciarse a génesis cada vez.

## Autonomy dial del Escuadrón de Ventas (`src/platform/SalesAutonomy.js`)

Paridad con las plataformas de AI SDR (Artisan/11x): cuánto delega el tenant
en el agente, sin tocar código. Es un PRESET de overrides sobre el mismo
mecanismo de arriba — `manual` exige aprobación para cualquier envío cálido,
agendar reunión o escribir en el CRM; `assist` (por defecto) solo exige
aprobación para el envío; `full_auto` no añade nada. **Nunca** toca las
líneas rojas: el envío en frío (`cold_outbound`), un pago, un contrato o un
descuento fuerte siguen pidiendo aprobación humana en cualquier nivel,
incluido `full_auto` — el dial decide autonomía discrecional, no bypassa
compliance.

Overrides por MÉTODO, no solo por categoría: `PolicyEngine` acepta claves
`categoria:metodo` (p.ej. `calendar:scheduleMeeting`) que ganan a la categoría
entera (`calendar`). Sin esto, endurecer "agendar" también habría endurecido
"consultar disponibilidad" (misma categoría `calendar`, pero un método de
solo lectura) — el dial gatea la escritura, nunca la lectura que la precede.

API: `GET/PUT /tenants/:id/sales/autonomy` (body `{level}`, uno de `manual`/`assist`/`full_auto`).

## Lista de "no contactar" (`src/platform/DoNotContactList.js`)

Complementa los `excludedAccounts`/`excludedTags` fijos de `BusinessProfile`
(vienen del perfil de negocio, config estática): esta lista la gestiona el
tenant en caliente — por empresa (substring, igual que `isExcluded`) o por
dominio de email — sin tocar config. La consultan `OutreachAgent` y
`FollowUpAgent` ANTES de redactar (ni se gasta una llamada al modelo en un
lead vetado) y el bloqueo pasa por `PolicyEngine.evaluate()` para quedar
auditado igual que cualquier otra decisión.

API: `GET/POST /tenants/:id/sales/do-not-contact`, `DELETE .../do-not-contact/:key`.

## Endurecer por tenant

Un cliente puede pedir reglas más estrictas (nunca más laxas) vía `overrides`:

```js
new PolicyEngine({
  tenantId: 'acme',
  plan: 'pro',
  overrides: { outbound: 'always_approve' }, // todo outbound requiere visto bueno
});
```
