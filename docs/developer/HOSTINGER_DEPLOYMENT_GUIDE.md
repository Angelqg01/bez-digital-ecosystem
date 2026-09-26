# Guía de Despliegue en Hostinger VPS para BeZhas Blockchain

> [!NOTE]
> **Plan B, no destino activo (desde 2026-09-26).** Este documento sustituyó
> a `GCP_DEPLOYMENT_GUIDE.md` en 2026-09 mientras GCP estaba descartado por
> coste (Cloud SQL suspendido por impago). Esa facturación está resuelta y la
> guía vigente vuelve a ser
> [`GCP_DEPLOYMENT_GUIDE.md`](GCP_DEPLOYMENT_GUIDE.md). Este VPS se mantiene
> documentado y aprovisionado como alternativa de bajo coste, no como el
> entorno de producción por defecto — no se ha desmontado.

Sustituyó a `GCP_DEPLOYMENT_GUIDE.md` como destino de producción durante 2026-09:
GCP quedó descartado por coste (Cloud SQL llegó a suspenderse por facturación).
La plataforma ya estaba escrita como un stack Docker Compose autosuficiente
(`docker-compose.yml` + `docker-compose.prod.yml`) — no como un "lift-and-shift"
a una VM grande, sino porque nunca llegó a completarse la migración a
servicios gestionados de GCP descrita en la guía anterior. Eso hace que encaje
bien en un único VPS: no hay Cloud SQL/Memorystore/Cloud Run que reemplazar,
solo hay que ponerlo a correr en la máquina correcta.

---

## 1. Plan contratado

| Recurso | KVM 4 |
|---|---|
| vCPU | 4 |
| RAM | 16 GB |
| Disco | 200 GB NVMe |
| Datacenter | Frankfurt (DE) |
| Plantilla | Ubuntu 24.04 LTS con Docker preinstalado |
| Acceso | Solo clave SSH (`bezhas-vps-deploy`, ya registrada en la cuenta de Hostinger) |
| Backups | Snapshot semanal (activado en el aprovisionamiento) |

## 2. Qué vive en este VPS (alcance de esta migración)

| Servicio | Contenedor | Notas |
|---|---|---|
| API + indexador | `bezhas-api` | Puerto 3001, tras nginx en `/api/` |
| Base de datos plataforma | `postgres` | Postgres 16 en Docker, reemplaza a Cloud SQL |
| Redis | `redis` | Caché + rate limiting |
| Frontend | `control-center` | Next.js, puerto 3000, tras nginx en `/` |
| OPERANT (business-ops) | `business-ops` + `operant-postgres` | Base separada a propósito (RLS) — ver CLAUDE.md |
| MCPs internos | `obsidian-mcp`, `bezhas-core-mcp` | |
| Borde | `nginx` | TLS + WAF + rate limiting, `nginx/nginx.conf` |
| Monitoring | `prometheus`, `grafana` | Perfil `monitoring`, opcional |

### Qué se queda FUERA de este VPS (y por qué)

- **OpenClaw** (`openclaw/`): su Dockerfile arranca `uvicorn api_server:app`,
  pero ese fichero no existe en el repo — nunca ha sido un contenedor
  arrancable, ni en Windows+GPU ni en ningún otro sitio. Es un bug
  preexistente, no algo que cambie con el hosting. Hasta que exista ese
  entrypoint HTTP, sus módulos (`openclaw_engine.py`, `orchestrator.py`,
  `router.py`) siguen siendo scripts invocables a mano, no un servicio.
  Aparte, su Dockerfile parte de `nvidia/cuda:...-devel` y su
  `requirements.txt` incluye `torch`, `bitsandbytes`, `llama-cpp-python`
  — dependencias de inferencia local que este VPS (sin GPU) no necesita: la
  cadena de fallback de CLAUDE.md ya resuelve todo vía API (Claude → Gemini →
  GPT-4o → DeepSeek) sin tocar el paso de LLaMA local.
- **sync-daemon.js**: es una herramienta de desarrollo (sincroniza ABIs entre
  `smart-contracts/` y el frontend tras `forge build`), se ejecuta a mano o en
  CI donde se compilan los contratos — no es un servicio de producción que
  deba correr 24/7 en el VPS que sirve tráfico.
- **aegis, ai-gateway, defi-frontend, bezhas-geth**: nginx ya los espera
  (`nginx.conf` los referencia por nombre de servicio con resolución diferida,
  así que su ausencia no rompe el resto), pero no se pidieron para esta
  migración y no tienen Dockerfile/servicio base en varios casos. Quedan como
  trabajo aparte si se necesitan.

