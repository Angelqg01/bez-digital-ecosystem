# Simulador Logístico 360° (SDK Simulator) — análisis y plan de desarrollo

> 2026-11-06. Componente: `App-nativas/Bezhas-Hub/frontend/src/components/logistics/simulator/`
> (pestaña **SDK Simulator** de `/developer-console` en el Hub).
> Stack actual: React 18.2 · three 0.180 · @react-three/fiber 8.18 · drei 9.122 · Tailwind 3.4 · Vite 5.

## 1. Diagnóstico

Medido con Chromium + RTX 5050 (ANGLE/EGL, mismo arranque que
`marketing/video-como-funciona/pipeline/render.py`) a 1600×1000, y con WebGL
desactivado para la vista 2D.

### 1.1 Por qué «se veía peor» (resuelto hoy)

| Causa | Efecto | Arreglo |
|---|---|---|
| `src/index.css` fuerza con `!important` **todo** `div/span/p/h*` a negro en modo claro y todo SVG a `fill/stroke: #000` | En tema claro el simulador (fondo negro) quedaba negro sobre negro: HUD vacío, paneles mudos, mapa 2D invisible. En tema oscuro, todo el texto gris: se perdían los colores teal/ámbar/rojo | Clase `.theme-island`: esas reglas globales ya no entran en el simulador ni en la intro. Mismo comportamiento en el resto del Hub |
| Ejes del gráfico IoT sin formato | Etiquetas tipo `73.87440618` | `tickFormatter` entero |
| Sin WebGL, hueco negro | — | La 3D es la vista principal; sin WebGL (p. ej. el panel de navegador de la app de Claude, que no lo tiene) se muestra el mapa 2D con aviso «abrir en Chrome/Firefox», copiar enlace y «Reintentar 3D» |
| En el mapa 2D el vehículo tapaba la etiqueta de la parada | — | El vehículo va al lado contrario de la etiqueta |

### 1.2 Escena 3D (`scene/LogisticsScene3D.tsx`, 755 líneas)

Rinde a 60 fps en la RTX 5050, pero está hecha «a mano» y eso se nota en
aspecto, en coste en equipos modestos y en interacción:

| # | Hallazgo | Dónde | Impacto |
|---|---|---|---|
| E1 | ~150 mallas sueltas (`<Box>`, `<Cylinder>`) cada una con su geometría y material; 53 con `castShadow` | nodos y vehículos | Muchas *draw calls* y sombras; en portátiles integrados baja de 60 fps |
| E2 | `Sea` recalcula 2.145 vértices en CPU cada frame y no recalcula normales | `Sea()` | Coste CPU y oleaje que no reacciona a la luz (se ve plano) |
| E3 | `Vehicle` crea `Vector3.clone()` y `new Object3D()` en cada frame | `useFrame` de `Vehicle` | Basura para el GC → tirones |
| E4 | El vehículo va **en línea recta** al siguiente punto, no por la ruta dibujada: el barco cruza tierra, el avión usa una distancia fija (`totalDist = 15`) | `Vehicle` | Animación poco creíble |
| E5 | 11 `<Html>` de drei (etiquetas DOM) sincronizadas cada frame, por encima de los overlays (`zIndexRange 40`) | `NodeLabel`, `Vehicle` | Etiquetas que se montan sobre el HUD («MBALAJE RFID» cortado) y *layout* por frame |
| E6 | `CameraDirector` hace `lerp` del objetivo en **todos** los frames | `CameraDirector` | Pelea con el usuario: no se puede explorar libremente con el ratón |
| E7 | Sin interacción: no hay `onClick`/`onPointerOver` en nodos ni vehículo | toda la escena | La escena no enseña nada que no diga ya el texto |
| E8 | Iluminación plana: ambient + 3 point lights, sin entorno ni postproceso; `gridHelper` 120×120 | `LogisticsScene3D` | Aspecto «prototipo», objetos oscuros sobre fondo oscuro |
| E9 | `frameloop` continuo, sin límite de `dpr`, sin `PerformanceMonitor` | `<Canvas>` | Pantallas 4K/retina renderizan a resolución completa siempre |
| E10 | La escena no conoce el estado de la rotura de frío ni el escrow | props | La 3D no refleja la incidencia (sólo el HUD) |

