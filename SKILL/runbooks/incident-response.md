# Runbook: Incident Response
> Qué hacer cuando algo sale mal

## Niveles de Severidad

| Nivel | Descripción | Tiempo de Respuesta |
|---|---|---|
| P0 — Crítico | Fondos en riesgo, exploit activo | INMEDIATO |
| P1 — Alto | Sistema caído, funcionalidad rota | < 1 hora |
| P2 — Medio | Degradación de servicio | < 4 horas |
| P3 — Bajo | Bug cosmético, mejora | Siguiente sprint |

## P0: Exploit o Pérdida de Fondos

### Paso 1: PAUSE INMEDIATO
```javascript
// Cualquier guardian puede pausar
const sec = await getSignedContract('SecurityModule');
await sec.activateGlobalPause();
```

### Paso 2: Evaluar alcance
- ¿Qué contrato fue afectado?
- ¿Cuánto fue comprometido?
- ¿El vector de ataque sigue abierto?

### Paso 3: Comunicar
- Notificar equipo (no publicar detalles del exploit)
- Preparar statement público si es necesario

### Paso 4: Mitigar
- Pausar contratos específicos afectados
- Si es un drain: verificar circuit breakers
- Desplegar fix si es posible

### Paso 5: Post-mortem
- Documentar en `SKILL/solutions/` 
- Actualizar `SKILL/feedback/log.md`
- Implementar prevención

## P1: Sistema Caído

### API no responde
1. Verificar contenedores: `docker compose ps`
2. Reiniciar: `docker compose restart api`
3. Logs: `docker compose logs api --tail=100`
4. Si DB: `docker compose restart postgres`

### Blockchain no produce bloques
1. Verificar geth: `docker compose logs bezhas-geth --tail=50`
2. Verificar node: `docker compose logs bezhas-node --tail=50`
3. Reiniciar secuencia: `docker compose restart bezhas-geth bezhas-node bezhas-batcher`

### Redis caído
1. Reiniciar: `docker compose restart redis`
2. Cache se reconstruye automáticamente
3. Rate limits se resetean (monitorear abuso)

## Contactos de Emergencia
- Mantener lista actualizada en canal seguro
- Umbral de guardianes para pausa: {guardianThreshold}
- Admin MultiSig requerido para despausar

## Post-Incidente
1. Escribir incidente en `SKILL/feedback/log.md`
2. Si hubo solución técnica: `SKILL/solutions/runtime-errors.md`
3. Si hubo cambio de proceso: `SKILL/runbooks/` correspondiente
4. Review de seguridad si P0/P1
