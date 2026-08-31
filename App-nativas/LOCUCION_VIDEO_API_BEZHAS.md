# 🎙️ Locución (voz en off) — Vídeo API BeZhas

> Guion de narración listo para **TTS** (ElevenLabs · Azure · Google · Play.ht) o locutor humano.
> Timings sincronizados con el vídeo de 9 escenas (`bezhas-api-video.webm`, ~51 s total).
> Voz recomendada: **española neutra**, ritmo pausado, tono técnico-cercano. Ritmo ≈ 2,7 palabras/seg.
>
> **Flujo pro:** genera el audio TTS por escena (o de una pasada con el texto seguido) → impórtalo en tu editor sobre el `.webm` → alinea con los timings de abajo → añade música de fondo suave (−18 dB). Los subtítulos van en `bezhas-api-video.srt` (cárgalos en YouTube como pista de subtítulos).

| Escena | Entra | Sale | Locución |
|---|---|---|---|
| 1 · Hook | 0:00,3 | 0:04,4 | Tu empresa es una isla. BeZhas es el puerto común que lo conecta todo. |
| 2 · Adopción | 0:04,9 | 0:09,8 | Empezar no requiere reescribir nada. Cero dependencias, una clave, y ya estás operando. |
| 3 · Cómo se usa | 0:10,3 | 0:16,2 | Cobrar, o enlazar tu punto de venta, es una sola llamada. Y cada evento vuelve firmado. |
| 4 · Jerarquía | 0:16,7 | 0:21,8 | Un holding no gestiona una API: gestiona un árbol de APIs. La matriz lo ve todo. |
| 5 · Control matriz | 0:22,3 | 0:27,4 | Y gana control y dinero: datos, políticas de gasto, tesorería y comisión en cascada. |
| 6 · Rentabilidad | 0:27,9 | 0:34,0 | Un operador de ochocientos millones recupera más de diecisiete al año. Setecientos euros de valor por cada euro invertido. |
| 7 · Planes | 0:34,5 | 0:40,0 | Cuatro planes. La jerarquía se activa en Business y se despliega en Enterprise VIP. |
| 8 · SubApps | 0:40,5 | 0:45,6 | La misma clave y el mismo SDK ya viven en trece aplicaciones del ecosistema. |
| 9 · Cierre | 0:46,1 | 0:50,8 | Empieza gratis hoy. Convierte tu gasto operativo en un activo que trabaja para ti. |

## Texto seguido (para TTS de una sola pasada)

Tu empresa es una isla. BeZhas es el puerto común que lo conecta todo. Empezar no requiere reescribir nada: cero dependencias, una clave, y ya estás operando. Cobrar, o enlazar tu punto de venta, es una sola llamada. Y cada evento vuelve firmado. Un holding no gestiona una API: gestiona un árbol de APIs. La matriz lo ve todo. Y gana control y dinero: datos, políticas de gasto, tesorería y comisión en cascada. Un operador de ochocientos millones recupera más de diecisiete al año. Setecientos euros de valor por cada euro invertido. Cuatro planes: la jerarquía se activa en Business y se despliega en Enterprise VIP. La misma clave y el mismo SDK ya viven en trece aplicaciones del ecosistema. Empieza gratis hoy. Convierte tu gasto operativo en un activo que trabaja para ti.

## Notas de producción de audio

- **Música:** pista corporativa/tech ~90–100 BPM, sin voz, a −18 dB bajo la locución; sube a −10 dB en el intro (0:00–0:04) y el cierre (0:46–0:51).
- **Pausas:** deja 0,3–0,5 s de silencio entre escenas (ya reflejado en los timings).
- **Énfasis:** recalca las cifras de la escena 6 ("diecisiete", "setecientos") y los nombres de plan en la escena 7.
- **Disclaimer hablado opcional** al final: "Simulación ilustrativa; no constituye asesoramiento financiero."
- **Preview instantáneo:** el propio vídeo (artifact) tiene un botón "🔊 Narración" que usa la voz del navegador para escuchar el timing antes de generar el TTS final.
