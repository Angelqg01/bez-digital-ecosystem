# BeZhas Oracle Network (BON) — Protocolo v0.1

> **Estado:** borrador de especificación (2026-11-06). Nada de esto está
> desplegado ni auditado. No se debe anunciar BON como producto, ni a clientes
> ni a inversores, hasta cumplir los criterios de la §11.
>
> **Origen:** la conversación «Analiza Chainlink y BeZhas» (ChatGPT, 05/11/2026)
> dejó tomadas estas decisiones: red **híbrida**, operadores **con permiso**
> (permissioned), primer servicio **logística** y la economía de BEZ-Coin
> **para más adelante**. Esta especificación conserva esas decisiones, pero
> corrige el plan de ingeniería de aquel chat, que proponía partir de cero con
> un repositorio en Go. BeZhas ya tiene la mitad de un oráculo logístico, y
> BON se construye sobre él.

---

## 1. Qué es BON y qué no es

BON es una **capa de evidencia independiente** para hechos que ocurren fuera
de la cadena. Un conjunto de operadores observa un hecho por separado
(«el contenedor X pasó la puerta de la terminal Y a las 10:42»). Cada
operador lo firma y el hecho solo se publica on-chain si **firman k de n
operadores** que no están bajo un mismo control.

**No es:**
- Un competidor generalista de Chainlink. BON no ofrece feeds de precios ni
  mensajería cross-chain en v0.1. Cuando haga falta un precio (por ejemplo
  EUR/USD para calcular aranceles), se consume de Chainlink Data Feeds en
  Polygon (§9).
- Otra plataforma de coordinación portuaria. Socios como NauticOps ya
  coordinan escalas, y BON certifica *algunos* de sus hitos sin
  reemplazarlos.
- Un producto que dependa del token. En v0.1 no se usa BEZ para pagar ni
  como incentivo (§10).

**Problema que resuelve hoy:** cada anclaje on-chain de CargoLink lo firma
**una sola clave**, `CARGOLINK_OPERATOR_KEY`, la del backend de BeZhas
(`api/services/cargoLinkOnChain.js`). Por eso la cadena solo demuestra que
«BeZhas dijo X», no que X ocurrió. BON cambia ese único firmante por un
quórum de operadores independientes.

---

## 2. Lo que ya existe y se reutiliza

| Pieza existente | Archivo | Papel en BON |
|---|---|---|
| Ciclo de vida B-UID (CREATED → … → DELIVERED, con un rol por transición) | `api/services/cargoLinkLifecycle.js` | Define los **tipos de evento** del feed logístico (§4). |
| Validadores deterministas por transición | `api/services/cargoLinkValidators.js` | Es la **regla de validación** que ejecuta cada nodo antes de firmar. |
| Ingesta de terceros con HMAC, ventana temporal y nonce de un solo uso | `api/services/cargoIngestHub.js` | Es la **entrada de fuentes** (navieras, autoridad portuaria, ventanilla única, ChirpStack). |
| Telemetría firmada por los Edge Nodes (ECDSA P-256, ATECC608A/TPM) | `api/services/telemetrySecurity.js` | Hace de **evidencia primaria de dispositivo**: el nodo BON comprueba la firma del sensor. |
| Raíz Merkle de lotes de telemetría (sha256 por pares ordenados) | `api/services/cargoTelemetryAnchor.js` + `smart-contracts/src/supplychain/TelemetryAnchor.sol` | Da el **formato de `evidenceRoot`** (§5.2), sin reinventarlo. |
| Matriz de gravedad de incidencias que bloquea el escrow | `api/services/cargoDisputeOracle.js` | **Consume** BON: una alerta de temperatura certificada alimenta el veredicto. |
| Eventos fuera del ciclo de vida (TX006 custodia, TX010 inspección, TX011 ETA/ruta) | `api/services/cargoLinkEvents.js`, `cargoLinkLifecycle.js` | Son tipos de evento adicionales (§4). |
| Contratos con un solo firmante | `SupplyTracker`, `CustomsClearanceOracle`, `EvidenceVault`, `TelemetryAnchor`, `DeliveryEscrow` | **Consumen** BON: su `OPERATOR_ROLE`/`ORACLE_ROLE` pasa al contrato de BON (§6.4). |
| Clave secp256k1 en HSM (Cloud KMS), ya creada para el paymaster | `docs/La Arquitectura del_Corporate Gas_Tank.md` | Es el patrón de **custodia de claves del operador 1** (BeZhas). |

