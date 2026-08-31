# 🎯 Guía Rápida: Agregar Propuestas DAO Iniciales

## ✅ Archivos Creados

1. **`backend/seeds/daoSeed.js`** - Script para poblar la base de datos
2. **Script agregado en `package.json`**: `npm run seed:dao`

## 🚀 Pasos para Activar las Propuestas

### Método 1: Usando el Seed (Recomendado)

```powershell
# 1. Asegurarse de que MongoDB esté corriendo
# Si usas MongoDB local:
mongod

# 2. Desde la carpeta backend, ejecutar:
cd backend
npm run seed:dao
```

El seed creará automáticamente:
- ✅ Configuración DAO (quorum, período votación, threshold)
- ✅ Fondos iniciales en tesorería (1M USDC, 5M BEZ, 100 ETH)
- ✅ **4 Propuestas DAO**

### Método 2: Inserción Manual con MongoDB Compass

Si no puedes ejecutar el seed, puedes insertar los documentos manualmente:

#### 1. Conectar a MongoDB Compass
```
mongodb://localhost:27017/bezhasDB
```

#### 2. Crear/Seleccionar base de datos: `bezhasDB`

#### 3. Insertar en colección `daoproposals`:

```json
[
  {
    "title": "Aumentar recompensas por contenido verificado",
    "description": "Propuesta para incrementar en un 25% las recompensas para creadores que verifican contenido mediante blockchain. Esto incentivará la creación de contenido de calidad y aumentará la participación en la plataforma.",
    "category": "treasury",
    "creator": "0x1234567890abcdef1234567890abcdef12345678",
    "status": "active",
    "startDate": "2025-11-20T00:00:00.000Z",
    "endDate": "2025-11-25T00:00:00.000Z",
    "votesFor": 1245000,
    "votesAgainst": 234000,
    "actions": [
      {
        "type": "updateSettings",
        "target": "rewards.contentCreation",
        "value": "1.25",
        "data": { "multiplier": 1.25 }
      }
    ]
  },
  {
    "title": "Implementar sistema de moderación descentralizada",
    "description": "Crear un sistema de jurados aleatorios usando NFTs para moderar contenido reportado. Los jurados serán seleccionados de holders de NFTs especiales y recibirán recompensas por participar.",
    "category": "governance",
    "creator": "0x1234567890abcdef1234567890abcdef12345678",
    "status": "active",
    "startDate": "2025-11-20T00:00:00.000Z",
    "endDate": "2025-11-27T00:00:00.000Z",
    "votesFor": 890000,
    "votesAgainst": 567000,
    "actions": [
      {
        "type": "custom",
        "target": "moderation.system",
        "value": "decentralized-jury",
        "data": { "jurySize": 5, "requiredNFT": "ModeratorBadge" }
      }
    ]
  },
  {
    "title": "Financiar hackathon de desarrolladores Q1 2026",
    "description": "Asignar 50,000 USDC de la tesorería para premios del hackathon y atracción de talento. El evento se enfocará en construir dApps sobre nuestra infraestructura.",
    "category": "development",
    "creator": "0x1234567890abcdef1234567890abcdef12345678",
    "status": "active",
    "startDate": "2025-11-20T00:00:00.000Z",
    "endDate": "2025-11-23T00:00:00.000Z",
    "votesFor": 2100000,
    "votesAgainst": 150000,
    "actions": [
      {
        "type": "transfer",
        "target": "0xHackathonWallet123456789",
        "value": "50000",
        "data": { "token": "USDC", "purpose": "Q1 2026 Hackathon" }
      }
    ]
  },
  {
    "title": "Reducir comisión de marketplace al 1.5%",
    "description": "Propuesta para reducir la comisión del marketplace NFT del 2.5% al 1.5% para aumentar volumen de transacciones y competitividad con otras plataformas.",
    "category": "protocol",
    "creator": "0x1234567890abcdef1234567890abcdef12345678",
    "status": "approved",
    "startDate": "2025-11-10T00:00:00.000Z",
    "endDate": "2025-11-17T00:00:00.000Z",
    "votesFor": 3400000,
    "votesAgainst": 890000,
    "actions": [
      {
        "type": "updateSettings",
        "target": "marketplace.fee",
        "value": "1.5",
        "data": { "newFee": 1.5, "oldFee": 2.5 }
      }
    ]
  }
]
```

#### 4. Insertar configuración en `daosettings`:

```json
{
  "quorumPercentage": 10,
  "votingPeriodDays": 7,
  "proposalThreshold": 100000,
  "allowDelegation": true,
  "maxDelegations": 100,
  "rewardPerVote": 10
}
```

#### 5. Insertar fondos en `treasurytransactions`:

```json
[
  {
    "type": "deposit",
    "token": "USDC",
    "amount": 1000000,
    "description": "Fondos iniciales de la tesorería",
    "status": "completed"
  },
  {
    "type": "deposit",
    "token": "BEZ",
    "amount": 5000000,
    "description": "Asignación de tokens BEZ",
    "status": "completed"
  },
  {
    "type": "deposit",
    "token": "ETH",
    "amount": 100,
    "description": "Reserva de ETH",
    "status": "completed"
  }
]
```

## 📊 Resumen de las 4 Propuestas

| # | Título | Categoría | Estado | Votos A Favor | Votos en Contra |
|---|--------|-----------|--------|---------------|-----------------|
| 1 | Aumentar recompensas contenido | Treasury | ✅ Activa | 1,245,000 | 234,000 |
| 2 | Moderación descentralizada | Governance | ✅ Activa | 890,000 | 567,000 |
| 3 | Hackathon Q1 2026 | Development | ✅ Activa | 2,100,000 | 150,000 |
| 4 | Reducir comisión marketplace | Protocol | ✅ **Aprobada** | 3,400,000 | 890,000 |

## 🔍 Verificación

Una vez insertados los datos:

1. **Iniciar backend**:
```powershell
cd backend
npm start
```

2. **Abrir frontend**:
```
http://localhost:5173/dao-page
```

3. **Verificar que aparezcan**:
   - En pestaña "Propuestas": Deberían aparecer las 4 propuestas
   - En pestaña "Resumen": Ver las 3 propuestas activas
   - En pestaña "Tesorería": Ver fondos (1M USDC, 5M BEZ, 100 ETH)

4. **Panel Admin**:
```
http://localhost:5173/dao/admin
```

## 🎉 ¡Listo!

Las propuestas ahora son **reales** y están guardadas en MongoDB. Los usuarios pueden:
- ✅ Ver las propuestas
- ✅ Votar en las activas (requiere wallet conectado)
- ✅ Ver historial de votación
- ✅ Admins pueden ejecutar la propuesta aprobada

## 📝 Notas

- Las fechas de inicio/fin se ajustan automáticamente si usas el seed
- El wallet creador (`0x1234...5678`) es genérico para testing
- Las propuestas tienen acciones definidas para su ejecución
- La propuesta #4 ya está aprobada y lista para ejecutar desde admin panel