## 3. Antes de desplegar: aprovisionar la VM

Esto lo hago yo vía la integración MCP de Hostinger en cuanto exista la VM en
la cuenta (la compra se hizo desde el carrito web, no por API — el endpoint
`VPS_purchaseNewVirtualMachineV1` devolvía 422 sin más detalle con varias
combinaciones probadas, y crear el firewall antes de tener VM daba 403):

```
VPS_setupPurchasedVirtualMachineV1(
  virtualMachineId=<id>,
  template_id=1121,        # Ubuntu 24.04 with Docker
  data_center_id=19,       # Frankfurt
  public_key={id: 572929}, # bezhas-vps-deploy, ya registrada
  enable_backups=true
)
VPS_createNewFirewallV1(name="bezhas-vps-prod")
VPS_createFirewallRuleV1(firewallId=<id>, protocol="SSH",   port="22",  source="any", source_detail="any")
VPS_createFirewallRuleV1(firewallId=<id>, protocol="HTTP",  port="80",  source="any", source_detail="any")
VPS_createFirewallRuleV1(firewallId=<id>, protocol="HTTPS", port="443", source="any", source_detail="any")
VPS_activateFirewallV1(...)
```

> Tras esto, restringe el puerto 22 a tu IP fija con
> `VPS_updateFirewallRuleV1` en cuanto la tengas — de fábrica queda abierto a
> `any` porque no había una IP conocida en el momento de crear la regla.

DNS: apunta los subdominios que sirvan desde este VPS (`api.bez.digital`,
`app.bez.digital`, el apex si aplica) a la IP de la VM con
`DNS_updateDNSRecordsV1` sobre la zona `bez.digital`. El resto de subdominios
de `secondaryApps` (`wallet`, `gas`, `edge`, ... — ver el TODO de
`app/(landing)/page.tsx`) siguen sin resolver hasta que cada SubApp tenga su
propio despliegue; no son parte de este VPS.

## 4. Desplegar

```bash
ssh -i bez_vps_deploy_key root@<IP_VM>
git clone <repo> && cd BeZhas-Blockchain
cp .env.example .env   # completar secretos — nunca commitear
bash scripts/deploy-prod.sh
```

`scripts/deploy-prod.sh` ya hace todo lo necesario para este alcance sin
cambios: valida `.env`, genera certs de staging si faltan, construye con
`docker-compose.yml -f docker-compose.prod.yml` (que ahora incluye
`control-center`), migra ambas bases (`postgres` y `operant-postgres`) y
levanta el stack de monitoring aparte.

Para TLS real, sustituir `nginx/ssl/{fullchain,privkey}.pem` por certificados
de Let's Encrypt (ej. `certbot certonly --standalone` en la VM, con el 80/443
liberados temporalmente) antes de exponer el dominio real.

## 5. Presupuesto de recursos (KVM 4 — 4 vCPU / 16 GB)

Suma de límites ya declarados en `docker-compose.prod.yml`:

| Servicio | CPU | RAM |
|---|---|---|
| nginx | 0.5 | 256M |
| postgres | 1 | 1G |
| redis | 0.5 | 512M |
| bezhas-api | 1 | 512M |
| control-center | 0.5 | 512M |
| operant-postgres | 1 | 1G |
| business-ops | 1.5 | 1G |
| obsidian-mcp / bezhas-core-mcp | (sin límite propio) | ~0.5G combinado |
| **Total aprox.** | **~6 vCPU (con burst), ~5 GB** | |

Con 4 vCPU reales y 16 GB, hay margen holgado en RAM y el CPU funciona con
sobre-suscripción normal en cargas que no son simultáneamente pico (postgres y
business-ops no saturan a la vez salvo picos de agentes). Prometheus/Grafana
(perfil `monitoring`) añaden otro ~0.5 vCPU / 1 GB si se activan.

## 6. Backups

- Hostinger: snapshot semanal a nivel de VM (activado en el aprovisionamiento).
- Aparte, sigue haciendo falta un `pg_dump` programado de `postgres` y
  `operant-postgres` fuera de la VM (el snapshot de Hostinger cubre desastre
  total de la máquina, no corrupción lógica de datos ni error humano en un
  `DELETE`). No había nada de esto en la guía de GCP tampoco — es deuda previa,
  no algo que introduzca el cambio de proveedor.
