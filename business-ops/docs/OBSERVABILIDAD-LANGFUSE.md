# Observabilidad de LLM: Langfuse (self-hosted en Ubuntu Server)

**Qué es y por qué (Fase 1 de [Plan Parte 3](../../Plan%20Parte%203%20-%20Frameworks%20B2B%20y%20Optimizacion.md)):**
Langfuse traza cada llamada al modelo — prompt, respuesta, tokens, tenant, agente,
tier — para poder depurar producción, detectar regresiones de prompt y ver el
coste real por tenant/agente. Complementa a `Telemetry`/`OtlpExporter` (que ya
existían): esos dan métricas agregadas (tareas, latencias, contadores);
Langfuse da la traza individual con el contenido real de cada llamada.

Se integra igual que el resto del stack soberano: sin SDK, con fetch crudo
(`src/platform/LangfuseExporter.js`, mismo patrón que `OtlpExporter.js`), y
sin credenciales configuradas no hace absolutamente nada.

---

## 1. Requisitos en el servidor

Langfuse añade **una pieza nueva** al stack: ClickHouse (el motor donde guarda
las trazas). Todo lo demás lo reutiliza del perfil `core` que ya tienes
(Postgres, Redis/Valkey, MinIO).

- **RAM:** ClickHouse quiere al menos ~1-2 GB libres cómodos; con 4 GB libres
  en el servidor (además de lo que ya usan Postgres/Redis/MinIO/Ollama) vas
  sobrado para un volumen de tráfico de una PoC/early-stage.
- **Disco:** las trazas crecen con el uso. Para una PoC (unos pocos miles de
  llamadas/día) cuenta con cientos de MB/mes; vigílalo con `docker system df`
  y define una política de retención en Langfuse si crece mucho (Settings →
  Data Retention, disponible en versiones recientes).
- **Docker + Docker Compose plugin** ya instalados (los mismos que usas para
  el resto de `infra/docker-compose.full.yml`). Los servicios de este documento
  están en `infra/docker-compose.observability.yml`, que se levanta junto al
  principal.

---

## 2. Puesta en marcha

Desde la raíz del repo, en el servidor:

### 2.1 Genera los secretos (una vez)

```bash
openssl rand -hex 32   # → CLICKHOUSE_PASSWORD
openssl rand -hex 32   # → LANGFUSE_SALT
openssl rand -hex 32   # → LANGFUSE_ENCRYPTION_KEY
openssl rand -hex 32   # → LANGFUSE_NEXTAUTH_SECRET
```

Pega los 4 valores en tu `.env` (raíz del repo, junto al resto de variables
de la app — ver la sección "Langfuse" en [.env.example](../.env.example)).
**Sin estos 4 valores el `docker compose` se niega a arrancar a propósito**
(mejor fallar al desplegar que arrancar con secretos por defecto en un
servidor real).

### 2.2 Levanta los servicios

```bash
docker compose -f infra/docker-compose.full.yml \
               -f infra/docker-compose.observability.yml \
               --profile core --profile observability up -d
```

(`core` porque Langfuse reutiliza Postgres/Redis/MinIO de ese perfil; si ya
lo tenías levantado, este comando no reinicia lo que ya corre.)

Los dos ficheros van juntos porque estos servicios viven en
`docker-compose.observability.yml`, aparte del principal. No es capricho:
Compose interpola TODAS las variables del fichero al cargarlo, sin mirar qué
perfil has pedido, así que mientras Langfuse estuvo dentro del fichero grande
sus secretos obligatorios hacían fallar `--profile core` — el arranque de los
cimientos — antes de levantar nada.

### 2.3 Crea la base de datos dedicada (solo la primera vez)

Langfuse necesita su propia base de datos dentro del Postgres compartido
(igual que ya hacen Twenty/n8n/BTCPay con las suyas):

```bash
docker exec -it operant-postgres-1 psql -U operant -c 'CREATE DATABASE langfuse;'
```

### 2.4 Crea el proyecto y las claves de API

