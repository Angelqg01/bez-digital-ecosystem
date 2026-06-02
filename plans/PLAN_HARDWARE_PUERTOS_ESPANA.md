# Requisitos de Hardware — BeZhas para Puertos de España

**Fecha:** Abril 2026  
**Proyecto:** BeZhas Blockchain — Plataforma Web3 Enterprise  
**Contexto:** OP Stack L2 (Chain ID 2708), 10+ servicios Docker, ML/IA con Aegis, 16 sectores activos

---

## Referencia Técnica de la Plataforma

| Parámetro | Valor |
|-----------|-------|
| L2 Block Time | 2 segundos (`l2BlockTime: 2`) |
| L1 (Sepolia) Chain ID | 11155111 |
| L2 Chain ID | 2708 |
| Servicios Docker base | 10 (postgres, redis, api, aegis, ai-gateway, op-geth, op-node, op-batcher, edge-node, control-center) |
| Monitorización | Prometheus + Grafana + Loki + Promtail |
| Reverse Proxy | Nginx con TLS 1.2/1.3, WAF, rate limiting |

---

## Escenario 1 — Piloto (2-3 puertos)

### Hardware: 1 Servidor Dedicado

| Componente | Requisito mínimo |
|------------|-----------------|
| CPU | 32 vCores (AMD EPYC 7302 / Intel Xeon Silver 4314) |
| RAM | 128 GB ECC DDR4 |
| Almacenamiento principal | 2× NVMe SSD 2 TB en RAID-1 (datos de cadena) |
| Almacenamiento OS/DB | 1× NVMe SSD 500 GB |
| Red | 1 Gbps simétrico garantizado |
| Sistema Operativo | Debian 12 / Ubuntu 22.04 LTS |
| Runtime | Docker Engine 26+ / Docker Compose v2 |

### Distribución de RAM estimada

| Servicio | RAM asignada |
|----------|-------------|
| `op-geth` (nodo L2) | ~32 GB |
| `aegis` (Python ML, 4 modelos) | ~16 GB |
| `postgres` (PostgreSQL 15) | ~16 GB |
| `op-node` + `op-batcher` | ~12 GB |
| `api` + `ai-gateway` + `edge-node` | ~8 GB |
| `redis` + `nginx` | ~4 GB |
| Prometheus + Grafana + Loki | ~4 GB |
| Sistema operativo + buffers/caché | ~36 GB |
| **Total** | **~128 GB** |

### Coste estimado (cloud dedicado en España)

| Proveedor | Precio aprox./mes |
|-----------|-----------------|
| OVHcloud Madrid (EG-32-NVME) | 350–500 €/mes |
| Telefónica Tech (ServerFarm Madrid) | 600–900 €/mes |
| GIGAS (Madrid/Barcelona) | 500–750 €/mes |
| Hardware propio (amortización 3 años) | ~400 €/mes equivalente |

---

## Escenario 2 — Producción Regional (5-10 puertos)

### Hardware: Clúster HA de 3 Nodos (k3s o Kubernetes)

**Cada nodo:**

| Componente | Requisito |
|------------|-----------|
| CPU | 32 vCores por nodo |
| RAM | 256 GB ECC DDR4 por nodo |
| Almacenamiento local | 4× NVMe 4 TB (ZFS entre nodos) |
| Red interna | 10 Gbps entre nodos |
| Red WAN | 1 Gbps por nodo |

**Distribución de servicios:**

| Nodo | Servicios alojados |
|------|--------------------|
| Nodo 1 (Blockchain) | `op-geth`, `op-node`, `op-batcher` (stateful) |
| Nodo 2 (Datos) | `postgres` + réplica streaming, `redis` cluster |
| Nodo 3 (App) | `api`, `aegis`, `ai-gateway`, `control-center`, `edge-node`, `nginx`, monitoring |

**Nota:** Los servicios stateless (`api`, `ai-gateway`, `control-center`) pueden balancearse
entre los 3 nodos para alta disponibilidad.

### Almacenamiento compartido
- Sistema distribuido: Ceph RBD o GlusterFS entre los 3 nodos
- Backups: snapshots diarios a storage externo / S3-compatible

---

## Escenario 3 — Nacional (Puertos del Estado — todos los puertos)

### Clúster Kubernetes Multi-Nodo (5-7 nodos + GPU)

| Tipo de nodo | Cantidad | CPU | RAM | Almacenamiento |
|---|---|---|---|---|
| Computación (app/api) | 4 | 64 vCores | 256 GB | 2× NVMe 4 TB |
| Base de datos | 1 | 32 vCores | 512 GB | 8× NVMe 4 TB RAID-10 |
| ML/Aegis + GPU | 1 | 16 vCores | 128 GB | 2× NVMe 2 TB |
| Load Balancer/Nginx | 1 | 8 vCores | 32 GB | 1× NVMe 500 GB |

**GPU para nodo ML:**
- NVIDIA A10 (24 GB VRAM) — para modelos Aegis en producción intensiva
- Alternativa más económica: NVIDIA RTX 4090 (24 GB VRAM) si es servidor propio

