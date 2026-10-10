# Pruebas como empresa cliente — Atlas Contable Industrial S.L. (datos ficticios)

Escenario: una empresa que lleva toda su contabilidad, quiere tokenizar activos y pagar nóminas, y explora BeZhas entero:
el chat (barra del equipo), la API REST del Gateway, el MCP (su IA) y la conexión con una plataforma de terceros (un Odoo
ficticio). Fecha: 2026-10-09. Todo contra el stack local; los pagos reales con Stripe no se ejecutaron (plan Business
simulado en la base local).

| Fichero | Qué prueba | Resultado |
|---|---|---|
| 02 | Preguntas de la empresa al chat (contabilidad, tokenización, nóminas…) | respuestas con el documento correcto |
| 03 + 03b | Pregunta gratis, 402 sin plan, streaming, consumo, 23 acciones, documentos privados, historial, defensas, aislamiento entre empresas | 23/23 y aislamiento OK |
| 04 | ERP de terceros (Odoo): conexión, DPA, lectura de facturas/activos/nómina, controles de escritura | 20/20 |
| 05 | La IA de la empresa por MCP: costes, ERP, tokenizar, nóminas con política, cobros | 25/25 |
| 06 | API REST del Gateway con api-key de terceros | 19/19 |
| 07 | Panel de organización: roles, KYB, wallets, contratos, credenciales cifradas, facturación | 22/22 |
| 08 | La barra del equipo en el navegador (preguntas, paneles, ventana de planes) | OK |
| 09 | Suite completa de la API | 1540 pasan, 0 fallan |

## Fallos encontrados y corregidos
1. **La API se caía entera** (`unhandledRejection` en `middleware/security.js`): un fallo de BD dentro de un middleware async
   mataba el proceso para todos los clientes. Ahora responde 503 y sigue viva.
2. **`polygon-rpc.com` ya no sirve tráfico** («tenant disabled»): rompía la lectura de la comisión de tokenización, saldos y
   liquidación. Sustituido por `polygon-bor-rpc.publicnode.com` en código, ejemplos, despliegue y `.env` local.
3. **Conector ERP:** un activo listado con referencia `AST-0002` no se podía leer después (buscaba por `name`, no por `code`).
4. **Conector ERP:** la ruta ignoraba en silencio un filtro desconocido, contra lo que dice su propio comentario. Ahora 400.
5. **Conector ERP:** el override de desarrollo para hosts privados no se aplicaba al conectar (se podía dar de alta una conexión
   que luego nunca conectaba). Sigue sin poder activarse en producción.
6. **Motor de políticas:** un cliente podía usar como origen de un pago la hot wallet o la tesorería de BeZhas pasándola como
   `evm_address`. Ahora `SOURCE_PROTECTED_ADDRESS` (DENY).
7. **Base de conocimiento del chat:** no había nada sobre tokenizar activos, nóminas, ERP, contabilidad, normativa ni integración
   por API (respondía «Cómo comprar BEZ» a «¿cómo tokenizo maquinaria?»). Añadidos 6 documentos y palabras clave de acciones.
8. **Tokenización:** la primera lectura de la comisión tras arrancar fallaba y la causa se tragaba. Reintento, log de la causa
   y precarga al arrancar.
9. **Entorno local:** `BEZHAS_CHAIN_ID=31337` con la API en producción hacía fallar `/token/info` y `/contracts/list`;
   CORS bloqueaba la landing local (`:3000`); límite de 100 peticiones/15 min inutilizable para un SPA.

## Hallazgo abierto (sin causa identificada)
Cortes intermitentes de conexión a Postgres desde la API en este entorno local («Connection terminated due to connection
timeout», 5 s por petición, durante ~40 s tras reiniciar procesos o tras pausas). Conexiones independientes desde el mismo
contenedor siempre tardan ~5 ms y un monitor de 200 s con tráfico constante no registró ningún corte. Con la corrección 1 ya
no tumba el servicio, pero conviene investigarlo antes de producción.

## No probado
Pago real de un plan con Stripe (tarjeta → webhook → plan activo), firma real de una tokenización con wallet, correo SMTP.