### 1.3 Interfaz

| # | Hallazgo | Impacto |
|---|---|---|
| U1 | Overlays absolutos que se solapan con la escena y entre sí (barra de validadores, timeline, el aviso del asistente) | Zona útil de la escena muy pequeña |
| U2 | En móvil el Explorer (y la pestaña SDK) está oculto (`hidden lg:flex`) | Lo más «SDK» del simulador no se ve en móvil |
| U3 | Los textos de las 16 etapas mezclan producto real con guion (DPP, e-BL DCSA, DIDs `did:etr:…`) | Riesgo de afirmaciones no respaldadas (ver registro de claims) |

## 2. Objetivos

1. **Se ve siempre**: tema claro u oscuro, con o sin WebGL, escritorio y móvil.
2. **Animación creíble**: los vehículos recorren la ruta real, la cámara cuenta la historia y el usuario puede tomar el control.
3. **Interacción útil**: clicar un nodo o el vehículo enseña la llamada SDK, el contrato y la evidencia de esa etapa.
4. **Honesto**: lo que se muestra existe en la API (`sdkMap.ts`); lo demás se etiqueta como demostración.
5. **Barato**: 60 fps en un portátil con gráfica integrada; menos de 100 *draw calls*.

## 3. Plan por fases

Cada fase se entrega con capturas GPU/no-GPU (§5) y pasa los tests de `vitest`.

### Fase 1 — Rendimiento y estabilidad · ✅ hecha (2026-11-06), salvo la meta de draw calls
- [x] **E9** `dpr` adaptativo con `<PerformanceMonitor>` (arranca a máxima calidad, tope 1,75, empieza a medir a los 4 s para no confundir la carga con un equipo lento; sólo reacciona por debajo del 50 % del refresco). Si el equipo no llega, apaga el postproceso. *Cambio respecto al plan:* en vez de `frameloop="demand"` (congelaba grúas, mar y barreras en reposo), el bucle se para cuando la escena sale de la pantalla (`IntersectionObserver`).
- [x] **E3** `Vehicle` reutiliza vectores y `Object3D`: cero asignaciones por frame.
- [x] **E2** Oleaje en el *vertex shader* con normales analíticas (antes 2.145 vértices en CPU por frame, sin normales).
- [x] **E1** Pedestales y contenedores del buque instanciados; `castShadow` sólo en piezas con volumen (93 → 41 mallas); sombras **bajo demanda**: el mapa de sombras sólo se recalcula al cambiar de etapa o mientras se mueve el vehículo. Mapa de sombras 2048 con cámara ajustada a la escena.
- [x] Contexto perdido → `RouteMap2D` sin recargar.
- [ ] **Pendiente:** ≤ 100 draw calls. Hoy 174 por frame en marcha (con postproceso) frente a 216 del original. Para bajar de 100 hace falta fusionar la geometría estática de cada nodo (`<Merged>`/`mergeGeometries`), que encaja mejor con los modelos GLTF de la Fase 2.

**Medido** con `frontend/scripts/sim-capture.py` (RTX 5050, 1600×1000, desarrollo):

| | Original | Ahora |
|---|---|---|
| Draw calls por frame en marcha (media de 60) | 216 | 174 (incluye ~12 pasadas de postproceso) |
| Mallas con sombra | 93 | 41 |
| fps (GPU) | 60 | 60 |
| fps con CPU ×6 | 26 | 24–26 (equivalente, con bloom, entorno y partículas añadidos) |
| Oleaje | CPU, sin normales | GPU, con normales |

El perfil de CPU con ×6 muestra que el 74 % del tiempo es trabajo nativo del navegador (composición y comandos GL), no JavaScript de la escena.

