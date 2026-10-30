# Debate ChatGPT × Gemini: cómo suscribirse e integrarse a BeZhas rápido, seguro y con confianza

*30-oct-2026. Hecho en el navegador de la app con las sesiones ya iniciadas de ChatGPT y Gemini. Dos rondas: análisis por rol y réplica cruzada. Las respuestas son suyas; la sección 5 es el arbitraje de Claude.*

- **ChatGPT** → rol CTO de una empresa mediana que evalúa conectarse.
- **Gemini** → rol CISO + DPO de esa misma empresa.
- Se les dio un resumen **público** de BeZhas (planes, SubApps, API, MCP, SDK, ERP, KYB/DPA/MiCA/DAC8). No se envió ninguna clave, IBAN ni dato interno.

> ⚠️ Lo que dicen sobre el contenido actual de bezhas.com (redes, precios, contactos) viene de su propia navegación y **no está verificado** aquí. Contrastar antes de actuar (ver §6).

---

## 1. Primera ronda — las 12 preguntas

| | ChatGPT (CTO) | Gemini (CISO/DPO) |
|---|---|---|
| Enfoque | Asesor técnico-comercial: pregunta qué problema resolver, luego deriva plan, scopes y SubApps | Seguridad por diseño: sector y tamaño primero, custodia, residencia de datos y privacidad pronto |
| Preguntas únicas | Cargo y autoridad de contratación; usuarios por rol; **piloto primero**; documentos y validaciones por separado; facturación y volumen económico; versión/cloud/on-prem del ERP; sistemas adicionales; qué se registra on-chain y si hay datos personales; presupuesto y fecha objetivo | Estructura societaria (filial, holding, multipaís); gobierno blockchain (solo lectura vs validación con staking); tipo de integración (ERP, SDK o MCP); jurisdicción fiscal y residencia de datos; privacidad (hash público vs cifrado/ZK); designación de CISO, DPO y contacto de incidentes |
| Regla clave | La facturación nunca es el único criterio de permisos | Los datos sensibles se piden en pantalla segura, nunca en el chat |

## 2. Confianza antes de dar email y contraseña

Coinciden en casi todo:

1. **Trust Center público** con evidencias descargables, no sellos decorativos: razón social y NIF, DPA descargable, política de privacidad, auditorías de contratos y su alcance, estado de infraestructura, contacto de seguridad, precios y límites.
2. **Demostrar, no declarar:** demo interactiva donde un agente consulta, prepara una operación, se calcula el riesgo, un humano aprueba y queda registro de auditoría.
3. **Alta por etapas:** A explorar sin identificarse → B cuenta (email corporativo, contraseña, verificación, MFA) → C alta empresarial (KYB, DPA, permisos, ERP, wallets).
4. **Qué queda on-chain y qué off-chain**, con derecho al olvido. Aviso de ChatGPT: un hash puede seguir siendo dato personal si permite identificar a alguien.
5. Marcar cada afirmación como *verificado / auditado / en proceso / diseñado para cumplir*. No mostrar ISO 27001 o SOC 2 si no existe un certificado vigente.

## 3. Temas que una empresa debe resolver para conectarse

Unión de ambas listas:

| Dominio | Qué exigen |
|---|---|
| Seguridad | MFA para administradores, RBAC/ABAC, OAuth 2.1 + PKCE, API keys por entorno y servicio, scopes granulares, rotación y revocación, IPs permitidas, secretos en Vault/KMS, rate limit por organización, pentest independiente |
| Agentes IA / MCP | 3 niveles: **lectura → preparación/simulación → ejecución con aprobación humana independiente**; la IA no puede cambiar sus permisos; defensa frente a prompt injection; tokens de vida corta; límites de gasto |
| Legal y regulatorio | RGPD/LOPDGDD, DPA, MiCA (clasificar BEZ y servicios), DAC8 (quién reporta), KYB y titulares reales, AML, NIS2/DORA si aplica, pagos y valores si hay tokenización. Estar preparado para cumplir ≠ estar certificado |
| Privacidad | Documento cifrado off-chain, solo hash o evidencia mínima on-chain, residencia en la UE, retención y borrado, EIPD, uso de datos por proveedores de IA |
| Blockchain | Matriz oficial de redes, tokens y contratos; explorador; código verificado; administradores, timelocks, multisig, pausa; oráculos y puentes; qué pasa si Polygon/L2 se congestiona |
| ERP | Estado real por conector (*compatible / integrado / certificado*), versiones y módulos, lectura vs escritura, reintentos, idempotencia, reconciliación, **empezar en solo lectura**; aislar el adaptador para evitar movimiento lateral hacia el ERP |
| SDK | Paquetes firmados y verificables, circuit breakers y colas de reintento |
| Custodia | Quién es propietario de los activos, quién custodia, quién prepara, quién firma; multisig/MPC/HSM, límites por operación y diarios, lista de beneficiarios |
| Auditoría | Expediente por operación (usuario, permisos, simulación, aprobaciones, tx hash, coste); exportable. Un registro inmutable prueba que algo se registró, no que fuera cierto |
| Continuidad | SLA contractual, RTO/RPO, backups con pruebas, DR, página de estado, soporte con tickets (no solo Telegram), **derecho de salida y exportación** |
| Costes | Suscripción + IVA + API + acciones de IA + gas + comisiones + validadores + ERP + soporte + integración + salida. Tratamiento contable y fiscal de BEZ |

