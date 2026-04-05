# 🎮 Sistema Demo/Live - Automation Engine

**Fecha:** 17 de Noviembre 2025  
**Componente:** `AutomationDemo.jsx`  
**Funcionalidad:** Modo Demo con cálculos y modo Live con ejecución real

---

## 🎯 Descripción General

Sistema de doble modo que permite a los usuarios **probar y calcular** operaciones en modo **DEMO** antes de ejecutarlas en el blockchain en modo **LIVE**.

---

## 🔄 Modos de Operación

### 📊 **Modo DEMO**
- **Función:** Simula operaciones y genera cálculos
- **Características:**
  - ✅ No ejecuta transacciones reales
  - ✅ Almacena todos los cálculos
  - ✅ Genera resumen completo
  - ✅ Permite revisión antes de implementar
  - ✅ Puede resetear datos en cualquier momento

### 🔴 **Modo LIVE**
- **Función:** Ejecuta operaciones reales en blockchain
- **Características:**
  - ✅ Transacciones inmediatas
  - ✅ Requiere backend disponible
  - ✅ Actualiza métricas reales
  - ✅ Genera logs del sistema
  - ✅ Cambios permanentes en blockchain

---

## 🧮 Operaciones Calculadas (Modo DEMO)

### 1. **Actualización de Oráculo** 🔮
```javascript
{
    type: 'ORACLE_UPDATE',
    data: {
        assetPair: 'BTC/USD',
        price: 65432,
        volume: 3456789000,
        priceChange: '+8.72%',
        volumeImpact: '3.46B'
    },
    result: {
        action: 'Actualización de precio registrada',
        impact: 'Alcista',
        recommendation: 'Considerar aumento de APY'
    }
}
```

### 2. **Ajuste de APY** 📈
```javascript
{
    type: 'APY_ADJUSTMENT',
    data: {
        oldAPY: 1500,
        newAPY: 2000,
        change: '+33.33%',
        reason: 'Ajuste manual desde demo'
    },
    result: {
        action: 'APY ajustado a 20%',
        impact: 'Mayor rentabilidad',
        estimatedUsers: 832,
        estimatedRewards: '20000.00'
    }
}
```

### 3. **Ejecución de Halving** 💥
```javascript
{
    type: 'HALVING_EXECUTION',
    data: {
        currentReward: 100,
        newReward: 50,
        reduction: '50%',
        reason: 'Halving manual desde demo'
    },
    result: {
        action: 'Halving ejecutado (simulación)',
        impact: 'Reducción de inflación',
        affectedUsers: 3421,
        newEmissionRate: '50 tokens/block'
    }
}
```

### 4. **Análisis ML** 🧠
```javascript
{
    type: 'ML_ANALYSIS',
    data: {
        price: 62000,
        volume: 4200000000,
        trend: 'BULLISH',
        volatility: '7.23%'
    },
    result: {
        action: 'Análisis ML completado',
        suggestedAPY: 2500,
        confidence: '87.45%',
        recommendation: 'APY recomendado: 25%'
    }
}
```

---

## 📊 Resumen de Cálculos

### Componente Visual
El resumen aparece automáticamente cuando hay cálculos en modo DEMO:

```jsx
🧮 Resumen de Cálculos Demo (4 operaciones)

┌─────────────────────────────────────────────────┐
│ Estadísticas por Tipo                           │
├─────────────────────────────────────────────────┤
│  🔮 Actualizaciones Oráculo: 1                  │
│  📈 Ajustes APY: 2                              │
│  💥 Halvings: 0                                 │
│  🧠 Análisis ML: 1                              │
└─────────────────────────────────────────────────┘

Detalle de Operaciones:
  #1 ORACLE_UPDATE - 14:23:45
     Datos: BTC/USD, $65432, 3.45B volume
     Resultado: Actualización registrada - Alcista
     
  #2 APY_ADJUSTMENT - 14:24:12
     Datos: 15% → 20%, +33.33% change
     Resultado: Mayor rentabilidad estimada
```

---

## 🎛️ Controles del Sistema

### 1. **Botón Demo/Live** (Header)
```jsx
[📊 DEMO Mode]  <->  [🔴 LIVE Mode]
 Solo cálculos       Transacciones reales
```

**Comportamiento:**
- Click para alternar entre modos
- Bloqueado si hay cálculos demo pendientes en modo LIVE
- Tooltip indica el estado actual

---

### 2. **Botón "Implementar en LIVE"** 🚀

**Ubicación:** Panel de Resumen de Cálculos  
**Función:** Ejecuta todos los cálculos demo en blockchain

**Confirmación:**
```
¿Implementar 4 cálculos en modo LIVE?

- 1 actualizaciones de oráculo
- 2 ajustes de APY
- 0 halvings
- 1 análisis ML

Esta acción NO SE PUEDE DESHACER.
```

**Proceso:**
1. Usuario confirma
2. Sistema cambia a modo LIVE automáticamente
3. Ejecuta cada operación secuencialmente (delay 500ms)
4. Muestra progreso con toast loading
5. Toast final: `✅ Implementación completa: 4 exitosos, 0 fallidos`
6. Limpia datos demo automáticamente
7. Actualiza métricas y logs