### Fase 2 — Aspecto visual · ✅ hecha (2026-11-06), salvo los modelos GLTF
- [x] **E8** `<Environment>` procedural con `<Lightformer>` teal, rosa y blanco (sin descargar HDRI), hemisférica y sol con sombras suaves; exposición ACES 1,1.
- [x] Postproceso `@react-three/postprocessing` 2.19 (postprocessing 6.39, compatible con r3f 8 y three 0.180): `Bloom` selectivo (umbral 1.0: sólo brilla lo que tiene color > 1), `Vignette`, `SMAA`. Se apaga solo si el equipo no llega.
- [x] Rutas por estado: pendiente (gris, quieta), activa (fluye), completada (teal), rota por rotura de frío (rojo). Partículas instanciadas que recorren la curva con bloom. El tramo aéreo es un arco y el marítimo va rasante.
- [x] **E5** Etiquetas en WebGL (`<Billboard>` + `<Text>`), ya no se montan sobre el HUD; sólo la telemetría del vehículo sigue en `<Html>`, por debajo de los overlays.
- [x] Suelo que recibe sombras + `<Grid>` infinita que se desvanece con la distancia.
- [ ] **Pendiente:** modelos GLTF propios (terminal, grúa, buque, avión, camión) con Draco/KTX2. Requiere modelarlos; con ellos se fusiona la geometría y se cumple la meta de draw calls de la Fase 1.

### Fase 3 — Animación · ✅ hecha (2026-11-06)
- [x] **E4** Una ruta compartida (`scene/routePath.ts`): las curvas que se dibujan son las mismas por las que avanza el vehículo, que se coloca por **distancia recorrida** sobre la ruta (frena al llegar a cada parada, rumbo por un punto algo más adelantado). Se acabó el trayecto en línea recta: el barco ya no cruza tierra. Medido con la GPU: en modo marítimo el barco pasa por z = 3 en todo el tramo internacional (la línea entre los dos puertos) y su altura máxima es 0,22.
- [x] Avión con arco real: el tramo aéreo sube y baja con la propia geometría de la curva (medido: 0,65 → 0,89 → 2,68 → 4,45 → 4,48 → 2,76 → 0,97), con alabeo proporcional al giro. Ya no depende de una constante de 15 unidades.
- [x] La velocidad del vehículo sigue la de la simulación (1×/2×/5×).
- [x] **E10** Rotura de frío en la escena: el contenedor y la luz IoT del vehículo pasan a rojo y parpadean más rápido, **escarcha** instanciada que sube y se disipa, rutas en rojo. Al terminar: chip «ESCROW CONGELADO · DISPUTA» sobre el destino; sin rotura, onda expansiva verde y chip «ESCROW LIBERADO».
- [x] Grúa del puerto: al estibar/embarcar (`STOWED`/`LOADED`) mueve un contenedor con ciclos de izado en vez de oscilar en vacío.
- [x] Timeline ↔ escena: con la simulación parada, pulsar una etapa del timeline o usar ←/→ salta a ella: el vehículo recorre la ruta hasta esa parada, la cámara la encuadra y se muestran anillo, baliza y llamada SDK (estado «explorando»).
- 10 tests nuevos (`scene/routePath.test.ts`): cada parada del flujo tiene su distancia, orden creciente, la ruta pasa por cada edificio (< 0,08), trayectoria continua, arco del avión vs. barco rasante y tramos sin hueco entre sí.
- Pendiente de esta fase: `maath/easing` para amortiguar la cámara (hoy `lerp`), y la transición visual camión → grúa → buque más allá del izado.

