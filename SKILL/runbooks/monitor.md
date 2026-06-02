# Runbook: System Monitoring
> Procedimientos para monitorear el ecosistema BeZhas

## Health Checks

### API (cada 30s)
```bash
curl http://localhost:3001/api/health
# Esperado: {"status":"OK","services":{"database":"up"}}
```

### Blockchain (cada 10s)
```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Aegis AI (cada 60s)
```bash
curl http://localhost:8001/health
```

## Métricas Críticas

| Métrica | Umbral Normal | Alerta |
|---|---|---|
| Block time | < 5s | > 15s |
| Gas price | < 10 gwei | > 100 gwei |
| API latency p99 | < 500ms | > 2000ms |
| DB connections | < 80% pool | > 90% |
| Redis memory | < 80% max | > 90% |
| Contract paused | false | true |

## Security Monitoring

### On-chain (SecurityModule)
```javascript
// Verificar pausa global
const sec = await getContract('SecurityModule');
const isPaused = await sec.globalPause();
// Verificar circuit breakers
const cb = await sec.circuitBreakers(contractAddr);
// Audit log reciente
const logs = await sec.getRecentAudits(10);
```

### API Audit Log
```sql
SELECT * FROM ai_logs 
WHERE severity = 'WARNING' OR severity = 'ERROR'
ORDER BY created_at DESC LIMIT 50;
```

## Alertas Automáticas
1. **Global Pause** → Notificar admin team inmediatamente
2. **Circuit Breaker Trip** → Investigar volumen anómalo
3. **Large Withdrawal** → Verificar timelock
4. **New Guardian** → Confirmar identidad
5. **Recovery Initiated** → Notificar owner y equipo

## Dashboard Endpoints
- `/api/wallet/security/status` — Estado global de seguridad
- `/api/wallet/security/audit-log` — Audit log reciente
- `/api/analytics` — Métricas generales
- `/api/gas` — Estado del gas