## 4. Riesgos y fricciones que ven

| # | ChatGPT | Gemini |
|---|---|---|
| 1 | Redes y tokens poco claras (Polygon 137, L2 2708, BEZ-CoinV2, local 31337) sin matriz oficial | Movimiento lateral desde el adaptador ERP gestionado |
| 2 | Gobernanza de scopes API/SDK/MCP sin panel central de seguridad | MiCA y volatilidad de BEZ en el coste operativo |
| 3 | ERP anunciado frente a verificable (el MCP solo lee el ERP) | **Fuga de credenciales pegadas en el chat: falta DLP** |
| 4 | Poca evidencia pública de auditorías y certificaciones | Caída o congestión de Polygon/L2 |
| 5 | Precios, contactos y capacidades distintos entre páginas | SDK sin paquetes firmados |

## 5. Segunda ronda — desacuerdos y consenso

**Desacuerdos**
- Gemini: empezar por cargo y presupuesto es fricción de «formulario de ventas»; sandbox anónimo es riesgo de abuso. → ChatGPT: el cargo evita dar permisos de administración a quien no puede contratar; los controles deben depender del riesgo, no ser barreras para todos.
- ChatGPT discrepa de Gemini en: ISO 27001/SOC 2 como requisito de entrada (hay que ser honestos sobre su estado); DPO/CISO obligatorios (pedir «responsable de seguridad y privacidad», aunque sea externo); staking como requisito general (solo si quieren validar); ZK como opción por defecto; estructura rígida de 6 pasos (debe ser adaptativa).
- Gemini incorporó de ChatGPT: los 3 niveles de MCP, la matriz de redes, la madurez del ERP y el Trust Center descargable.
- ChatGPT incorporó de Gemini: estructura societaria, gobierno blockchain, tipo de integración, residencia de datos, DLP, aislamiento del ERP y verificación de paquetes SDK.
- Omisiones que se señalaron: ChatGPT no pensó en **DLP** ni en la residencia off-chain; Gemini omitió **derecho de salida, TCO, SLA, prueba de concepto**.

**Puntos de acuerdo cerrados**
1. El chat **nunca** pide contraseña, IBAN, claves, API keys, JWT ni credenciales de ERP.
2. El DLP debe ejecutarse **antes** de enviar nada al LLM o al MCP, no después, y bloquear con aviso si el usuario pega un secreto.
3. Cuestionario de máximo 10 preguntas, adaptativo (no recorre pantallas de custodia quien solo certifica documentos).
4. Las evidencias de cumplimiento se demuestran, no se declaran.
5. El MVP prioriza onboarding, Trust Center, DLP, permisos y **una** integración ERP demostrable.

**Discrepancia sin cerrar: ¿cuándo se pide el email?**
- Gemini: tras la pregunta 2, para guardar progreso y activar el sandbox.
- ChatGPT: tras la pregunta 6, cuando el usuario ya ha visto valor y definido su arquitectura.
- En ambos, la contraseña va en una pantalla segura fuera del chat, después de verificar el email.

### Cuestionario de consenso (versión ChatGPT, con aportes de Gemini)