Despliegues actuales: los oráculos de `src/supplychain`, `src/energy`,
`src/finance` y `EvidenceVault` están en la **L2 de pruebas, chainId 2708**
(`smart-contracts/deployments/2708.json`) y **no** en Polygon 137.
`TelemetryAnchor` no figura en ningún `deployments/*.json`.

---

## 3. Arquitectura

```
 Fuentes                       Operadores BON (4)                     Cadena
 ────────                      ──────────────────                     ──────
 Edge Node (P-256)  ─┐   ┌─> bon-node #1 BeZhas      ─┐
 Ingest hub (HMAC)  ─┼───┼─> bon-node #2 tecnológico ─┼─ firmas EIP-712 ─> BONReportVerifier
 Ventanilla única   ─┤   ├─> bon-node #3 logístico   ─┤   (k = 3)              │
 AIS / terminal     ─┘   └─> bon-node #4 validador   ─┘                        ▼
                                  │                                    BONLogisticsFeed
                                  └─ gossip de observaciones ──┐              │
                                     (mTLS, NATS o HTTP)       │              ▼
                                                     Agregador sin    SupplyTracker /
                                                     permisos (relay) CustomsClearanceOracle /
                                                                      TelemetryAnchor / EvidenceVault /
                                                                      DeliveryEscrow
```

- **bon-node**: un proceso Node.js por operador. Se usa el mismo stack que la
  API para reutilizar los validadores y las funciones de verificación sin
  traducirlos a otro lenguaje. El chat de ChatGPT proponía Go: se descarta en
  v0.1 porque duplicaría lógica crítica en dos lenguajes. Se puede reconsiderar
  si un operador externo lo exige.
- **Relay**: lo puede ejecutar cualquiera, porque no tiene autoridad. Junta
  las firmas y envía el informe. El contrato verifica las firmas, así que un
  relay malicioso no puede falsificar nada: como mucho, retrasar un informe.
- **Control plane**: on-chain (`BONRegistry`). Recoge qué operadores hay,
  sus claves, el umbral y los feeds. No hay un plano de control off-chain
  con autoridad propia.

### 3.1 Modelo de red: híbrido con permisos

| Fase | Operadores | Umbral | Quién aprueba la entrada |
|---|---|---|---|
| v0.1 testnet | 4, de los cuales hasta 3 pueden ser de BeZhas (nodos simulados) | 3 de 4 | Multisig BeZhas |
| v0.2 piloto | 4, **como máximo 1** de BeZhas | 3 de 4 | Multisig + timelock de 48 h |
| v1 | 7 o más, de al menos 4 organizaciones | ⌈2n/3⌉ | Gobernanza (más adelante, posible DAO) |

Regla dura: **mientras BeZhas controle k o más claves, BON no es
independiente** y no se puede presentar como tal. Ver la §12 sobre qué se puede
decir en cada fase.

---

## 4. Feed logístico: tipos de evento

Los identificadores coinciden con los estados de `cargoLinkLifecycle.js` para
que el mapeo sea 1:1.

| `eventType` (bytes32) | Origen en el código | Evidencia mínima para firmar |
|---|---|---|
| `CREATED` | alta del B-UID | Pedido de ERP/TMS (ingest hub) + identidad del cargador |
| `GATE_IN` (TX004) | `logistics` | Evento de terminal (ingest hub) **o** Edge Node con geocerca |
| `CUSTOMS_CLEARED` | `customs` | Levante de la ventanilla única / DUA (hash) |
| `STOWED` | `carrier` | Plan de estiba / confirmación de la naviera |
| `GATE_OUT` (TX005) | `logistics` | Evento de terminal |
| `DEPARTED` | `carrier` | AIS + confirmación de la naviera o el puerto |
| `IN_TRANSIT` | `logistics` | AIS o telemetría firmada |
| `DELIVERED` | `lastmile` | POD firmado por el receptor |
| `CUSTODY_CHANGE` (TX006) | `cargoLinkLifecycle` custodia | `evidenceHash` del traspaso + las dos partes |
| `CUSTOMS_INSPECTION` (TX010) | `cargoLinkEvents` | Notificación de la aduana |
| `ROUTE_CHANGE` (TX011) | `cargoLinkEvents` | Aviso de la naviera |
| `TELEMETRY_BATCH` | `cargoTelemetryAnchor` | Lote con firmas P-256 válidas de dispositivos registrados |
| `TEMPERATURE_BREACH` | `cargoDisputeOracle` | Lecturas firmadas fuera de rango durante más de N minutos (N lo fija el feed) |

