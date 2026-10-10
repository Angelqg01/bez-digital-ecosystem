# 🚀 Guía Rápida: Sistema de Tesorería BeZhas

## Inicio Rápido (5 minutos)

### 1️⃣ Acceder al Panel de Tesorería

```bash
1. Login en BeZhas como administrador
2. Ir a: AdminDashboard → Tab "Tesorería"
3. Verás 4 secciones: Resumen, Configuración, Retiros, Auditoría
```

### 2️⃣ Configuración Básica (Primera Vez)

**a) Configurar Wallet Blockchain:**
```
1. Click en tab "Configuración"
2. Click en botón "Editar"
3. Pegar tu dirección Ethereum: 0x...
4. Click "Guardar"
```

**b) Configurar Cuenta Bancaria:**
```
1. Click en "Mostrar" en sección Bank Account
2. Completar:
   - Nombre: BeZhas Treasury
   - Número: Tu número de cuenta
   - Banco: Tu banco
   - País: Tu país
3. Click "Guardar"
```

**c) Configurar Seguridad:**
```
1. Límite Diario: 10 ETH (recomendado)
2. Firmas Requeridas: 2 (mínimo)
3. Activar: "Requerir múltiples firmas"
4. Click "Guardar"
```

✅ **¡Listo! Tu tesorería está configurada.**

---

## 💰 Crear un Retiro (3 pasos)

### Retiro a Wallet (Crypto)

```
1. Tab "Resumen" → Click "Retirar a Wallet"

2. Completar modal:
   Cantidad: 2.5
   Moneda: ETH
   Destino: Wallet (Blockchain)
   Dirección: 0xabc...def
   Razón: "Pago a proveedor cloud"

3. Click "Crear Solicitud"
```

**Resultado:** Solicitud creada con estado "pending" (requiere firmas)

### Retiro a Banco (Fiat)

```
1. Tab "Resumen" → Click "Retirar a Banco"

2. Completar modal:
   Cantidad: 5000
   Moneda: USD
   Destino: Cuenta Bancaria
   Razón: "Pago de nómina"

3. Click "Crear Solicitud"
```

**Resultado:** Sistema convierte ETH → USD automáticamente

---

## ✍️ Firmar Retiros (Multi-Firma)

### Si eres firmante autorizado:

```
1. Tab "Retiros"
2. Ver solicitud con badge "pending"
3. Click en botón "Firmar" (aparece si estás autorizado)
4. Confirmar en MetaMask
5. Esperar confirmación blockchain (30 seg)
```

**Progreso:**
- 1/2 firmas → Falta 1 firma más
- 2/2 firmas → ✅ Aprobado, listo para ejecutar

---

## ⚡ Ejecutar Retiro Aprobado

```
1. Tab "Retiros"
2. Buscar retiro con badge "approved"
3. Click "Ejecutar Retiro"
4. Confirmar en MetaMask
5. Esperar confirmación (30 seg)
```

**Resultado:**
- Estado cambia a "completed"
- Fondos transferidos
- Link a Etherscan disponible

---

## 📊 Monitorear Fondos

### Vista Rápida (Tab Resumen)

**4 Tarjetas Principales:**
```
┌─────────────────┐ ┌─────────────────┐
│ Balance Total   │ │ Total Recibido  │
│ 25.5 ETH        │ │ 100.2 ETH       │
│ $51,000 USD     │ │ Histórico       │
└─────────────────┘ └─────────────────┘

┌─────────────────┐ ┌─────────────────┐
│ Total Retirado  │ │ Comisiones      │
│ 74.7 ETH        │ │ 2.1 ETH         │
│ Para operaciones│ │ $4,200 USD      │
└─────────────────┘ └─────────────────┘
```

**Gráfico de Distribución:**
- Desarrollo: 30%
- Liquidez: 25%
- Marketing: 20%
- Recompensas: 15%
- Reserva: 10%

---

## 🔒 Seguridad Multi-Firma

### Configuración Recomendada

| Firmantes | Min Firmas | Seguridad |
|-----------|------------|-----------|
| 2 admins  | 2/2        | ⭐⭐      |
| 3 admins  | 2/3        | ⭐⭐⭐    |
| 5 admins  | 3/5        | ⭐⭐⭐⭐  |

### Ejemplo: 3 Administradores

```javascript
Admin Principal:   0x742d35Cc...  ✅ Puede firmar
CTO:               0x123456...    ✅ Puede firmar
CFO:               0xabcdef...    ✅ Puede firmar

Configuración: 2 de 3 firmas requeridas
```

