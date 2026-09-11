# Telemetría de uso y episodios de servicio — marco de protección de datos

*Registro de la actividad de tratamiento, base jurídica, plazos y derechos.
Documento técnico-jurídico de referencia para el pipeline implementado en
`api/services/telemetryPipeline.js` y `api/services/episodeAnonymizer.js`.*

> **Este documento lo ha redactado un ingeniero, no un abogado.** Describe con
> precisión qué hace el sistema y con qué encaje normativo se ha construido, y
> está pensado para que un asesor jurídico lo revise y lo convierta en el texto
> contractual definitivo. **La evaluación de interés legítimo del §4 y las
> cláusulas del §8 necesitan validación legal antes de usarse con un cliente.**

**Normativa aplicable:** Reglamento (UE) 2016/679 (RGPD) · Ley Orgánica 3/2018
(LOPDGDD) · Reglamento (UE) 2023/1114 (MiCA), en lo relativo a conservación de
registros · Directiva (UE) 2023/2226 (DAC8).

---

## 1. Por qué existe este tratamiento

BeZhas presta un servicio que se consume a través de agentes de IA. Cuando algo
no funciona, el cliente no llama: su agente lo intenta de otra forma, falla otra
vez y la persona se va. Sin telemetría, nosotros no nos enteramos.

Lo que se quiere responder con datos y hoy se contesta por intuición:

- ¿Qué piden los agentes que **no** tiene herramienta y acaba en soporte humano?
  → hueco de catálogo. Es la señal de producto más valiosa que existe.
- ¿Qué herramienta se invoca mal más veces? → su descripción está mal escrita.
  Una descripción de herramienta es un prompt: se itera con datos.
- ¿Qué flujos necesitan más turnos hasta resolverse? → candidatos a empaquetar.
- ¿Qué aprobaciones se rechazan siempre? → o el agente propone mal, o esa regla
  debería estar automatizada.

**Lo que NO se hace con esto:** no se entrena ningún modelo con contenido de
clientes, en ningún plan. De aquí salen mejoras de prompt, de descripción de
herramienta, de catálogo y de documentación, evaluadas contra un conjunto de
episodios seudonimizados.

---

## 2. Las tres capas

La separación no es organizativa: es lo que hace el tratamiento defendible, y
está impuesta por el esquema de la base de datos (migración 057).

| Capa | Qué contiene | Finalidad | Base jurídica | Plazo |
|---|---|---|---|---|
| **1. Operacional** | contenido de las llamadas: documentos, importes, direcciones, texto | prestar el servicio, y nada más | art. 6.1.b (contrato); art. 28 cuando es dato del ERP del cliente | según contrato |
| **2. Telemetría** | herramienta, **forma** de los argumentos, latencia, error, reintento, aprobación | mejorar el servicio | art. 6.1.f (interés legítimo), oposición art. 21 | **90 días** |
| **3. Episodios** | telemetría agregada + intención + resolución, seudonimizada y por sector | conjunto de evaluación | art. 6.1.f sobre dato ya seudonimizado (art. 4.5) | **24 meses** |

**La regla que lo sostiene:** la capa 1 **nunca** alimenta la 3 sin pasar por
seudonimización. Si un episodio no sobrevive a ese borrado, no era un episodio:
era el dato del cliente.

**Cómo se impone, y no sólo se promete:**

- La migración 057 **no crea ninguna tabla para la capa 1**. Ese dato se queda
  donde ya estaba.
- `cs_episodes` **no tiene ninguna columna de texto libre** donde quepa
  contenido. Una columna que no existe no se rellena en un parche futuro.
- `agent_telemetry` no tiene `payload`, ni `request_body`, ni `response`, ni
  `prompt`. Lo que se guarda de los argumentos es su forma:
  `{"amount": "decimal", "from": "enum_corto"}` — nombres de campo y tipos.
- Una comprobación de salida (`contieneContenido`) descarta la fila entera si
  algún valor de la forma no es uno de los tipos conocidos.