---

### 3. **Botón "Borrar y Resetear"** 🗑️

**Ubicación:** Panel de Resumen de Cálculos  
**Función:** Elimina todos los cálculos demo

**Confirmación:**
```
¿Borrar 4 cálculos demo?
```

**Comportamiento:**
- Limpia array `demoCalculations`
- Resetea `calculationSummary` a null
- Oculta panel de resumen
- Toast: `🗑️ Datos demo reseteados`

---

## 🔧 Funciones Implementadas

### `updateSummary(calculations)`
```javascript
// Genera resumen estadístico de cálculos
const summary = {
    totalCalculations: 4,
    byType: {
        ORACLE_UPDATE: 1,
        APY_ADJUSTMENT: 2,
        HALVING_EXECUTION: 0,
        ML_ANALYSIS: 1
    },
    lastCalculation: {...},
    timestamp: '2025-11-17T14:24:45.123Z'
};
```

---

### `implementCalculationsLive()`
```javascript
// Ejecuta todos los cálculos demo en blockchain
- Valida que haya cálculos
- Muestra confirmación con detalles
- Itera sobre cada cálculo
- Ejecuta API call correspondiente
- Delay de 500ms entre operaciones
- Cuenta éxitos/fallos
- Limpia datos al finalizar
- Actualiza métricas
```

**Endpoints usados:**
- `POST /api/automation/test/oracle` - Oracle updates
- `POST /api/automation/manual/apy` - APY adjustments
- `POST /api/automation/manual/halving` - Halving execution

---

### `resetDemoData()`
```javascript
// Limpia todos los datos demo
- Valida que haya datos
- Solicita confirmación
- Limpia demoCalculations[]
- Resetea calculationSummary
- Muestra toast de éxito
```

---

### `toggleMode()`
```javascript
// Cambia entre Demo y Live
- Valida que no haya cálculos pendientes
- Cambia isLiveMode state
- Muestra toast informativo
- Actualiza UI (color del botón)
```

**Restricción:**  
No permite cambiar a DEMO si hay cálculos pendientes en modo LIVE.

---

## 📱 Componentes UI

### 1. **Mode Toggle Button**
```jsx
<button className="border px-6 py-2 rounded-lg">
    {isLiveMode ? (
        <div className="bg-red-500/20 border-red-500">
            🔴 LIVE Mode
            <span>Transacciones reales</span>
        </div>
    ) : (
        <div className="bg-blue-500/20 border-blue-500">
            📊 DEMO Mode
            <span>Solo cálculos</span>
        </div>
    )}
</button>
```

---

### 2. **Calculation Summary Panel**
```jsx
{!isLiveMode && demoCalculations.length > 0 && (
    <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50">
        <h2>🧮 Resumen de Cálculos Demo ({count})</h2>
        
        {/* Estadísticas por tipo */}
        <StatsGrid />
        
        {/* Lista de operaciones */}
        <OperationsList />
        
        {/* Botones de acción */}
        <ActionButtons />
        
        {/* Advertencia */}
        <WarningBanner />
    </div>
)}
```

**Visibilidad:**
- Solo en modo DEMO
- Solo si hay cálculos (`demoCalculations.length > 0`)
- Se oculta automáticamente al cambiar a LIVE

---

### 3. **Calculation Card**
```jsx
<div className="bg-gray-700/50 rounded-lg p-3">
    <div className="flex justify-between">
        <span>#1 ORACLE_UPDATE</span>
        <span>14:23:45</span>
    </div>
    <div className="grid grid-cols-2">
        <div>
            <p>Datos:</p>
            <p>assetPair: BTC/USD</p>
            <p>price: 65432</p>
        </div>
        <div>
            <p>Resultado:</p>
            <p>Actualización registrada</p>
            <p>Considerar aumento de APY</p>
        </div>
    </div>
</div>
```

---

## 🎨 Estados Visuales

### Modo DEMO Activo
- **Botón:** Azul `bg-blue-500/20 border-blue-500`
- **Texto:** "📊 DEMO Mode - Solo cálculos"
- **Panel Resumen:** Visible si hay cálculos
- **Toast acciones:** Icono 🧮 + "Cálculo Demo"

### Modo LIVE Activo
- **Botón:** Rojo `bg-red-500/20 border-red-500`
- **Texto:** "🔴 LIVE Mode - Transacciones reales"
- **Panel Resumen:** Oculto
- **Toast acciones:** Icono estándar + "LIVE"

---

## ⚡ Flujo de Trabajo Recomendado

### Caso de Uso 1: Prueba Segura
```
1. Usuario activa modo DEMO 📊
2. Ejecuta 3 simulaciones de oráculo 🔮
3. Ajusta APY 2 veces 📈
4. Revisa resumen de 5 operaciones 🧮
5. Analiza resultados y predicciones
6. Click "Implementar en LIVE" 🚀
7. Confirma implementación
8. Sistema ejecuta todas las operaciones
9. Métricas actualizadas ✅
```