---

## Edge Nodes — Hardware en cada Puerto Físico

Cada instalación portuaria necesita un nodo local ejecutando `bezhas-edge-node` (puerto 4000):

| Componente | Requisito |
|------------|-----------|
| CPU | 4-8 cores (Intel i7 industrial / Xeon E-2300 series) |
| RAM | 16-32 GB ECC DDR4 |
| Almacenamiento | 500 GB NVMe + disco externo para backups |
| Red LAN | 1 Gbps (conexión a sistemas portuarios locales) |
| Red WAN | Fibra 100+ Mbps + failover 4G/5G |
| Temperatura | Rango industrial: -20°C a +60°C |
| Electricidad | SAI/UPS con autonomía mínima 2 horas |
| Certificación | IP30 mínimo (entorno industrial portuario) |

**Referencia de hardware edge recomendado:**
- Supermicro X11SPI-TF (rack 1U industrial)
- Advantech ARK-3500 (embebido industrial)
- Dell EMC VEP4600 (edge compute appliance)

---

## Proyección de Crecimiento de Datos (op-geth)

Con `l2BlockTime: 2` segundos, el volumen de datos de cadena crece de forma continua:

| Puertos activos | TPS estimadas | Crecimiento datos/mes | RAM mínima op-geth |
|---|---|---|---|
| 1-3 | 10–30 tx/s | ~30 GB/mes | 16 GB |
| 5-10 | 50–100 tx/s | ~100 GB/mes | 32 GB |
| 20-30 | 100–250 tx/s | ~200 GB/mes | 48 GB |
| 46 (todos los puertos) | 200–500 tx/s | ~300 GB/mes | 64 GB |

**Estimación a 1 año de operación nacional:** ~2–4 TB de datos de cadena.
Planificar almacenamiento con margen 3× sobre la proyección anual.

---

## Red y Conectividad

### Requisitos mínimos por entorno

| Entorno | Ancho de banda | Latencia máx. L1↔L2 | Redundancia |
|---|---|---|---|
| Piloto | 100 Mbps simétrico | < 200 ms | 4G failover |
| Regional | 1 Gbps simétrico | < 100 ms | 2 ISP activo-activo |
| Nacional | 10 Gbps (backbone) | < 50 ms | BGP multihomed |

### Puertos de red expuestos (producción)

| Puerto | Servicio | Exposición |
|--------|---------|-----------|
| 80/443 | Nginx (HTTPS) | Pública |
| 8545 | op-geth RPC | Solo VPN interna |
| 5052 | op-node | Solo VPN interna |
| Resto | Todos los servicios | Interna (no expuesta) |

---

## Certificaciones y Cumplimiento (Para Puertos del Estado)

Para operar en infraestructura de puertos españoles, el CPD debe cumplir:

| Certificación | Requerimiento |
|---|---|
| ISO 27001 | Gestión de seguridad de la información |
| ISO 22301 | Continuidad de negocio |
| ENS (Esquema Nacional de Seguridad) | Obligatorio para administración pública española |
| RGPD/LOPDGDD | Protección de datos (si procesa datos personales) |
| Tier III (ANSI/TIA-942) | Disponibilidad 99.982% para producción crítica |

**CPDs certificados en España recomendados:**
- Interxion Madrid / Barcelona
- Equinix MD2 / MD5 (Madrid)
- Telefónica Tech (Madrid, Barcelona, Valencia)
- Acens / GIGAS

---

## Resumen Económico

### Capex (hardware propio, amortización 3 años)

| Escenario | Inversión inicial | Coste mensual equiv. |
|-----------|-----------------|----------------------|
| Piloto (1 servidor) | ~20.000–30.000 € | ~600–900 €/mes |
| Regional (3 nodos) | ~80.000–120.000 € | ~2.200–3.300 €/mes |
| Nacional (6+ nodos) | ~250.000–400.000 € | ~7.000–11.000 €/mes |

### Opex (cloud dedicado en España, sin hardware propio)

| Escenario | Proveedor referencia | Coste mensual |
|-----------|---------------------|--------------|
| Piloto | OVHcloud / GIGAS | 600–1.200 €/mes |
| Regional | Equinix bare-metal | 3.000–6.000 €/mes |
| Nacional | Contrato marco CPD | 15.000–30.000 €/mes |

---

## Recomendación de Arranque

Para un **piloto con Puerto de Valencia o Algeciras** (mayor volumen logístico):

1. **Servidor dedidado**: 32 vCores / 128 GB RAM / 4 TB NVMe en CPD certificado
2. **Proveedor**: OVHcloud Madrid o Telefónica Tech (cumplimiento ENS)
3. **Edge node local**: 1 dispositivo Supermicro por instalación física
4. **Coste total piloto**: ~800–1.500 €/mes (cloud) + ~2.000–4.000 € instalación inicial

Una vez validado el piloto, escalar con clúster Kubernetes para los siguientes puertos.