**Regla de independencia de fuentes:** si un evento es de nivel
`SETTLEMENT` (dispara una liberación de escrow, como `DELIVERED`,
`CUSTOMS_CLEARED` o `TEMPERATURE_BREACH`), necesita **dos fuentes de origen
distinto**. Un operador no firma si solo ve una fuente. Los eventos de nivel
`TRACE` (`IN_TRANSIT`, `ROUTE_CHANGE`) aceptan una sola.

---

## 5. Formato del informe

### 5.1 Observación (la firma de cada operador)

Se firma con EIP-712 y **secp256k1**, para que `ecrecover` lo verifique on-chain
con un coste de gas bajo. El chat de ChatGPT proponía Ed25519: se descarta
porque no hay precompilado en EVM. Las firmas P-256 de los dispositivos siguen
siendo P-256: el nodo las verifica off-chain y las incluye en `evidenceRoot`.

```solidity
// EIP-712 domain: name "BeZhas Oracle Network", version "0.1",
//                 chainId, verifyingContract = BONReportVerifier
struct Report {
    bytes32 feedId;        // keccak256("logistics.v1")
    bytes32 subject;       // keccak256(bUid)
    bytes32 eventType;     // keccak256("GATE_IN"), ...
    uint64  sequence;      // estrictamente creciente por (feedId, subject)
    uint64  observedAt;    // instante del hecho (unix), no el de la firma
    bytes32 payloadHash;   // sha256 del payload canónico (JSON, claves ordenadas)
    bytes32 evidenceRoot;  // raíz Merkle sha256 por pares ordenados de las evidencias
    uint32  configEpoch;   // versión del conjunto de operadores en BONRegistry
}
```

`chainId`, `verifyingContract`, `feedId` y `configEpoch` impiden reutilizar
una firma en otra red, en otro contrato, en otro feed o después de rotar
operadores.

### 5.2 Evidencias

`evidenceRoot` usa **el mismo algoritmo** que `TelemetryAnchor.verify`:
sha256 por pares ordenados. Cada hoja es
`sha256(canonical({type, source, ref, hash, observedAt}))`. Las evidencias
**no** van a la cadena: se guardan cifradas en el almacenamiento del operador
que las obtuvo, y la cadena solo guarda la raíz. Esto es compatible con el
RGPD, porque no publica datos personales, y con la política de documentos
(los documentos nunca se leen ni se publican; solo se calcula su hash).

### 5.3 Estados de un informe (off-chain)

`PENDING` → `COLLECTING` → `QUORUM_REACHED` → `PUBLISHED`, más
`REJECTED` (las fuentes no cuadran), `DISPUTED` (un operador firma un
conflicto, §7.3) y `EXPIRED` (no se reúne el quórum en el tiempo
`ttl` del feed).

---

## 6. Contratos

Van todos en `smart-contracts/src/oracle/`, con Foundry, OpenZeppelin y
Solidity ^0.8.20, como el resto.

### 6.1 `BONRegistry`
- Guarda los operadores (`address signer`, `bytes32 orgId`, `bool active`), el
  `threshold` y los feeds (`feedId → {ttl, minSources, consumers[]}`).
- **Cada cambio crea un nuevo `configEpoch`.** Los informes se verifican
  contra el epoch que declaran, y este debe seguir vigente (`epoch == current`
  o, durante un periodo de gracia, `current - 1`).
- `addOperator`, `removeOperator`, `setThreshold` y `setFeed` solo los puede
  ejecutar `BON_GOVERNANCE`, que es un `TimelockController` cuyo proposer es
  el multisig.
- Invariantes: `threshold > n/2`, `threshold ≤ n` y no puede haber dos
  operadores activos con el mismo `orgId` (una organización = un voto).

### 6.2 `BONReportVerifier`
- `verify(Report r, bytes[] sigs) → bool`. Recupera los firmantes, exige que
  sean **distintos**, que estén activos en `r.configEpoch` y que sean al menos
  `threshold`. Las firmas se ordenan por dirección para detectar duplicados en
  O(n).
- No escribe estado: es una librería o contrato `view` que reutiliza cualquier
  consumidor.

