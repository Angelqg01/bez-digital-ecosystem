# SubApps Manual de Uso

Guía completa de cada aplicación en el ecosistema BeZhas.

---

## 1. BeZhas Hub — Panel central

**URL**: https://hub.bez.digital
**Para**: Gestión de cuenta, dashboard, documentos

### Inicio de sesión

1. Click "Conectar Wallet"
2. Selecciona MetaMask (u otra)
3. Firma mensaje (SIWE)
4. ¡Listo! Acceso total

### Dashboard principal

- **Ingresos**: BEZ liquidados hoy/semana/mes
- **Transacciones**: Historial completo
- **Staking**: Rewards generados
- **Socios conectados**: Red de empresas

### Gestión de API Keys

**Panel → Desarrollador → API Keys**
- Crear nueva clave
- Copiar (solo aparece una vez)
- Revocar antiguas

---

## 2. BZ CargoLink — Gestión de logística

**URL**: https://cargolink.bez.digital
**Para**: Tracking de envíos, proveedores, documentos aduanales

### Registro de envío

1. **Nuevo envío** → Ingresa:
   - Remitente (empresa)
   - Destinatario
   - Productos (descripción + valor)
   - Dirección de entrega

2. Automáticamente genera:
   - Documento aduanal (blockchain)
   - QR rastreable
   - Factura

3. **Compartir con socio**:
   - Click "Compartir"
   - Se genera link único
   - Socio ve estado en tiempo real

### Rastreo en vivo

- Mapa con ubicación GPS
- Firma del mensajero
- Fecha/hora de cada evento
- Prueba de entrega (blockchain)

### Liquidación de envíos

- Automática al confirmar entrega
- Pago al proveedor en BEZ
- Visibilidad en BeZhas Hub

---

## 3. BeZhas Wallet — Gestión de fondos

**URL**: https://wallet.bez.digital
**Para**: Comprar, enviar, recibir BEZ

### Crear wallet

1. Click "Crear nueva wallet"
2. **GUARDA TU FRASE SEED** (12 palabras)
3. Confirma palabras en orden
4. ¡Tu wallet está lista!

### Comprar BEZ

**Opción 1: Fiat on-ramp**
1. Click "Comprar"
2. Selecciona cantidad en EUR
3. Paga con Stripe/tarjeta
4. Recibe BEZ en 5 min

**Opción 2: DEX (swap)**
1. "Cambiar" → selecciona token (USDC, DAI, etc.)
2. Ingresa cantidad
3. Confirma precio
4. Transacción en cadena (~2 min)

### Enviar BEZ

1. Click "Enviar"
2. Pega dirección destino (o dirección guardada)
3. Ingresa cantidad
4. Revisa gas fee
5. Confirma

**Guardar direcciones**:
- "Mis direcciones" → Agregar
- Apodo (ej: "Proveedor X")
- Reutilizar con 1 click

### Staking (generar rendimiento)

1. "Staking" → "Habilitar"
2. Bloquea cantidad por período (30/90/180 días)
3. Recibe:
   - APY variable (4-8%)
   - Rewards cada epoch
   - Acceso a liquid staking (desbloquear antes)

---

## 4. Capital (DeFi) — Tesorería inteligente

**URL**: https://capital.bez.digital
**Para**: Farming, LP, ahorros automáticos

### Farming (generar yield)

1. "Farmers" → Elige pool (BEZ/USDC, BEZ/DAI, etc.)
2. Ingresa cantidad BEZ
3. Click "Depositar"
4. Recibe LP tokens automáticamente
5. Gana fees + rewards (APY visible)

### Liquid Staking (bBEZ)

1. Stake BEZ → recibe bBEZ
2. bBEZ genera rendimiento automáticamente
3. Vende bBEZ en cualquier momento
4. Precio de bBEZ = BEZ + rewards acumulados

### Ahorros automáticos

1. "Ahorros" → Configura:
   - Cantidad mensual
   - Porcentaje para staking vs. farming