### Fase 4 — Interacción · ✅ hecha (2026-11-06)
- [x] **E6** Cámara **Director** (encuadra 3 s tras cada cambio de parada y suelta el control; si el usuario arrastra o hace zoom deja de dirigir hasta la siguiente parada) y **Libre** (sólo el usuario). Selector en la esquina inferior izquierda y tecla **C**.
- [x] **E7** (parcial) Clic en un edificio → ficha con sus etapas, actor, estado B-UID y la **llamada SDK** de cada una (`sdkMap.ts`), contrato y webhook. Anillo que late en la parada en curso (rojo con rotura de frío), anillo violeta en la seleccionada y **baliza 3D** con la llamada y el contrato de la etapa en curso. Cada etapa de la ficha muestra su **evidencia**: `payload_hash` (sha256 del JSON canónico, como `cargolink_transitions`) y, en las etapas de telemetría (3 y 11), la **raíz Merkle** del lote de lecturas del Edge Node con una **prueba de inclusión verificada en el navegador** (Web Crypto) con el mismo algoritmo que `cargoTelemetryAnchor.js` y `TelemetryAnchor.verify`; un test compara ambas implementaciones bit a bit. Anillo claro al pasar el ratón por un edificio (más barato que `<Outlines>`, que exigiría duplicar cada malla). **Esc** cierra la ficha.
- [x] Clic en el vehículo → **ficha del Edge Node** con temperatura, humedad e impacto y la **prueba de inclusión** de la última lectura frente a la raíz del lote (la misma que devolvería `GET /v1/iot/proof`), verificada en el navegador. El volumen de clic del vehículo tiene prioridad sobre el del edificio que lo envuelve.
- [x] Atajos: **espacio** (ejecutar / pausar y reanudar), **←/→** (etapa, con la simulación parada), **F** (pantalla completa), **C** (cámara), **Esc** (cerrar fichas). Sólo actúan con el simulador en pantalla y sin escribir en un campo. Botón **Pausa/Reanudar** y `aria-live` con la etapa en curso para lectores de pantalla.
- [x] **U1** HUD izquierdo plegable (arranca plegado en pantallas < 768 px). El aviso proactivo del asistente ya no aparece mientras la simulación corre (`data-immersive` + contexto `immersive` en `isBlockedContext`, con test).
- [x] **U2** Móvil: botón «SDK · Explorer» que abre el Explorer (con la pestaña SDK) como panel inferior; en lg+ sigue siendo la barra lateral.

**Medido tras la Fase 4** (RTX 5050, mismas condiciones): ≈ 188 draw calls por frame en marcha (174 tras las Fases 1-2, 216 el original). Los ~14 de más son baliza SDK, anillos de parada y línea guía. 60 fps con GPU; ≈ 24 fps con la CPU a ×6. Pendiente de la Fase 1 sigue siendo fusionar geometría para bajar de 100.

**Tras la Fase 3** (mismas condiciones): ≈ 181 draw calls por frame en marcha (pico 255 en etapas con escarcha y grúa), 60 fps con GPU, ≈ 23 fps con la CPU a ×6.

