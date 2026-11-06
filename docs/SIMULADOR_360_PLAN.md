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
| Sin WebGL, hueco negro | — | Mapa 2D (`RouteMap2D`) y límite de errores de la escena |
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

### Fase 3 — Animación (≈ 3 días)
- [ ] **E4** Una `CatmullRomCurve3` por tramo (las mismas que dibuja `RoutesNetwork`); el vehículo avanza por `curve.getPointAt(t)` con orientación por la tangente y velocidad ligada a la de la simulación (1×/2×/5×).
- [ ] Avión con arco real (despegue, crucero, aterrizaje) calculado sobre la longitud del tramo, no sobre una constante.
- [ ] Transiciones de vehículo (camión → grúa → buque) con la grúa animando la carga del contenedor.
- [ ] **E10** Rotura de frío: el contenedor pasa a rojo, partículas de escarcha que se disipan y pulso en la ruta; al resolverse el escrow, efecto en el nodo destino.
- [ ] Timeline ↔ escena: al pulsar una etapa del timeline, la cámara y el vehículo saltan a ese punto (hoy sólo cambia el índice).
- Librería: `maath/easing` (`damp3`, `dampQ`) en vez de `lerp` manual: amortiguación independiente del framerate. `maath` llega como dependencia de drei, pero con pnpm hay que declararla directa.

### Fase 4 — Interacción (≈ 3 días)
- [ ] **E6** Cámara en dos modos: **Director** (sigue la etapa con `CameraControls` de drei y `setLookAt` animado) y **Libre** (se activa al tocar la escena; botón «Volver al director»).
- [ ] **E7** Clic en un nodo → panel con: actor, estado B-UID, **llamada SDK de esa etapa** (`sdkMap.ts`), contrato y webhook, evidencias (hash, raíz Merkle de telemetría). Hover → resalte con `<Outlines>`.
- [ ] Clic en el vehículo → telemetría en vivo del Edge Node (temperatura, humedad, impacto) y prueba Merkle simulada de una lectura (`GET /v1/iot/proof`).
- [ ] Atajos: espacio (pausa), ←/→ (etapa), F (pantalla completa), C (modo cámara). `aria-live` con la etapa actual para lectores de pantalla.
- [ ] **U1** Reordenar overlays: HUD plegable, validadores dentro del timeline, el aviso del asistente fuera del área del simulador.
- [ ] **U2** Móvil: Explorer como *bottom sheet* con la pestaña SDK.

### Fase 5 — Modo «sandbox real» (≈ 3 días, depende de la API)
- [ ] Interruptor **Demo / Sandbox**. En Sandbox, cada etapa ejecuta de verdad la llamada de `sdkMap.ts` contra la API local o de pruebas con claves de rol de prueba (`scripts/dev/test-profile.sh`), y la escena avanza con la respuesta real (`transaction.status`, `anchor.txHash`, webhooks).
- [ ] Sin claves, los endpoints de producto ya responden en **vista previa** (`mode: 'preview'`): el sandbox funciona también anónimo, sin escribir nada.
- [ ] Mostrar el `txHash` real y enlazar al explorador de la L2 de pruebas (2708) cuando el anclaje esté configurado.
- [ ] Cuando exista BON (`docs/BON_PROTOCOL_v0.1.md`), mostrar las firmas k-de-n de cada evento `SETTLEMENT`.

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
- **Tests**: `vitest` de `engine/` (flujo, `sdkMap`); añadir tests de la curva de ruta (el vehículo nunca sale del tramo) en la Fase 3.
- **Revisión visual**: antes/después en cada fase.

## 6. Orden recomendado

Fase 1 → 2 → 3 → 4 dan el salto visual y de interacción sin tocar dependencias
mayores. La Fase 5 aporta el valor comercial (demostrar la API de verdad) y
puede ir en paralelo a la 4. La Fase 6 sólo cuando el resto esté estable.
