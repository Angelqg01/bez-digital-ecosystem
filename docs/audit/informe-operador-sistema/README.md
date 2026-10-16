# Prueba como Director de Despacho / Operador del Sistema (2026-10-16)

**Rol simulado:** director de despacho de energía de una eléctrica (equilibra generación y demanda), que quiere conectar sus
plantas a BeZhas. **Método:** navegador real sobre BEZ Energy (`bez-energy`) y su chat (BeZhas AI), contra la API del repositorio
(imagen Docker propia + Postgres de desarrollo), con un plan Enterprise VIP de prueba y rol de operador. Modelo local `qwen3:4b`
(CPU, sin Claude: no hay clave válida).

## Lo que un operador de red no puede permitirse y estaba mal

| # | Hallazgo | Gravedad | Arreglo |
|---|---|---|---|
| 1 | Telemetría, nodos y (sin clave ESIOS) indicadores de red eran `Math.random()` **sin marcar**: se podía decidir con datos inventados | Crítica | Todo dato no real lleva `simulated:true` y la UI muestra «DATOS DE DEMOSTRACIÓN» con salida a «Conectar planta» |
| 2 | Flujo y SCADA mostraban kW con la etiqueta **MW** (×1000) | Crítica | `fmtPower` único (kW → MW → GW) con tests |
| 3 | Cifras fabricadas en la interfaz: saldo 4.892,50 BEZ (`parseFloat(balance) \|\| 4892.50` convertía un saldo real de 0 en 4.892,50), 50.000 en staking, reputación 98, «Burn Tracker», propuesta DAO, «nega-watts», servicios programados, foto «LIVE: SENSOR» de un banco de imágenes y coordenadas de Los Ángeles | Alta | Sólo datos de la cuenta (saldo, staking, créditos, movimientos, CAE) y estados vacíos explícitos |
| 4 | Alertas con texto fijo («95 % solar», «precio negativo en 2 h», «RD 88/2026 compliant») con el precio real en 200-275 €/MWh | Alta | Alertas calculadas con la curva real de OMIE, el estado de los nodos y los eventos de Aegis (`energyAlerts`) |
| 5 | Los botones SCADA enviaban `START/STOP/MODE_*`, que el backend rechaza (422); además, en desarrollo `sendControlCommand` **simulaba el éxito** de cualquier fallo | Alta | Sólo los comandos reales (cargar, descargar, reducir carga, isla, reactiva, parada), con límites y sin simulación |
| 6 | El backend respondía `success:true` aunque ningún equipo recibiera el comando (transporte «mock») | Alta | `delivered:false` + aviso; la UI lo dice |
| 7 | **No había forma de conectar una planta**: `/nodes` devolvía cinco nodos fijos para todos | Alta | Registro de nodos (`vpp_nodes`, migración 066), clave `bzn_…` (sólo hash), ingesta HTTPS con validación de plausibilidad y límite de 1 lectura/s, y pantalla «Conectar planta» |
| 8 | La cola de aprobación humana (HITL) no tenía pantalla; el histórico, la analítica y el control de un nodo se podían pedir sin comprobar de quién era | Alta | Panel de aprobaciones; los nodos `nd-…` sólo los ve y manda su titular |
| 9 | Los períodos de OMIE se elegían con la hora del servidor (UTC): precio de 2 h antes y fichero del día equivocado entre las 22:00 y las 24:00 UTC | Alta | Hora de Madrid (`madridParts`) |
| 10 | Frecuencia y balance de red aleatorios cuando no había clave ESIOS | Media | Demanda y mix reales de REE (apidatos, sin clave); frecuencia y balance **no se muestran** (REE no los publica); refresco en segundo plano |
| 11 | Chat: el corpus no sabía conectar plantas ni distinguía real/simulado; el sembrado fallaba en la BD de desarrollo (migración 065 sin aplicar); Qwen3 enseñaba su razonamiento en inglés | Media | Documentos nuevos y corregidos, 6 preguntas nuevas en el corpus de evaluación (recall 100 % en el tipo `cto_energia`), `/no_think` para Qwen3 |
| 12 | Página Docs prometía decisiones autónomas, pagos pasivos en BEZ y certificación de toda la energía | Media | Texto ajustado a lo que existe |

## Qué se probó en el navegador
Panel (mercado OMIE y red REE reales, curva horaria, alertas), SCADA (alta de planta desde la UI, clave una sola vez, lecturas por
HTTPS, lectura imposible rechazada con 422, mando de comandos con resultado real, cola de aprobación), Aegis, Analítica sobre
lecturas guardadas, Cartera sin datos inventados, y el chat.

## El chat, como director de despacho
Pregunta: «Soy director de despacho de una eléctrica y quiero conectar mis plantas solares y baterías a BeZhas. ¿Cómo lo hago y qué hace
exactamente BeZhas por mí?». Antes respondía «No encuentro información sobre eso». Ahora recupera los documentos de energía nuevos y explica
los pasos reales (SCADA → «Conectar planta», clave `bzn_…` de un solo uso, envío a `/api/energy/telemetry/ingest`, rechazo de lecturas imposibles,
paso de «demostración» a «en vivo», comandos y aprobación humana). Con la pregunta «¿puede despachar mi generación como operador del sistema?» la
recuperación encuentra el texto que lo niega (BeZhas no es operador del sistema ni oferta en el mercado).

**Modelo local:** `qwen3:4b` (razonador) enseñaba su razonamiento en inglés y agotaba el tiempo; con `qwen3:4b-instruct` responde en español limpio.
`think:false` y `/no_think` no bastan en una versión antigua de Ollama: usar una variante *instruct*. En CPU tarda 1-4 min por respuesta (hay que subir
`AI_TIMEOUT_MS`); la GPU de este equipo no está operativa (NVML con versión incompatible).

## Límites
- **Un operador del sistema real no se conecta así:** BeZhas es una capa de monitorización, alertas y órdenes auditadas sobre los
  activos del cliente; no despacha generación en la red nacional ni oferta en el mercado.
- La telemetría real exige que el cliente (o su integrador) envíe las lecturas desde su SCADA/pasarela: el driver Modbus/SunSpec sigue pendiente.
- Los comandos no llegan a equipos reales sin un edge conectado por MQTT (`delivered:false`).
- El modelo local de 4 B en CPU tarda ~60 s por respuesta; no se probó con Claude.
- La cola HITL es global en memoria: cualquier operador ve y aprueba las peticiones de otros (pendiente de acotar por organización).
- Migraciones 065 y 066 (y las pendientes de 049) hay que aplicarlas en producción antes de desplegar.