### 6.3 `BONLogisticsFeed`
- `submit(Report r, bytes[] sigs)`: puede llamarlo cualquiera (el relay).
  Verifica las firmas, comprueba que `sequence` sea la última más 1 para ese
  `subject` y que `observedAt ≤ block.timestamp + 5 min` y no sea más antiguo
  que `ttl`. Guarda `latest[subject]` y emite `ReportPublished`.
- Después llama al **adaptador** del consumidor que corresponda (§6.4) dentro
  de un `try/catch`. Si el consumidor falla, el informe queda publicado
  igualmente y se emite `ConsumerFailed`: la evidencia no depende de la lógica
  de negocio.
- Incluye `pause()` con `BON_EMERGENCY`, que el multisig puede ejecutar sin
  esperar al timelock (solo pausa, nunca escribe).

### 6.4 Migración de los contratos actuales (sin reescribirlos)

En v0.1 los contratos existentes se modifican lo mínimo: el cambio consiste en
quién tiene los permisos. Al pasar el rol a BON, `msg.sender` es el contrato
del feed, de modo que campos como `ClearanceRecord.aduanaOfficer` guardarán
la dirección de `BONLogisticsFeed`. La identidad real del funcionario queda
en el informe BON (`evidenceRoot`).

| Contrato | Rol | Hoy lo tiene | Con BON lo tiene |
|---|---|---|---|
| `SupplyTracker` | `OPERATOR_ROLE` | EOA del backend | `BONLogisticsFeed` |
| `CustomsClearanceOracle` | `CUSTOMS_OFFICER_ROLE` (`approveClearanceByOfficer`, `rejectClearance`) y `ORACLE_ROLE` (`preClearanceValidation`) | EOA del backend | `BONLogisticsFeed`. `updateTariff` también exige `ORACLE_ROLE`: los aranceles no son un evento logístico, así que pasan a un rol de admin aparte (este es el único cambio de contrato de v0.1). |
| `TelemetryAnchor` | `OPERATOR_ROLE` | EOA del backend | `BONLogisticsFeed` |
| `EvidenceVault` | `CUSTODIAN_ROLE` | quien desplegó | se mantiene (es custodia legal, no un oráculo) |

Cuando el rol ha pasado a BON, **se revoca** la EOA del backend
(`revokeRole`). Si el backend sigue pudiendo escribir directamente, el quórum
no sirve de nada. Los informes publicados en v0.1 solo afirman «firmado por
3 de 4 operadores del epoch X», nada más.

`DeliveryEscrow` en 2708 tiene **la misma dirección** que `BeZhasLogisticsNFT`
en `deployments/2708.json` (`0xdc11…2add`). Hay que aclararlo antes de
conectarlo a BON.

---

## 7. bon-node

Se crea en `bon-node/` con su propio `package.json` y lockfile de pnpm, igual
que `api/` y `agent-lib/` (el workspace raíz no declara paquetes).

### 7.1 Pipeline
1. **Recibir**: suscripción a las fuentes que tiene asignadas. Cada operador
   debe poder obtener al menos una fuente **por su cuenta**: si todos leen del
   mismo webhook de BeZhas, solo hay una fuente, aunque firmen cuatro.
2. **Verificar el origen**: HMAC del ingest hub, firma P-256 del Edge Node y
   TLS con el emisor. Para no duplicar código, las funciones se importan de
   `api/services/cargoIngestHub.js` y `telemetrySecurity.js`, extraídas a un
   paquete compartido (§13, tarea 2).
3. **Validar**: se ejecuta `cargoLinkValidators[eventType]` sobre el payload
   canónico. Si sale `valid: false`, el nodo no firma.
4. **Construir el informe**: payload canónico, `payloadHash` y `evidenceRoot`.
5. **Firmar** con la clave del operador en KMS o HSM. La clave **nunca**
   está en un `.env` en producción.
6. **Difundir** la observación a los demás nodos y al relay.
7. **Registrar** todo localmente (sin datos personales en claro) para la
   auditoría.

### 7.2 Comunicación entre nodos
En v0.1, HTTP con mTLS entre 4 nodos conocidos, donde cada nodo expone
`POST /observations`. Más adelante, NATS o libp2p si la red crece de 7 nodos.
No hace falta consenso BFT entre nodos: el «consenso» es el umbral de firmas
que se verifica on-chain. Si dos operadores firman informes distintos para el
mismo `(subject, sequence)`, el que llegue primero con quórum gana y el otro
queda `DISPUTED` (§7.3).