---

## 3. Registro de la actividad de tratamiento (art. 30 RGPD)

| Campo | Contenido |
|---|---|
| **Responsable** | BeZhas — Algeciras, España. *(Completar con razón social, CIF y DPD si se designa.)* |
| **Denominación** | Telemetría de uso de la plataforma y episodios de servicio automatizado |
| **Finalidad** | Mejora y depuración del servicio: detección de huecos de catálogo, corrección de descripciones de herramienta, identificación de flujos a empaquetar y medición de la calidad del servicio automatizado |
| **Categorías de interesados** | Personas que operan la plataforma en nombre de clientes empresariales (usuarios de las api-keys) |
| **Categorías de datos** | Identificador seudonimizado de inquilino; metadatos técnicos de uso (herramienta invocada, forma de argumentos, latencia, códigos de error, reintentos, resultado de aprobaciones). **No** se tratan categorías especiales (art. 9) ni datos de condenas (art. 10) |
| **Base jurídica** | Art. 6.1.f RGPD — interés legítimo del responsable en mejorar y asegurar su servicio. Ver la evaluación del §4 |
| **Destinatarios** | Ninguno. No hay cesiones ni acceso de terceros a estas tablas |
| **Transferencias internacionales** | Ninguna. Alojamiento en la UE (VPS, Frankfurt) |
| **Plazos de supresión** | Telemetría 90 días; episodios 24 meses. Purga automática por `purgar_despues_de` |
| **Medidas de seguridad** | Seudonimización con HMAC-SHA256 y clave fuera de la base; cifrado en tránsito; control de acceso por api-key y scope; minimización estructural (columnas inexistentes); registro de accesos |

---

## 4. Evaluación de interés legítimo (art. 6.1.f)

Los tres pasos que exige el test, para que conste el razonamiento y no sólo la
conclusión.

### 4.1 Test de finalidad — ¿el interés es legítimo?

Sí. Mejorar y depurar un servicio propio es un interés legítimo expresamente
reconocido (considerando 47 RGPD, que cita el tratamiento estrictamente
necesario para prevenir el fraude y para fines de mercadotecnia directa como
ejemplos, y admite con carácter general el interés del responsable en el
funcionamiento de su servicio). Aquí es más estrecho todavía: detectar dónde
falla el producto.

### 4.2 Test de necesidad — ¿hace falta este dato para eso?

Sí, y sólo este. No existe forma de saber qué herramienta se invoca mal, o qué
piden los agentes que no tenemos, sin observar las invocaciones.

Se descartaron dos alternativas menos intrusivas:

- **Preguntar a los clientes.** No sirve: quien se encuentra un hueco no lo
  reporta, cambia de herramienta o se va. La ausencia de queja es precisamente
  el problema.
- **Muestreo agregado sin identificador ninguno.** Se pierde la capacidad de
  atender el derecho de acceso y de supresión, porque no habría cómo saber qué
  filas son de quién. El seudónimo es *más* garantista que el anonimato total
  en este punto concreto, y por eso se eligió.

El dato es el mínimo posible: **la forma de los argumentos, no su contenido**.

### 4.3 Test de equilibrio — ¿prevalece sobre los derechos del interesado?

Elementos que reducen el impacto sobre el interesado:

- No se trata contenido, sólo metadatos de uso. No se puede reconstruir qué
  consultó, cuánto pagó ni con quién opera.
- El dato está seudonimizado desde el momento de la escritura (art. 4.5): en la
  tabla no hay ningún identificador de cliente en claro.
- No hay elaboración de perfiles de personas físicas ni decisiones automatizadas
  con efectos jurídicos (art. 22).
- Plazos cortos y purga automática.
- El contexto es profesional, no doméstico: el interesado usa la plataforma en
  nombre de una empresa, en el marco de un contrato mercantil. La expectativa
  razonable de que el proveedor mida el funcionamiento de su propio servicio es
  alta.
