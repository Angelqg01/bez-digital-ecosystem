---
type: "subapp"
layer: 2
priority: "P0"
cluster: "identidad-comunidad"
repo_path: "Hub backend (multi-tenant) — identidad única B-UID"
tags: ["platform-map", "identidad-comunidad", "p0"]
visibility: "public"
public_title: "ID: identidad única de cada empresa"
---

# BeZhas ID Nota

> Capa 2 · Prioridad **P0** · [[Cluster-identidad-comunidad]]

BeZhas_ID: identidad única por entidad (B-UID) compartida entre Hub, CargoLink, Prestige y Genesis. Claves con scope por rol; un objeto + lifecycle, los 4 actores son roles, no pipelines.

**Ubicación:** `Hub backend (multi-tenant) — identidad única B-UID`

## Para clientes

El ID es la identidad única de cada empresa o entidad en el ecosistema. La misma identidad sirve en Hub, CargoLink, Prestige y Genesis, de modo que no hay que darse de alta en cada SubApp. Las claves de acceso se emiten con permisos por rol: quien envía, quien transporta, quien recibe o quien paga actúan sobre el mismo expediente, cada uno con su permiso.

## Conexiones

- [[Bezhas-Hub]]
- [[BZ-CargoLink]]
- [[BZ-Prestige]]
- [[BZ-Genesis]]
- [[Cluster-identidad-comunidad]]
- [[BeZhas-Platform-Master]]
