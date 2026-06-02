# 🚀 Quick Start - Security Testing

Este script verifica que todas las correcciones de seguridad estén funcionando correctamente.

## Prerequisitos

1. Backend corriendo en `http://localhost:3001`
2. Chat server corriendo en `http://localhost:3002`
3. Node.js >= 18

## Ejecutar Tests

```bash
# Instalar dependencias si no están
npm install

# Ejecutar suite completa de tests de seguridad
npm run test:security
```

## Tests Incluidos

### 1. JWT Authentication ✅
- Rechaza conexiones sin token
- Rechaza tokens inválidos
- Acepta tokens válidos
- Verifica firma JWT correcta

### 2. Admin Bypass Protection ✅
- Bloquea acceso admin sin token
- Verifica que bypass solo funciona en development
- Bloquea bypass en production

### 3. Connection Rate Limiting ✅
- Limita conexiones por IP
- Bloquea después de límite excedido
- Limpia registros expirados

### 4. Production Configuration ✅
- Verifica JWT_SECRET único
- Verifica NODE_ENV correcto
- Verifica AUTH_BYPASS deshabilitado
- Verifica JWT_DEV_MODE deshabilitado

## Resultados Esperados

```
╔═══════════════════════════════════════════════════════════╗
║       BEZHAS WEB3 - SECURITY TESTS                        ║
╚═══════════════════════════════════════════════════════════╝

[TEST 1] JWT Authentication en Chat Socket.IO
  1.1 Testing conexión sin token...
  ✅ Conexión rechazada correctamente sin token
  1.2 Testing conexión con token inválido...
  ✅ Token inválido rechazado correctamente
  1.3 Testing conexión con token válido...
  ✅ Conexión exitosa con token válido

✅ TEST 1 PASSED: JWT Authentication funcional

[TEST 2] Admin Bypass Protection
  2.1 Testing acceso admin sin token...
  ✅ Acceso admin bloqueado sin token
  2.2 Verificando protección contra bypass...
  ✅ Configuración de bypass segura

✅ TEST 2 PASSED: Admin bypass protection funcional

[TEST 3] Connection Rate Limiting
  3.1 Testing rate limiting (intentando 15 conexiones)...
  📊 Resultados: 10 exitosas, 5 bloqueadas
  ✅ Rate limiting funcionando (5 conexiones bloqueadas)

✅ TEST 3 PASSED: Rate limiting implementado

[TEST 4] Production Configuration
  4.1 Verificando JWT_SECRET...
  ✅ JWT_SECRET configurado
  4.2 Verificando NODE_ENV...
  ✅ NODE_ENV: development
  4.3 Verificando AUTH_BYPASS_ENABLED...
  ✅ AUTH_BYPASS configurado correctamente
  4.4 Verificando JWT_DEV_MODE...
  ✅ JWT_DEV_MODE configurado correctamente

✅ TEST 4 PASSED: Production configuration OK

╔═══════════════════════════════════════════════════════════╗
║                    TEST SUMMARY                           ║
╚═══════════════════════════════════════════════════════════╝

  JWT Authentication:          ✅ PASS
  Admin Bypass Protection:     ✅ PASS
  Connection Rate Limiting:    ✅ PASS
  Production Configuration:    ✅ PASS

  Total: 4/4 tests passed

  🎉 ALL SECURITY TESTS PASSED! 🎉
```

## Troubleshooting

### Test falla: "Connection refused"
```bash
# Verificar que los servidores estén corriendo
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### Test falla: "JWT verification failed"
```bash
# Verificar JWT_SECRET en .env
echo $JWT_SECRET

# Debe ser diferente al valor por defecto
```

### Test falla: "Rate limiting not working"
```bash
# Verificar configuración en .env
echo $ENABLE_CONNECTION_RATE_LIMIT  # Debe ser 'true'
echo $CONNECTION_RATE_LIMIT         # Debe ser 10 (default)
```

## Siguientes Pasos

Una vez que todos los tests pasen:

1. ✅ Ejecutar tests en ambiente de staging
2. ✅ Configurar monitoring (Sentry/Datadog)
3. ✅ Ejecutar penetration testing
4. ✅ Deploy a producción con .env.production

## Documentación

- [SECURITY_FIXES_APPLIED.md](../SECURITY_FIXES_APPLIED.md) - Detalle de fixes
- [SISTEMA_COMPLETO_ANALISIS.md](../SISTEMA_COMPLETO_ANALISIS.md) - Análisis completo
- [.env.production.example](../.env.production.example) - Config de producción