### 7.3 Conflictos
Si un nodo ve un informe publicado que contradice su observación, firma un
`Dispute{reportHash, reason}` y lo envía a `BONLogisticsFeed.flag()`. En v0.1
un *flag* no revierte nada: emite un evento y `cargoDisputeOracle` lo trata
como incidencia de nivel 2 (`HOLD_ESCROW`) si el evento es `SETTLEMENT`. La
resolución sigue siendo explícita (owner/admin), como hoy.

---

## 8. API, SDK y MCP

Se sirve desde la API existente (`api/routes/bon.js`) y se publica por el
Gateway con api-key y cuotas por plan. No se crea un servicio nuevo.

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/bon/v1/feeds` | Catálogo de feeds y su configuración |
| GET | `/api/bon/v1/operators` | Operadores del epoch vigente (org, dirección, estado) |
| GET | `/api/bon/v1/subjects/:bUid/reports` | Historial de informes de un envío |
| GET | `/api/bon/v1/reports/:reportHash` | Informe, firmas, tx y estado |
| GET | `/api/bon/v1/reports/:reportHash/proof?leaf=` | Prueba Merkle de una evidencia |
| POST | `/api/bon/v1/verify` | Verificación **sin estado** de un informe más sus firmas (para auditores) |
| GET | `/api/bon/v1/status` | Estado de cada nodo (heartbeat, último epoch y último informe) |

No hay `POST /logistics/events` público: los eventos entran por el ingest hub,
que ya existe y está autenticado.

**MCP:** se añaden las herramientas de solo lectura `bon_get_shipment_proof` y
`bon_verify_report` al servidor MCP de BeZhas, para que los agentes (OPERANT
incluido) citen hechos certificados en lugar de afirmarlos.

**SDK:** `verifyReport(report, sigs, registryAddress)` en TypeScript. Es la
verificación local de §6.2, para no depender de BeZhas.

---

## 9. Chainlink: dónde encaja (opcional, no bloquea v0.1)

| Uso | Producto | Red | Cuándo |
|---|---|---|---|
| EUR/USD y otros tipos de cambio en `calculateDuty` | Data Feeds | Polygon 137 | v0.2, si aduanas lo necesita |
| Llevar informes BON de la L2 a Polygon | CCIP | — | **No disponible**: la L2 2708 no es una red soportada por CCIP |
| Automatizar tareas periódicas | Automation | Polygon | Solo si se publica en Polygon |

Mientras tanto se usa la mensajería propia del bridge
(`BeZhasBridgeL2`), con sus propios supuestos de seguridad.

---

## 10. Economía

En v0.1 **no se usa BEZ**. Los operadores externos firman un acuerdo de
servicio (SLA, tarifa fija mensual en €). Los clientes acceden a BON con los
planes y la cuota del Gateway que ya existen: **no** se crea la tabla de
precios de 49/199/999 € que proponía el chat de ChatGPT, porque chocaría con
`api/config/operant-services.js` y con los planes vigentes. El precio por
evento certificado se decide aparte con los costes reales de gas y operación.

Que en el futuro los operadores depositen BEZ en staking con penalización
(slashing) es una línea de investigación, no un compromiso. Exige revisar
antes con el abogado la clasificación MiCA del token.

---

## 11. Seguridad y criterios para salir a producción

| Amenaza | Mitigación en v0.1 |
|---|---|
| Fuente manipulada | `minSources = 2` en eventos `SETTLEMENT`, firma P-256 del dispositivo |
| Operador malicioso | Umbral 3 de 4, una organización = un voto |
| Colusión de BeZhas | En el piloto, como máximo 1 operador BeZhas (§3.1) |
| Robo de claves | KMS/HSM, rotación por nuevo epoch, revocación inmediata con `removeOperator` vía timelock y `pause()` sin timelock |
| Replay | Dominio EIP-712 (chainId + contrato), `feedId`, `configEpoch` y `sequence` |
| Datos antiguos | Ventana `ttl` por feed y `observedAt` no futuro |
| Cambio malicioso de configuración | Multisig + `TimelockController` (48 h) |
| Escritura que salta BON | Revocar los roles de la EOA del backend en los consumidores (§6.4) |
| Fallo del consumidor | `try/catch`: la evidencia se publica igualmente |

**Criterios para salir a producción** (todos obligatorios):
1. 4 operadores de 4 organizaciones distintas, con como máximo 1 de BeZhas y
   un contrato de servicio firmado con cada uno.
2. Tests de Foundry: firmas duplicadas, firmante de un epoch antiguo, replay
   entre redes y entre feeds, secuencia fuera de orden, umbral menos 1 y
   consumidor que revierte. Fuzzing e invariantes de `BONRegistry`.
3. **Auditoría externa** de `src/oracle/`.
4. Simulacro con un nodo caído (el sistema publica con 3) y con dos caídos (el
   sistema expira sin publicar nada incorrecto).
5. Rotación de clave en vivo sin perder informes.
6. Un piloto CargoLink real con al menos un evento `SETTLEMENT` certificado
   de punta a punta.

---

## 12. Qué se puede decir en cada momento

| Fase | Afirmación permitida | Afirmación prohibida |
|---|---|---|
| Hoy | «BeZhas registra en cadena el ciclo de vida del envío, firmado por BeZhas» | «Oráculo descentralizado», «verificado por terceros», «usa Chainlink» |
| v0.1 testnet | «BON, en pruebas: evidencia con firma múltiple» | Cualquier afirmación de producción o independencia |
| v0.2 piloto (criterio §11.1 cumplido) | «Eventos certificados por 3 de 4 operadores independientes» | «Auditado» antes del informe de auditoría |

La tarea 0 (hecha el 2026-11-06) quitó del código las afirmaciones que
incumplían esta tabla: `cargoLinkService.js` y el gateway de App-nativas
devolvían `oracle: 'CHAINLINK_FUNCTIONS'` y un número de levante aleatorio
(`BZ-ASY-…`). Hoy esos endpoints son fachadas del ciclo de vida B-UID.

---

## 13. Plan de trabajo

| # | Tarea | Depende de | Resultado |
|---|---|---|---|
| 0 | ✅ 2026-11-06 — endpoints de producto de CargoLink conectados al ciclo de vida real; el gateway reenvía a la API; fuera `CHAINLINK_FUNCTIONS` y el levante aleatorio | — | La API deja de afirmar algo falso |
| 1 | Congelar `Report`, el dominio EIP-712 y la serialización canónica (este documento → v0.1 final) | Decisiones de la §14 | Especificación cerrada |
| 2 | Extraer a un paquete compartido la verificación HMAC, P-256, la Merkle y los validadores | — | Un solo código para API y nodos |
| 3 | `BONRegistry`, `BONReportVerifier` y `BONLogisticsFeed` con sus tests de Foundry | 1 | Contratos en `src/oracle/` |
| 4 | `bon-node` (pipeline de la §7.1) con firma en KMS | 1, 2 | Nodo ejecutable |
| 5 | Script de despliegue en Anvil (31337) con 4 nodos locales y E2E de `GATE_IN` → `DELIVERED` | 3, 4 | Demo reproducible |
| 6 | Pasar los roles de `SupplyTracker`, `CustomsClearanceOracle` y `TelemetryAnchor` en 2708 al feed y revocar la EOA | 3, 5 | La L2 de pruebas usa BON |
| 7 | `api/routes/bon.js` + herramientas MCP + `verifyReport` en el SDK | 3 | Consumo externo |
| 8 | Captar operadores 2, 3 y 4 (NauticOps es candidato a operador 3 o a fuente, no a cliente) | — | Acuerdos firmados |
| 9 | Auditoría externa | 3 estable | Informe |

Tras `forge build`, sincronizar los ABI (`node sync-daemon.js --once`), como
con cualquier contrato nuevo.

---

## 14. Decisiones abiertas

1. **Red de publicación en producción:** ¿L2 2708 o Polygon 137? Los
   consumidores están hoy en 2708, pero falta confirmar que la L2 tiene RPC
   público, finalidad y explorador estables. Polygon da acceso a Chainlink y
   está donde vive BEZ.
2. **Operadores 2, 3 y 4:** quiénes son, qué fuente obtiene cada uno por su
   cuenta y con qué contrato.
3. **Almacenamiento de evidencias:** cada operador guarda las suyas
   (recomendado) o hay un almacén común cifrado.
4. **`ttl` y `minSources`** de cada tipo de evento (§4), que hay que fijar con
   un operador logístico real.
5. Aclarar la dirección compartida de `DeliveryEscrow` y `BeZhasLogisticsNFT`
   en `deployments/2708.json`.