**Proceso:**
```
Admin Principal crea retiro
    ↓
CTO firma (1/2)
    ↓
CFO firma (2/2) → APROBADO
    ↓
Cualquiera ejecuta
```

---

## 🔍 Auditoría

### Ver Registro de Acciones

```
1. Tab "Auditoría"
2. Ver lista de todas las acciones
3. Filtrar por fecha/tipo si necesario
```

**Acciones Registradas:**
- ✅ CONFIG_UPDATED
- ✅ WITHDRAWAL_CREATED
- ✅ WITHDRAWAL_SIGNED
- ✅ WITHDRAWAL_EXECUTED
- ✅ BANK_ACCOUNT_UPDATED
- ✅ LIMITS_CHANGED

**Ejemplo de Registro:**
```
[2024-01-15 14:30:00] CONFIG_UPDATED
Por: 0x742d35Cc...
Detalles: Cambió límite diario de 5 ETH a 10 ETH
```

### Exportar Datos

```
1. Click en "Download CSV"
2. Abrir en Excel/Google Sheets
3. Usar para contabilidad/impuestos
```

---

## 🌐 Verificación Blockchain

### Ver en Etherscan

**Desde cualquier retiro completado:**
```
1. Click en ícono "External Link"
2. Se abre Etherscan en nueva pestaña
3. Ver detalles completos de transacción:
   - Hash
   - Block
   - From/To
   - Gas usado
   - Timestamp
```

**URL de Treasury Wallet:**
```
https://etherscan.io/address/{TU_WALLET_ADDRESS}
```

**Qué puedes ver:**
- Balance actual
- Todas las transacciones (histórico completo)
- Tokens en la wallet
- Internal transactions

---

## ⚠️ Límites y Validaciones

### Límites Automáticos

| Tipo | Límite | Periodo |
|------|--------|---------|
| ETH  | 10     | Diario  |
| ETH  | 50     | Mensual |
| USD  | 20,000 | Diario  |

**Ejemplo:**
```
❌ Retiro de 15 ETH → RECHAZADO (excede límite diario)
✅ Retiro de 8 ETH  → PERMITIDO
✅ Esperar 24h
✅ Retiro de 7 ETH  → PERMITIDO
```

### Validaciones Automáticas

**Al crear retiro:**
- ✅ Balance suficiente
- ✅ Dirección válida (formato Ethereum)
- ✅ Cantidad > 0
- ✅ Razón no vacía
- ✅ No excede límite diario
- ✅ Multi-sig configurado correctamente

---

## 🔧 Troubleshooting Común

### Problema 1: "No tengo botón de Firmar"

**Causa:** No estás en la lista de firmantes autorizados

**Solución:**
```
1. Pedir a otro admin que te agregue
2. Tab Configuración → Edit
3. Agregar tu dirección en "Authorized Signers"
4. Guardar
```

### Problema 2: "Insufficient balance"

**Causa:** No hay suficiente ETH en treasury

**Solución:**
```
1. Verificar balance en tab Resumen
2. Esperar más ventas de tokens
3. O transferir ETH manualmente
```

### Problema 3: "Transaction failed"

**Causa:** Gas fee muy bajo o problema de red

**Solución:**
```
1. Aumentar gas price en MetaMask
2. Reintentar transacción
3. Verificar red Ethereum no esté congestionada
```

### Problema 4: "Daily limit exceeded"

**Causa:** Ya se alcanzó el límite del día

**Solución:**
```
Opción A: Esperar 24 horas
Opción B: Dividir retiro en 2 días
Opción C: Aumentar límite (requiere multi-sig)
```

---

## 📱 Flujos de Trabajo

### Flujo 1: Pago Semanal a Proveedor

```
LUNES:
1. Admin A crea retiro de 3 ETH
2. Razón: "Pago semanal servidor AWS"

MARTES:
3. Admin B firma retiro
4. Admin C firma retiro → APROBADO
5. Admin A ejecuta retiro
6. Fondos recibidos por proveedor (30 min)
7. Confirmar con proveedor vía email
```

### Flujo 2: Conversión Mensual a Fiat

```
DÍA 1 DEL MES:
1. CFO crea retiro de 20 ETH
2. Destino: Banco
3. Razón: "Pago nómina + gastos operativos"

DÍA 2:
4. CEO firma retiro
5. CTO firma retiro → APROBADO
6. CFO ejecuta retiro
7. Sistema inicia conversión ETH → USD

DÍA 3-5:
8. Exchange vende ETH
9. USD depositados en banco
10. Verificar depósito bancario
11. Pagar nómina
```

### Flujo 3: Emergencia (Retiro Urgente)