- **Oposición disponible y efectiva** (§6), y régimen zero-retention en los
  planes que lo contratan.

**Conclusión:** el interés legítimo prevalece, con las garantías descritas. La
conclusión decae si alguna vez se recoge contenido, si se alarga el plazo o si
se elimina la oposición — cualquiera de las tres obliga a rehacer esta
evaluación.

---

## 5. Zero-retention: qué significa exactamente

Los planes **Business** y **Enterprise VIP** contratan zero-retention. Para esos
inquilinos:

- **No se escribe ni una fila** de telemetría ni de episodios. No es que se
  borren antes: es que no se crean.
- La comprobación está **antes del INSERT**, en `telemetryPipeline.permiteRecoger()`,
  no en un procedimiento manual.

Se vende como característica del plan, así que tiene que ser verificable. Lo es:
`api/__tests__/services/telemetryPipeline.test.js` falla si alguna vez se
escribe algo para un plan zero-retention.

---

## 6. Derechos del interesado

| Derecho | Artículo | Cómo se ejerce | Efecto |
|---|---|---|---|
| Información | 13 | `GET /api/gateway/v1/privacy/telemetry` | Devuelve finalidad, base jurídica, qué se recoge, qué no, y plazos |
| Acceso | 15 | `GET /api/gateway/v1/privacy/telemetry/export` | Exporta la telemetría del inquilino |
| Supresión | 17 | `DELETE /api/gateway/v1/privacy/telemetry` | Borra la telemetría. Los episodios no: ver nota abajo |
| Oposición | 21 | `POST /api/gateway/v1/privacy/telemetry` con `{"telemetria": false}` | Efecto inmediato; se registra la fecha |
| Limitación | 18 | Oposición parcial (`{"episodios": false}`) | Se sigue recogiendo telemetría pero no se derivan episodios |

**Por qué la supresión no alcanza a los episodios.** Están agregados por sector
y no contienen dato que permita identificar al inquilino, así que no son datos
personales suyos que suprimir. La respuesta del endpoint lo dice explícitamente
en vez de callarlo: dejar creer a alguien que borró algo que sigue ahí sería
peor que negarle la supresión con una razón.

**Si alguna vez un episodio pudiera reconducirse a un cliente concreto**, dejaría
de ser un episodio y esta decisión habría que rehacerla.

**Plazo de respuesta:** los endpoints son inmediatos, muy por debajo del mes que
concede el art. 12.3.

---

## 7. Seudonimización — qué es y qué no

`tenant_seudonimo` es un **HMAC-SHA256** del identificador de la app, con una
clave (`TELEMETRY_PSEUDONYM_KEY`) que **no está en la base de datos** y con una
sal por finalidad.

Consecuencias, y conviene ser preciso porque aquí se equivoca mucha gente:

- Quien vuelque `agent_telemetry` **no puede** revertirlo a un cliente sin la
  clave. Ése es el valor de seguridad.
- Nosotros **sí** podemos recalcularlo. Eso lo mantiene **dentro** del RGPD
  (art. 4.5, considerando 26), no fuera.
- Por tanto **no es dato anónimo** y no se llama así en ningún sitio. Llamarlo
  anónimo nos llevaría a tratarlo como si no tuviera plazo ni derechos, que es
  exactamente el error que se quiere evitar.
- El seudónimo de la telemetría **no permite cruzar** con ningún otro
  tratamiento, porque la sal es distinta.

En producción, la ausencia de `TELEMETRY_PSEUDONYM_KEY` hace fallar el arranque
del módulo: sin clave, el «seudónimo» sería un hash reproducible por cualquiera
con la tabla y no seudonimizaría nada.

---

## 8. Texto para el contrato y el DPA *(borrador — requiere revisión legal)*

### 8.1 Cláusula informativa para el contrato de servicio