| # | Canal | Pregunta | Desbloquea |
|---|---|---|---|
| 1 | Chat | Cargo y autoridad de contratación | Roles, permisos, aprobaciones |
| 2 | Chat | Estructura de la empresa y países | Organizaciones, KYB, segregación de tenants |
| 3 | Chat | Sector, tamaño, facturación, documentos y operaciones al mes | Plan, límites, presupuesto |
| 4 | Chat | Qué quiere resolver primero | SubApps (CargoLink, Pay, Energy, PureScan, Capital, Wallet) |
| 5 | Chat | Cómo integrar: ERP (versión, módulos), SDK, API, MCP | Adaptador, scopes, herramientas MCP |
| 6 | Chat | Participación en blockchain: lectura, escritura, firma, validación | Permisos, wallet, validadores |
| — | **Email** | Email corporativo → guardar y enviar resumen | |
| — | **Pantalla segura** | Verificación, Trust Center, DPA, contraseña + MFA | |
| 7 | Segura | Jurisdicción y cumplimiento (RGPD, MiCA, DAC8, KYB) | Revisión legal, privacidad |
| 8 | Segura | Privacidad y custodia (hash, cifrado, HSM, multisig) | Arquitectura de datos y firmas |
| 9 | Segura | Responsables de seguridad, privacidad e incidentes | Escalado y auditoría |
| 10 | Chat | Contratación, soporte, SLA, fecha objetivo, sandbox | Propuesta económica y calendario |

### MVP en 4 semanas (consenso)

| Semana | Entrega |
|---|---|
| 1 | Cuestionario adaptativo, modelo multi-tenant, motor de recomendación de plan y SubApps, mapa de scopes, matriz oficial de redes y contratos |
| 2 | Trust Center, registro con verificación y MFA, KYB en pantalla segura, DPA, **DLP antes del LLM**, consentimiento y auditoría |
| 3 | Gestor de API keys, OAuth 2.1 + PKCE para MCP, sandbox, **un** adaptador ERP (SAP B1 u Odoo) en solo lectura, panel de permisos y revocación |
| 4 | Pruebas de aislamiento entre tenants, pentest de los flujos críticos, prompt injection, exportación y recuperación, piloto con 2-3 empresas |

**Fuera del MVP:** staking y validadores, ZK, escritura completa en todos los ERP, custodia institucional propia, ISO 27001/SOC 2 (proceso independiente), fiscalidad automática completa.

**KPIs propuestos** (objetivos de producto, no benchmarks): cuestionario en menos de 8 min; más del 65 % termina el alta; 0 secretos enviados al LLM; 0 accesos entre tenants; 0 scopes no autorizados; propuesta en menos de 2 min.

---

## 6. Arbitraje de Claude, contra lo que ya hay en el repositorio

**Ya existe y encaja**
- `bezhas_recommend_plan` y `bezhas_signup_start` (`api/config/mcp-onboarding-tools.js`): sector, empleados, país, ERP → plan, SubApps, coste y requisitos. Cubre una parte de las preguntas 3-5.
- Sesiones de alta con token efímero, que ya separan lo sensible del chat (`api/routes/onboarding-pages.js`, migración 052). Es la base de «pantalla segura».
- Adaptadores ERP para SAP B1, SAP S/4HANA, NetSuite, Dynamics y Odoo (`api/services/erp/`).
- Tarjeta de acceso del chat con wallet, email y 2FA (`ChatAuthCard.jsx`).

**Falta**
- El cuestionario guiado dentro del chat y su motor adaptativo (hoy `recommend_plan` solo conoce sector, empleados, país y ERP; no cargo, estructura, volumen, facturación, custodia ni participación blockchain).
- **DLP antes del LLM.** No hay filtro local que bloquee IBAN, API keys o JWT pegados en el chat. Es el único punto en el que ambos coinciden y no está construido.
- Trust Center público con evidencias.
- Panel de seguridad con scopes y revocación visibles para el cliente.
- Estado real de cada conector ERP (compatible / integrado / certificado). Hoy el MCP solo lee ERP.

**Mi recomendación sobre el email:** pedirlo **tras la pregunta 4**. Para entonces ya se puede enseñar una recomendación de plan y SubApps (la herramienta es anónima) y el usuario ha visto valor, sin llegar a las preguntas técnicas, que son las que hacen abandonar.

**Antes de actuar sobre los riesgos de ChatGPT (§4), verificar en el repositorio y la web:**
- Matriz de redes: `CLAUDE.md` indica que BEZ solo existe en Polygon y que BNB Chain será un puente. ChatGPT habla además de una L2 con Chain ID 2708 y BEZ-CoinV2. Hay que confirmar cuál es la red de producción para un cliente nuevo.
- Precios: ChatGPT habló de inconsistencias entre páginas pero su propia tabla muestra los mismos importes (99 / 499 / 2.499 €). Comprobar qué difiere realmente (prestaciones, contactos) antes de tocar nada.