1. Abre `http://localhost:3400` **desde el propio servidor**, o por túnel SSH
   si trabajas en remoto (el puerto está atado a `127.0.0.1` a propósito —
   ver la nota de seguridad más abajo):
   ```bash
   ssh -L 3400:localhost:3400 usuario@tu-servidor
   ```
2. Crea la cuenta de admin, la organización y un proyecto (p.ej. "OPERANT").
3. Ve a **Settings → API Keys** y copia la clave pública (`pk-lf-...`) y la
   secreta (`sk-lf-...`).
4. Añádelas a tu `.env`:
   ```
   LANGFUSE_BASE_URL=http://localhost:3400
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   ```
5. Reinicia el proceso Node de OPERANT (`npm run server` o el servicio
   systemd que uses). Verás en el log:
   ```
   [langfuse] exportando trazas a http://localhost:3400 cada 10s
   ```

### 2.5 Verifica

Como admin, `GET /observability/langfuse` (con tu `INTERNAL_API_KEY`) devuelve
el estado del exportador (activo, cola pendiente, último error):

```bash
curl -H "x-api-key: $INTERNAL_API_KEY" http://localhost:4000/observability/langfuse
```

Y en la UI de Langfuse (`Traces`), cada llamada de un agente debería aparecer
en segundos.

---

## 3. Notas de seguridad (importantes en un servidor real, no localhost)

- **ClickHouse, el `langfuse-worker` y el propio `langfuse-web` están atados a
  `127.0.0.1`** en el `docker-compose.full.yml` — no son accesibles desde
  fuera del servidor por diseño. Si necesitas ver el panel desde tu portátil,
  usa el túnel SSH del paso 2.4, no abras el puerto en el firewall.
- **Los datos que verás en Langfuse son sensibles de negocio**: prompts y
  respuestas de agentes de ventas/finanzas/RRHH pueden contener datos de
  clientes, cifras económicas o CVs. Trátalo con el mismo cuidado que el
  Postgres de producción.
- Postgres/Redis/MinIO en `docker-compose.full.yml` **ya vienen expuestos en
  todas las interfaces** (`ports: ["5432:5432"]` sin `127.0.0.1:`), heredado
  del resto del stack. En un servidor con IP pública, ciérralos con `ufw`
  (`ufw deny 5432,6379,9000,9001/tcp` desde fuera de la LAN/VPN) o muévelos
  también a loopback si el propio Node y Docker viven en la misma máquina.
- `TELEMETRY_ENABLED: "false"` ya está puesto en el `langfuse-worker`: el
  propio Langfuse no reporta telemetría de uso a su fabricante (coherente con
  el principio de stack soberano de `docs/STACK-SOBERANO.md`).

---

## 4. Limitación conocida (para la siguiente iteración)

Hoy cada llamada al modelo se manda como **una traza con una única
generación** — `BaseAgent.think()`/`thinkAndAct()` no propagan todavía un
`taskId` compartido hasta `ModelGateway`, así que varias llamadas de una
misma tarea de agente no aparecen agrupadas bajo una traza común en Langfuse.
Sigue siendo útil (cada llamada se ve entera: prompt, respuesta, tokens,
tenant, agente), pero para ver una tarea completa de principio a fin habrá
que enhebrar un `taskId`/`sessionId` a través de `BaseAgent` → `meta` →
`ModelGateway.onUsage` en una iteración futura.

## 5. Fuente de verdad del código

- `src/platform/LangfuseExporter.js` — el exportador (fetch crudo, sin SDK).
- `src/cognition/ModelGateway.js` — `_emitUsage` incluye ahora `system`,
  `input` (mensajes) y `output` (texto de respuesta) además de tokens/tier,
  para que Langfuse pueda mostrar la traza completa.
- `src/server.js` — instancia `langfuse`, lo engancha en `onUsage` junto a
  `costTracker`/`telemetry`, lo arranca en el bootstrap y expone
  `GET /observability/langfuse`.
- `test/langfuse-exporter.test.js` — cobertura del exportador en aislado.