2. Cada mes: débito automático
3. Reinversión automática de rewards

---

## 5. Energy (VPP) — Gestión de energía

**URL**: https://energy.bez.digital
**Para**: Agregadores VPP, plantas solares, prosumers

### Registrar activo de energía

1. "Mis plantas" → "Agregar"
2. Tipo: Solar, Eólica, Hidro, Micro-grid
3. Capacidad (kW)
4. Ubicación GPS
5. Banco de datos de OMIE (automático)

### Generar ingresos por energía

1. Conecta tu SCADA (industrial) o inversor solar
2. BeZhas lee generación en tiempo real
3. Vende en:
   - Mercado spot (OMIE)
   - Contratos bilaterales (entre socios)
   - VPP intraday (agregación)

4. Liquidación automática en BEZ cada 6 horas

### Dashboard de Operación

- Energía generada hoy/semana
- Ingresos acumulados
- Precios spot en vivo
- Predicción solar (IA)

---

## 6. Prestige (Membership) — Club B2B

**URL**: https://prestige.bez.digital
**Para**: Networking, descuentos, eventos

### Afiliarse

1. Nivel **Silver**: Gratis
2. Nivel **Gold**: 99 EUR/mes
3. Nivel **Platinum**: 999 EUR/mes

### Beneficios por nivel

| | Silver | Gold | Platinum |
|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ |
| Red de socios | ✓ | ✓ | ✓ |
| Descuentos | 5% | 10% | 20% |
| Eventos | Ver | Registrarse | VIP access |
| Soporte | Por email | Prioritario | Teléfono 24/7 |

### Directorio de socios

- Busca empresas por industria
- Mira reseñas on-chain (verificadas)
- Solicita conexión
- Negocia directamente

---

## 7. PureScan (Auditoría) — Transparency

**URL**: https://purescan.bez.digital
**Para**: Verificar empresas, auditorías, compliance

### Buscar empresa

1. Ingresa nombre o dirección
2. Resultados muestran:
   - Transacciones verificadas
   - Contratos firmados (blockchain)
   - Reseñas de socios
   - Calificación de riesgo

### Generar reporte

1. Click "Solicitar auditoría"
2. Selecciona período
3. Autoriza acceso a datos (sólo lectura)
4. Recibe reporte en PDF (en 2 horas)

Incluye:
- Volumen de transacciones
- Patrones de comportamiento
- Banderas de riesgo (si hay)
- Certificaciones (ISO, SOC2, etc.)

---

## 8. Genesis (Enterprise) — Gestión integral

**URL**: https://genesis.bez.digital
**Para**: CFO, CEO, Equipos de 50+ personas

### Integraciones

- Conectar ERP (SAP, Oracle, Odoo)
- Sincronizar órdenes automáticamente
- Consolidar datos de múltiples plantas

### Reportes ejecutivos

- Revenue por cliente/producto
- Márgenes (con ahorros BeZhas)
- Cash-flow (predicción)
- KPIs blockchain (liquidez, staking)

### Teams & Permisos

- Crear equipos (Finanzas, Logística, etc.)
- Permisos granulares (leer, aprobar, ejecutar)
- Auditoría de acciones (quién hizo qué, cuándo)

---

## Soporte

- **Email**: support@bez.digital
- **Chat en vivo**: En cada SubApp (esquina inferior derecha)
- **Discord**: https://discord.gg/bezhas
- **Documentación**: https://bez.digital/docs

## Troubleshooting

### "Wallet no conecta"
→ Actualiza MetaMask
→ Verifica que estés en la red Polygon
→ Limpia caché del navegador

### "Transacción pending"
→ Espera 2-5 minutos (confirmaciones de bloque)
→ Si tarda >10 min, ve a explorer y busca tu txHash

### "Perdí mi seed phrase"
→ Lamentablemente no se puede recuperar
→ Crea nueva wallet
→ Traslada fondos (si tienes acceso)

---

**Última actualización**: 2026-06-19
