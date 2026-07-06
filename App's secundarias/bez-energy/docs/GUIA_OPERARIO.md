# BeZhas Energy VPP — Guía del Operario

Manual de uso de la consola **BeZhas Energy 4.0** orientado al operario del nodo
VPP (Virtual Power Plant). Describe cada sección de la app, qué puedes hacer en
ella y qué permisos necesitas.

> **Roles.** La app distingue tres niveles:
> - **Visitante** (sin sesión): solo lectura de paneles, sin telemetría privada.
> - **Operario** (`operator`): monitoriza y **despacha comandos** (SCADA,
>   arbitraje, respuesta a la demanda).
> - **Administrador** (`admin`): todo lo del operario **+** alta/baja de operarios
>   y el informe de cumplimiento Aegis.
>
> Para operar necesitas que un administrador te conceda el rol de operario
> (sección **Operarios**). Hasta entonces verás los controles en modo solo lectura.

---

## 0. Iniciar sesión

1. Pulsa **Wallet** (arriba a la derecha) → conecta tu wallet (MetaMask u otra).
2. Firma el mensaje SIWE para autenticarte (no gasta gas).
3. Tu rol se resuelve automáticamente. Si eres operario/admin, se desbloquean los
   controles correspondientes.

Si el panel muestra *"VPP telemetry unavailable / Failed to fetch"*, no tienes
sesión válida o el gateway no responde: reintenta el login y verifica conexión.

---

## 1. GRID (Inicio / Dashboard)

**Para qué sirve:** vista de un vistazo del estado energético del nodo.

Verás:
- **Flujo neto, salida total, frecuencia de red e índice de autosuficiencia.**
- **Eficiencia global** y **compensación de CO₂** estimada.
- Tarjetas por nodo físico (solar, eólico, hidráulico, batería, carga).

**Qué hacer como operario:**
- Comprueba que la **frecuencia** esté en torno a 50 Hz y la **autosuficiencia**
  dentro de lo esperado.
- Si una tarjeta de nodo aparece *Offline/Maintenance*, abre **SCADA** para
  diagnosticar.

> Esta sección es de monitorización: no ejecuta comandos.

---

## 2. SCADA (Centro de Control de Activos)

**Para qué sirve:** monitorización en tiempo real y **control remoto** de cada
recurso energético distribuido (DER).

Contenido:
- **Métricas agregadas:** salida total, nodos activos, ratio de eficiencia, CO₂.
- **Lista de activos:** despliega un nodo para ver sus **parámetros de
  diagnóstico**, la **lógica operativa** y el **relay visual** del sitio.

**Controles (requieren rol de operario):**
- **Node Execution — Start/Stop:** arranca o detiene el nodo.
- **Grid Protocol — Grid/Island:** conmuta entre operación en red o en isla.

**Cómo despachar un comando:**
1. Despliega el activo (botón **Details**).
2. En *Operational Logic*, pulsa la opción deseada.
3. La app envía el comando al backend (que lo publica al Edge Node por MQTT) y
   **refresca la telemetría**.

> ⚠️ Comandos críticos (corte de carga, modo isla) pasan por aprobación humana
> (HITL) y quedan **auditados on-chain** (BeZhasVPP.sol). Si no tienes rol de
> operario verás el aviso *"Vista de solo lectura"* y los controles deshabilitados.

---

## 3. AEGIS (Seguridad y Cumplimiento)

**Para qué sirve:** estado de integridad y seguridad del nodo.

Verás el estado del motor de anomalías Aegis: intentos de *spoofing*, integridad
de telemetría, frescura de datos del oráculo y cobertura de auditoría on-chain.

**Qué hacer como operario:**
- Revisa que el estado sea **COMPLIANT** y sin anomalías recientes.
- El **informe completo RD 88/2026** es exclusivo del administrador.

---

## 4. WALLET (Energy Wallet)

**Para qué sirve:** gestión económica del nodo en token **BZHS**.

Verás:
- **Balance**, **yield** del arbitraje, **reputación** del nodo, **autosuficiencia**.
- **Staking** (recompensas por flexibilidad VPP) e historial de transacciones.

**Qué hacer como operario:**
- Consulta el rendimiento generado por tu actividad (arbitraje, DR, P2P).
- Compra de créditos energéticos: requiere confirmar una transacción on-chain con
  tu wallet.

---

## 5. NEGAW (Analytics)

**Para qué sirve:** analítica de ahorro energético (*negawatios*) y rendimiento.

**Qué hacer como operario:**
- Analiza tendencias de generación/consumo y oportunidades de arbitraje (precio
  OMIE) para planificar carga/descarga de baterías.

---

## 6. OPERARIOS  *(solo administrador)*

**Para qué sirve:** alta y baja de operarios del nodo VPP.

El administrador puede:
- **Conceder** rol de operario indicando **wallet (0x…)**, **email** o **user id**.
- **Promover** candidatos recientes con un clic.
- **Revocar** el rol de un operario.

Cada cambio queda **auditado** en el servidor (`operator_provisioning_log`:
quién promovió/revocó a quién y cuándo).

> Si no eres administrador, esta sección no aparece en el menú y el acceso directo
> muestra *"Acceso restringido"*.

---

## 7. DOCS

Documentación técnica del proyecto: análisis de rentabilidad, tokenomics y modelo
de la VPP. Consulta aquí los fundamentos antes de operar.

---

## Resumen de permisos por sección

| Sección   | Visitante | Operario | Administrador |
|-----------|:---------:|:--------:|:-------------:|
| GRID      | 👁️ lectura | 👁️ lectura | 👁️ lectura |
| SCADA     | 👁️ lectura | ✅ control | ✅ control |
| AEGIS     | 👁️ resumen | 👁️ resumen | ✅ informe completo |
| WALLET    | — | ✅ | ✅ |
| NEGAW     | 👁️ | ✅ | ✅ |
| OPERARIOS | — | — | ✅ gestión |
| DOCS      | ✅ | ✅ | ✅ |

---
*BeZhas Energy VPP · Guía del Operario · mantener junto al README del módulo.*