```
SI NECESITAS RETIRO URGENTE:

1. Coordinar con equipo vía Telegram/Discord
2. Admin A crea retiro
3. Admins B y C firman INMEDIATAMENTE
4. Admin A ejecuta en cuanto se aprueba
5. Total: 5-10 minutos si todos están online
```

---

## 🎯 Mejores Prácticas

### ✅ Seguridad

- [ ] Usar wallet multi-sig (Gnosis Safe)
- [ ] Activar 2FA en todas las cuentas admin
- [ ] Nunca compartir claves privadas
- [ ] Revisar audit log semanalmente
- [ ] Backup de seed phrases en lugar seguro
- [ ] Usar límites conservadores (10 ETH/día)

### ✅ Operaciones

- [ ] Documentar SIEMPRE la razón del retiro
- [ ] Verificar dirección 3 veces antes de enviar
- [ ] Coordinar con equipo para retiros >5 ETH
- [ ] Monitorear gas fees (usar gas tracker)
- [ ] Confirmar en Etherscan después de cada tx

### ✅ Contabilidad

- [ ] Exportar audit log mensualmente
- [ ] Mantener registro de conversiones fiat
- [ ] Documentar cada pago con factura
- [ ] Declarar impuestos correctamente
- [ ] Auditoría externa anual

---

## 📞 Soporte Rápido

### Contactos de Emergencia

```
🔴 URGENTE (fondos en riesgo):
   - Telegram: @bezhas_security
   - Discord: #emergency-treasury

🟡 SOPORTE NORMAL:
   - Email: treasury@bezhas.com
   - Discord: #admin-support

🟢 CONSULTAS GENERALES:
   - Docs: docs.bezhas.com/treasury
   - FAQ: bezhas.com/faq
```

### Horario de Soporte

- **24/7:** Emergencias de seguridad
- **Lun-Vie 9am-6pm:** Soporte general
- **Fines de semana:** Solo urgencias

---

## 📚 Recursos Adicionales

### Documentación Completa

- [Sistema de Tesorería - Guía Completa](./TREASURY_SYSTEM.md)
- [Smart Contracts - Documentación Técnica](./SMART_CONTRACTS.md)
- [AdminDashboard - Guía de Usuario](./ADMIN_DASHBOARD.md)
- [Seguridad - Mejores Prácticas](./SECURITY.md)

### Tutoriales en Video

- [Configuración Inicial](https://youtube.com/bezhas/treasury-setup)
- [Crear Retiros Multi-Firma](https://youtube.com/bezhas/multisig)
- [Conversión a Fiat](https://youtube.com/bezhas/fiat-conversion)

### Herramientas Útiles

- [Etherscan](https://etherscan.io) - Explorador blockchain
- [Gas Tracker](https://etherscan.io/gastracker) - Monitorear fees
- [Gnosis Safe](https://gnosis-safe.io) - Wallet multi-sig
- [MetaMask](https://metamask.io) - Wallet browser

---

## ✅ Checklist de Configuración

### Primera Vez (30 minutos)

- [ ] Login como admin
- [ ] Ir a AdminDashboard → Tesorería
- [ ] Configurar wallet address
- [ ] Configurar cuenta bancaria
- [ ] Configurar límites de seguridad
- [ ] Activar multi-firma
- [ ] Agregar firmantes autorizados
- [ ] Guardar todo
- [ ] Hacer retiro de prueba (0.01 ETH)
- [ ] Verificar en Etherscan
- [ ] Exportar audit log
- [ ] Compartir acceso con equipo

**¡Felicidades! Tu sistema de tesorería está listo para producción.**

---

## 🚨 En Caso de Emergencia

### Fondos Atascados

```
1. NO PÁNICO
2. Verificar estado en Etherscan
3. Si tx está pending: Aumentar gas y reemplazar
4. Si tx falló: Ver error en Etherscan
5. Contactar soporte: @bezhas_security
```

### Wallet Comprometida

```
1. ACTUAR INMEDIATAMENTE
2. Transferir todos los fondos a wallet segura
3. Cambiar todos los passwords
4. Revocar permisos en Etherscan
5. Crear wallet nueva
6. Actualizar configuración en AdminDashboard
7. Notificar a equipo y usuarios
```

### Firma Incorrecta

```
1. NO ejecutar el retiro
2. Rechazar la solicitud
3. Crear nueva solicitud correcta
4. Proceso de firmas desde cero
```

---

**Versión:** 1.0.0  
**Última actualización:** 2024-01-15  
**Mantenedor:** Equipo BeZhas  

**¿Necesitas ayuda? → treasury@bezhas.com**