### Fase 5 — Modo «sandbox real» · ✅ hecha (2026-11-06)
- [x] Interruptor **Demo / Sandbox** en la cabecera y panel de configuración (URL de la API de pruebas + 5 claves de rol). En Demo no se hace ninguna llamada. En Sandbox cada etapa ejecuta de verdad su llamada de `sdkMap.ts` y la simulación muestra la respuesta real (estado, ancla, error) en la tarjeta SDK, en el historial del Explorer y en el log; el HUD pasa a mostrar el **B-UID real**.
- [x] Salvaguardas (`engine/sandbox.ts`): sólo entornos de prueba (localhost, `*.localhost`, `*.test` o un host `https` con una etiqueta staging/sandbox/dev/test/qa/preview; `api.bezhas.com` y cualquier otro se rechazan, con tests); claves sólo en `sessionStorage` (se borran al cerrar la pestaña) y nunca en logs; `posRef` y `deviceId` únicos por ejecución; el panel se bloquea mientras corre la simulación.
- [x] Sin la clave de un rol, sus etapas se **saltan indicando el motivo**; si la etapa 1 falla, las demás no lanzan llamadas.
- [x] Sin claves, los endpoints de producto ya responden en vista previa (`mode: 'preview'`).
- [x] Verificado de punta a punta con la API actual (base de datos de pruebas aparte, ya borrada): el ciclo completo dejó `DELIVERED` con escrow `RELEASED`, 7 transiciones reales por rol, custodia, inspección, cambio de ETA, telemetría, anclaje Merkle y tránsito multipaís. Con rotura de frío: escrow `DISPUTED` con una disputa real (`HOLD_ESCROW`, «COLD_CHAIN_BREACH: temperature 22.8°C outside [2,8]»).
- **El sandbox destapó errores del mapa SDK, ya corregidos:** tipo de dispositivo (`multi`, no `cold-chain`), tipo de inspección (`SCAN`), `changeType` (`ETA_CHANGE`), campos exigidos en GATE_IN/GATE_OUT/entrega (`quantityKg`, `carrierRef`, `signatureHash`), `escrowAmountBez` (no `escrowAmount`), la etapa 11 necesita avanzar a `IN_TRANSIT` antes de anclar, la 13 necesita crear antes el envío multipaís, y la rotura de frío **no** es una incidencia (`/incidents` no tiene ese tipo): entra por telemetría fuera de rango y la gradúa el Dispute Oracle.
- [x] Test de contrato (`engine/sandbox.test.ts`): cada avance del mapa SDK pasa los **validadores reales de la API** (`cargoLinkValidators.js`). 29 tests nuevos.
- Limitaciones conocidas: la etapa 15 (custodia final) se salta, porque sólo el custodio actual puede cederla y haría falta su propia clave; los anclajes salen `not_configured` mientras la API no tenga contratos configurados; el contenedor local `bezhas-api` lleva una imagen antigua (con los datos falsos de CargoLink) y hay que reconstruirla para usarlo como destino.

### Fase 6 — Actualización de stack (≈ 2–4 días, aislada)
- [ ] React 19 + @react-three/fiber 9 + drei 10 (requieren React 19). Hacerlo en rama propia: el Hub entero está en React 18, así que afecta a más que al simulador.
- [ ] Con r3f 9: renderer asíncrono para probar **`WebGPURenderer`** de three (0.180 lo incluye, con *fallback* a WebGL2) y materiales TSL para mar y rutas. Mantener WebGL2 por defecto hasta medir ganancia real.
- [ ] Vite 5 → 6/7 sólo si lo exige alguna dependencia.

### Fuera de alcance
- Recrear el aspecto de productos o juegos existentes; los modelos son propios.
- Datos de geolocalización reales de terceros (AIS/MarineTraffic) en la demo pública.

## 4. Riesgos

| Riesgo | Mitigación |
|---|---|
| Las reglas `!important` de `index.css` afectan a otras zonas oscuras del Hub | Reutilizar `.theme-island`; a medio plazo, sustituir esas reglas globales por variables de tema |
| Modelos GLTF engordan el bundle | Escena ya en *lazy chunk*; Draco/KTX2; presupuesto ≤ 1,5 MB de assets |
| Postproceso en GPUs débiles | Activarlo sólo si `PerformanceMonitor` lo permite |
| Upgrade a React 19 rompe otras páginas | Fase 6 aislada, con su rama y pruebas del Hub completo |
| Sandbox llama a producción por error | URL base fija a local/staging; claves de prueba; nunca la clave real |

## 5. Verificación

- **Capturas automáticas**: script Playwright (Chromium con `--use-angle=gl-egl` y la NVIDIA, como el pipeline de vídeo) que abre `/developer-console → SDK Simulator`, ejecuta la simulación y guarda capturas en tema claro, oscuro y sin WebGL, además de fps y `gl.info.render.calls`. Está en `App-nativas/Bezhas-Hub/frontend/scripts/sim-capture.py`.
- **Tests**: `vitest` de `engine/` (flujo, `sdkMap`) y `scene/routePath.test.ts` (la ruta del vehículo).
- **Revisión visual**: antes/después en cada fase.

## 6. Orden recomendado

Fase 1 → 2 → 3 → 4 dan el salto visual y de interacción sin tocar dependencias
mayores. La Fase 5 aporta el valor comercial (demostrar la API de verdad) y
puede ir en paralelo a la 4. La Fase 6 sólo cuando el resto esté estable.