### Caso de Uso 2: Descarte de Prueba
```
1. Usuario activa modo DEMO 📊
2. Prueba diferentes configuraciones
3. Genera 10 cálculos
4. Decide que no son apropiados
5. Click "Borrar y Resetear" 🗑️
6. Confirma borrado
7. Panel de resumen desaparece
8. Listo para nueva prueba
```

### Caso de Uso 3: Operación Directa
```
1. Usuario activa modo LIVE 🔴
2. Ejecuta ajuste de APY
3. Transacción se ejecuta inmediatamente
4. Logs actualizados en tiempo real
5. Sin pasar por resumen demo
```

---

## 🔐 Seguridad y Validaciones

### Modo DEMO
- ✅ No requiere wallet conectada
- ✅ No consume gas
- ✅ No modifica blockchain
- ✅ Operaciones reversibles (resetear)
- ✅ Pruebas ilimitadas

### Modo LIVE
- ⚠️ Requiere backend disponible
- ⚠️ Botones deshabilitados si backend offline
- ⚠️ Requiere confirmación en halvings
- ⚠️ Confirmación obligatoria para implementación
- ⚠️ Advertencia visible en panel resumen

---

## 📊 Estados y Variables

```javascript
// Estados principales
const [isLiveMode, setIsLiveMode] = useState(false);
const [demoCalculations, setDemoCalculations] = useState([]);
const [calculationSummary, setCalculationSummary] = useState(null);

// Estructura de cálculo
{
    id: 1731870285123,
    type: 'ORACLE_UPDATE' | 'APY_ADJUSTMENT' | 'HALVING_EXECUTION' | 'ML_ANALYSIS',
    timestamp: '2025-11-17T14:24:45.123Z',
    data: { /* datos específicos */ },
    result: { /* resultados calculados */ }
}

// Estructura de resumen
{
    totalCalculations: 4,
    byType: { ORACLE_UPDATE: 1, APY_ADJUSTMENT: 2, ... },
    lastCalculation: { /* último cálculo */ },
    timestamp: '2025-11-17T14:25:00.000Z'
}
```

---

## 🎉 Animaciones y Feedback

### Demo Mode
- **Toast:** Icono 🧮 + mensaje "📊 Cálculo Demo: ..."
- **Duración:** 3000ms
- **Color:** Azul/Púrpura
- **Confetti:** Normal (según tipo de operación)

### Live Mode
- **Toast:** Icono estándar + "🔴 LIVE: ..."
- **Duración:** 2000-5000ms
- **Color:** Verde (éxito) / Rojo (error)
- **Confetti:** Intenso en éxitos

### Implementación
- **Toast Loading:** "🔄 Implementando cálculos..."
- **Toast Final:** "✅ X exitosos, Y fallidos"
- **Confetti:** Explosión grande al finalizar

---

## 🐛 Manejo de Errores

### Error: Backend no disponible
```javascript
disabled={loading || !backendReady}
// Botón "Implementar LIVE" deshabilitado
```

### Error: No hay cálculos
```javascript
if (demoCalculations.length === 0) {
    toast.error('No hay cálculos para implementar');
    return;
}
```

### Error: Cálculos pendientes al cambiar modo
```javascript
if (isLiveMode && demoCalculations.length > 0) {
    toast.error('Implementa o borra los cálculos demo antes...');
    return;
}
```

### Error: Fallo en implementación
```javascript
// Contador de éxitos/fallos
successful: 3
failed: 1
// Toast muestra ambos números
```

---

## 📈 Métricas y Performance

### Operaciones Demo
- **Tiempo de cálculo:** < 100ms
- **Almacenamiento:** Local state (memoria)
- **Límite:** Sin límite (recomendado < 50)

### Implementación Live
- **Delay entre operaciones:** 500ms
- **Timeout API:** 10000ms
- **Requests secuenciales:** Sí (evita sobrecarga)
- **Actualización métricas:** 2000ms después

---

## 🔄 Actualizaciones Futuras

### Propuestas
- [ ] Exportar cálculos demo a JSON
- [ ] Importar configuraciones pre-calculadas
- [ ] Programar implementación (schedule)
- [ ] Modo "Dry-run" con validación backend
- [ ] Historial de implementaciones
- [ ] Rollback de operaciones LIVE
- [ ] Notificaciones por email antes de LIVE
- [ ] Multi-user: aprobar cálculos (workflow)

---

## 📝 Notas de Desarrollo

### Dependencias
- React Hooks: `useState`, `useCallback`, `useMemo`
- Axios para API calls
- React Hot Toast para notificaciones
- Canvas Confetti para animaciones

### Compatibilidad
- ✅ React 18+
- ✅ Navegadores modernos
- ✅ Mobile responsive

### Performance
- Memoización de funciones con `useCallback`
- Renderizado condicional de panel resumen
- Lazy loading de operaciones (scroll en lista)

---

**Autor:** GitHub Copilot  
**Versión:** 1.0 Demo/Live System  
**Última Actualización:** 17/11/2025
