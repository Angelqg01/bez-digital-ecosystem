# Mapa de CargoLink

Mapa real (Leaflet 1.9.4 empaquetado, teselas OpenStreetMap) en la pantalla **Active** (`/`).

| Pestaña | Qué hace |
| :-- | :-- |
| Seguimiento | Todos los B-UIDs en el mapa: posición GPS real (telemetría IoT) o **estimada** por etapa si aún no hay GPS, rastro, ETA, sensores, alertas (precinto, umbrales, fuera de zona). |
| Crear ruta | Modo (marítimo/carretera/tren/aéreo), origen y destino por puerto o clic en el mapa, pasos y canales, corredor vigilado ± km. Crea el B-UID con `cargo.route` y, si hay corredor, una geocerca `route_corridor` con `enforce`. |
| Zonas | Crear (círculo: puerto, aduana, almacén) y eliminar geocercas; se dibujan por tipo. |

Capas: puertos, envíos, rutas, zonas (se activan/desactivan). Base «Oscuro» (filtro CSS) o «Calles».

## Código
- `src/utils/geo.js` — geodesia pura (haversine, círculo máximo, corredor, ETA). Tests: `tests/geo.test.mjs`.
- `src/services/mapData.js` — telemetría + transacción → envío del mapa. Tests: `tests/mapData.test.mjs`.
- `src/components/CargoMap.jsx` — motor Leaflet (presentación). `CargoMapHub.jsx` — paneles y llamadas a la API.
- `pnpm test` ejecuta los 22 tests.

## Límites conocidos
- La ruta marítima es un **círculo máximo con tus pasos**, no un enrutador náutico: añade canales/estrechos para no cruzar tierra.
- Crear B-UIDs y zonas exige clave con rol `pos` o `admin` (la API responde 403 si no).
- Teselas: OSM exige uso moderado y atribución. Para producción con mucho tráfico define `VITE_MAP_TILES_URL` (y `VITE_MAP_TILES_ATTRIBUTION`) con un proveedor propio o de pago. CARTO ya no sirve teselas sin API key.
- Los B-UIDs antiguos sin `cargo.route` solo se dibujan si origen/destino coinciden con un puerto de la lista.