> **Telemetría de uso.** BeZhas trata, como responsable, metadatos técnicos
> sobre el uso de la Plataforma (herramienta invocada, estructura —no contenido—
> de los parámetros, latencias, errores y resultados de las aprobaciones) con la
> finalidad de mejorar y depurar el Servicio. La base jurídica es el interés
> legítimo (art. 6.1.f RGPD). Estos datos se seudonimizan en el momento de su
> registro y se suprimen a los 90 días; los indicadores agregados por sector que
> se derivan de ellos se suprimen a los 24 meses.
>
> **BeZhas no trata el contenido de las operaciones del Cliente para esta
> finalidad, ni lo emplea para entrenar modelos de inteligencia artificial, en
> ninguna modalidad de suscripción.**
>
> El Cliente puede oponerse en cualquier momento, con efecto inmediato y sin
> coste, desde el panel o mediante el endpoint indicado en la documentación. Las
> modalidades Business y Enterprise VIP incluyen régimen *zero-retention*, en el
> que este tratamiento no se realiza en absoluto.

### 8.2 Delimitación de papeles

Conviene que quede escrito porque es el punto que más se confunde:

- Respecto del **contenido** que el Cliente introduce o al que BeZhas accede en
  su ERP, BeZhas es **encargado del tratamiento** (art. 28) y se rige por el DPA.
- Respecto de la **telemetría de uso de su propia plataforma**, BeZhas es
  **responsable** (art. 4.7). Es tratamiento de datos propios sobre el
  funcionamiento de su servicio, no un tratamiento por cuenta del Cliente.

Esta doble condición es habitual en un proveedor SaaS y no es contradictoria,
pero tiene que estar declarada: si no, un Cliente puede razonablemente entender
que todo lo que ocurre en la Plataforma se trata por cuenta suya.

### 8.3 Anexo al DPA — lo que NO cubre

El DPA regula el tratamiento del contenido del Cliente. **No** ampara la
telemetría del §2, que tiene su propia base jurídica y su propio régimen de
derechos. Debe añadirse una mención cruzada para que el Cliente sepa dónde está
regulado cada tratamiento.

---

## 9. Lo que falta y quién lo tiene que hacer

Esto es ingeniería terminada, no cumplimiento terminado:

1. **Revisión legal** de la evaluación de interés legítimo (§4) y de las
   cláusulas (§8) antes de usarlas con un cliente.
2. **Completar el registro** del §3 con razón social, CIF, domicilio y, si
   procede, delegado de protección de datos.
3. **Actualizar la política de privacidad** publicada y el contrato de servicio.
4. **Decidir si procede una EIPD** (art. 35). A priori no: no hay observación
   sistemática a gran escala de personas, ni categorías especiales, ni decisiones
   automatizadas con efectos jurídicos. Conviene dejar por escrito ese
   razonamiento aunque la conclusión sea que no hace falta.
5. **Fijar `TELEMETRY_PSEUDONYM_KEY`** en producción, distinta de cualquier otra
   clave del sistema, y documentar su custodia y rotación.
6. **Informar a los clientes existentes** antes de activar la recogida, con
   antelación suficiente para que puedan oponerse.

> **El interruptor no está activado.** El pipeline está implementado y probado,
> pero mientras los puntos 1 a 6 no estén resueltos, activarlo en producción
> sería tratar datos sin haber cerrado la base jurídica ni informado a los
> interesados. La secuencia correcta es: revisión legal → información a clientes
> → activación.

---

## 10. Referencias del código

| Pieza | Fichero |
|---|---|
| Esquema y plazos en la fila | `api/db/migrations/057_telemetry_and_episodes.sql` |
| Seudonimización y forma de argumentos | `api/services/episodeAnonymizer.js` |
| Comprobaciones de plan y oposición | `api/services/telemetryPipeline.js` |
| Régimen por plan (zero-retention) | `api/config/plan-entitlements.js` |
| Derechos del interesado | `api/routes/gateway.js` (`/privacy/telemetry*`) |
| Purga por plazo | `api/services/onboardingSweeper.js` |
