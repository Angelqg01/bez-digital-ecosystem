# 🗄️ BezCoin Database Schema - MongoDB

Este documento define los schemas de MongoDB recomendados para migrar desde el almacenamiento en memoria a una base de datos persistente.

---

## 📊 Collections

### 1. `transactions` - Historial de Transacciones

```javascript
// backend/models/transaction.model.js

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  // Identificación
  transactionHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Usuario
  walletAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // Tipo de transacción
  type: {
    type: String,
    required: true,
    enum: ['buy', 'transfer', 'donate', 'receive', 'reward', 'claim'],
    index: true
  },
  
  // Montos
  amount: {
    type: String, // Usar String para evitar pérdida de precisión
    required: true
  },
  
  amountInWei: {
    type: String,
    required: true
  },
  
  // Direcciones
  from: {
    type: String,
    lowercase: true
  },
  
  to: {
    type: String,
    lowercase: true
  },
  
  // Estado
  status: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending',
    index: true
  },
  
  // Blockchain data
  blockNumber: {
    type: Number
  },
  
  gasUsed: {
    type: String
  },
  
  gasPrice: {
    type: String
  },
  
  // Metadata
  metadata: {
    message: String, // Para donaciones
    paymentMethod: String, // 'eth', 'stripe', 'wert', 'moonpay'
    currency: String, // 'USD', 'EUR', etc. (para FIAT)
    fiatAmount: String, // Cantidad en FIAT
    stripePaymentIntentId: String,
    moonpayTransactionId: String,
    actionContext: String // 'dao_creation', 'subscription', etc.
  },
  
  // Timestamps
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  confirmedAt: {
    type: Date
  }
}, {
  timestamps: true // Añade createdAt y updatedAt automáticamente
});

// Índices compuestos para queries optimizadas
TransactionSchema.index({ walletAddress: 1, timestamp: -1 });
TransactionSchema.index({ walletAddress: 1, type: 1, timestamp: -1 });
TransactionSchema.index({ status: 1, timestamp: -1 });

// Métodos del modelo
TransactionSchema.statics.getByAddress = function(address, options = {}) {
  const query = { walletAddress: address.toLowerCase() };
  
  if (options.type) {
    query.type = options.type;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100);
};

TransactionSchema.statics.getStats = async function(address) {
  const stats = await this.aggregate([
    { $match: { walletAddress: address.toLowerCase() } },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: { $toDouble: '$amount' } },
        count: { $sum: 1 }
      }
    }
  ]);
  
  return stats;
};

module.exports = mongoose.model('Transaction', TransactionSchema);
```

---

### 2. `rewards` - Sistema de Recompensas

```javascript
// backend/models/reward.model.js

const mongoose = require('mongoose');

const RewardSchema = new mongoose.Schema({
  // Usuario
  walletAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // Tipo de recompensa
  type: {
    type: String,
    required: true,
    enum: ['post', 'comment', 'dao_vote', 'daily_login', 'donation_reward', 'referral'],
    index: true
  },
  
  // Cantidad
  amount: {
    type: String,
    required: true
  },
  
  // Estado
  status: {
    type: String,
    required: true,
    enum: ['pending', 'claimed', 'expired'],
    default: 'pending',
    index: true
  },
  
  // Metadata
  metadata: {
    postId: String,
    commentId: String,
    daoId: String,
    referredUser: String,
    donationTxHash: String
  },
  
  // Reclamación
  claimedAt: {
    type: Date
  },
  
  claimedTxHash: {
    type: String
  },
  
  // Expiración
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  
  // Timestamps
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Índices
RewardSchema.index({ walletAddress: 1, status: 1 });
RewardSchema.index({ expiresAt: 1, status: 1 }); // Para limpiar recompensas expiradas

// Métodos
RewardSchema.statics.getPending = function(address) {
  return this.find({
    walletAddress: address.toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
};

RewardSchema.statics.getTotalEarned = async function(address) {
  const result = await this.aggregate([
    { $match: { walletAddress: address.toLowerCase() } },
    {
      $group: {
        _id: '$status',
        total: { $sum: { $toDouble: '$amount' } }
      }
    }
  ]);
  
  return result;
};

// Middleware para expirar recompensas automáticamente
RewardSchema.pre('find', function() {
  this.where({ expiresAt: { $gt: new Date() } });
});

module.exports = mongoose.model('Reward', RewardSchema);
```

---

### 3. `user_balances` - Cache de Balances

```javascript
// backend/models/userBalance.model.js

const mongoose = require('mongoose');

const UserBalanceSchema = new mongoose.Schema({
  // Usuario
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  
  // Balance
  balance: {
    type: String,
    required: true,
    default: '0'
  },
  
  balanceInWei: {
    type: String,
    required: true,
    default: '0'
  },
  
  // Estadísticas acumuladas
  stats: {
    totalPurchased: { type: String, default: '0' },
    totalDonated: { type: String, default: '0' },
    totalTransferred: { type: String, default: '0' },
    totalReceived: { type: String, default: '0' },
    totalRewardsEarned: { type: String, default: '0' },
    totalRewardsClaimed: { type: String, default: '0' }
  },
  
  // Última actualización
  lastUpdated: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Última sincronización con blockchain
  lastBlockSynced: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Métodos
UserBalanceSchema.statics.updateBalance = async function(address, newBalance) {
  return this.findOneAndUpdate(
    { walletAddress: address.toLowerCase() },
    {
      balance: newBalance,
      lastUpdated: new Date()
    },
    { upsert: true, new: true }
  );
};

UserBalanceSchema.statics.incrementStat = async function(address, statName, amount) {
  const update = {};
  update[`stats.${statName}`] = amount;
  
  return this.findOneAndUpdate(
    { walletAddress: address.toLowerCase() },
    { $inc: update },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('UserBalance', UserBalanceSchema);
```

---

### 4. `payment_intents` - Pagos FIAT

```javascript
// backend/models/paymentIntent.model.js

const mongoose = require('mongoose');

const PaymentIntentSchema = new mongoose.Schema({
  // Usuario
  walletAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // Proveedor
  provider: {
    type: String,
    required: true,
    enum: ['stripe', 'wert', 'moonpay']
  },
  
  // IDs externos
  externalId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  clientSecret: {
    type: String
  },
  
  // Montos
  fiatAmount: {
    type: String,
    required: true
  },
  
  currency: {
    type: String,
    required: true,
    default: 'USD'
  },
  
  tokenAmount: {
    type: String,
    required: true
  },
  
  // Estado
  status: {
    type: String,
    required: true,
    enum: ['created', 'processing', 'succeeded', 'failed', 'canceled'],
    default: 'created',
    index: true
  },
  
  // Metadata
  metadata: {
    paymentMethodType: String, // 'card', 'bank_transfer', etc.
    email: String,
    customerName: String
  },
  
  // Tokenización
  tokensCredited: {
    type: Boolean,
    default: false
  },
  
  creditedTxHash: {
    type: String
  },
  
  creditedAt: {
    type: Date
  },
  
  // Timestamps
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices
PaymentIntentSchema.index({ walletAddress: 1, timestamp: -1 });
PaymentIntentSchema.index({ status: 1, tokensCredited: 1 });

// Métodos
PaymentIntentSchema.statics.markAsCredited = async function(externalId, txHash) {
  return this.findOneAndUpdate(
    { externalId },
    {
      tokensCredited: true,
      creditedTxHash: txHash,
      creditedAt: new Date(),
      status: 'succeeded'
    },
    { new: true }
  );
};

module.exports = mongoose.model('PaymentIntent', PaymentIntentSchema);
```

---

### 5. `daily_rewards` - Recompensas Diarias

```javascript
// backend/models/dailyReward.model.js

const mongoose = require('mongoose');

const DailyRewardSchema = new mongoose.Schema({
  // Usuario
  walletAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // Fecha (solo fecha, sin hora)
  date: {
    type: String, // 'YYYY-MM-DD'
    required: true,
    index: true
  },
  
  // Recompensa
  amount: {
    type: String,
    required: true,
    default: '1' // 1 BEZ por día
  },
  
  // Estado
  claimed: {
    type: Boolean,
    default: false
  },
  
  claimedAt: {
    type: Date
  },
  
  // Racha
  streak: {
    type: Number,
    default: 1
  },
  
  // Bonus por racha
  streakBonus: {
    type: String,
    default: '0'
  }
}, {
  timestamps: true
});

// Índice único para evitar duplicados
DailyRewardSchema.index({ walletAddress: 1, date: 1 }, { unique: true });

// Métodos
DailyRewardSchema.statics.checkToday = async function(address) {
  const today = new Date().toISOString().split('T')[0];
  
  return this.findOne({
    walletAddress: address.toLowerCase(),
    date: today
  });
};

DailyRewardSchema.statics.claimToday = async function(address) {
  const today = new Date().toISOString().split('T')[0];
  
  // Calcular racha
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const yesterdayReward = await this.findOne({
    walletAddress: address.toLowerCase(),
    date: yesterday
  });
  
  const streak = yesterdayReward ? yesterdayReward.streak + 1 : 1;
  
  // Bonus por racha (0.1 BEZ por cada día consecutivo)
  const streakBonus = (streak * 0.1).toString();
  
  return this.findOneAndUpdate(
    {
      walletAddress: address.toLowerCase(),
      date: today
    },
    {
      claimed: true,
      claimedAt: new Date(),
      streak,
      streakBonus
    },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('DailyReward', DailyRewardSchema);
```

---

## 🔧 Migración desde Memoria a MongoDB

### Paso 1: Instalar Mongoose

```bash
cd backend
npm install mongoose
```

### Paso 2: Configurar Conexión

```javascript
// backend/config/database.js

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ MongoDB conectado exitosamente');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
```

### Paso 3: Actualizar server.js

```javascript
// backend/server.js

const connectDB = require('./config/database');

// Conectar a MongoDB
connectDB();

// ... resto del código
```

### Paso 4: Actualizar Routes

```javascript
// backend/routes/bezcoin.routes.js

const Transaction = require('../models/transaction.model');
const Reward = require('../models/reward.model');
const UserBalance = require('../models/userBalance.model');
const PaymentIntent = require('../models/paymentIntent.model');

// Reemplazar Map por MongoDB:

// Antes:
// transactionsDB.set(walletAddress, transaction);

// Después:
await Transaction.create({
  transactionHash: hash,
  walletAddress,
  type,
  amount,
  from,
  to,
  status: 'confirmed',
  timestamp: new Date()
});

// Actualizar balance cache:
await UserBalance.incrementStat(walletAddress, 'totalPurchased', amount);
```

---

## 📈 Queries Optimizadas

### Obtener Historial con Filtros

```javascript
// GET /api/bezcoin/transactions/:address
router.get('/transactions/:address', async (req, res) => {
  const { address } = req.params;
  const { type, status, limit = 100, page = 1 } = req.query;
  
  const query = { walletAddress: address.toLowerCase() };
  
  if (type) query.type = type;
  if (status) query.status = status;
  
  const transactions = await Transaction.find(query)
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));
  
  const total = await Transaction.countDocuments(query);
  
  res.json({
    success: true,
    transactions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});
```

### Obtener Estadísticas Agregadas

```javascript
// GET /api/bezcoin/stats/:address
router.get('/stats/:address', async (req, res) => {
  const { address } = req.params;
  
  // Obtener del cache
  let balance = await UserBalance.findOne({
    walletAddress: address.toLowerCase()
  });
  
  if (!balance) {
    // Si no existe en cache, calcular desde transacciones
    const stats = await Transaction.getStats(address);
    
    balance = await UserBalance.create({
      walletAddress: address.toLowerCase(),
      balance: '0', // Actualizar desde contrato
      stats: {
        totalPurchased: stats.find(s => s._id === 'buy')?.totalAmount || '0',
        totalDonated: stats.find(s => s._id === 'donate')?.totalAmount || '0',
        // ... etc
      }
    });
  }
  
  // Obtener recompensas
  const rewardStats = await Reward.getTotalEarned(address);
  
  res.json({
    success: true,
    stats: {
      ...balance.stats,
      rewardsEarned: rewardStats.find(r => r._id === 'claimed')?.total || '0',
      rewardsPending: rewardStats.find(r => r._id === 'pending')?.total || '0'
    }
  });
});
```

---

## 🔐 Variables de Entorno

```env
# .env

# MongoDB
MONGODB_URI=mongodb://localhost:27017/bezhas
# O MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bezhas?retryWrites=true&w=majority

# Opcionales para desarrollo
MONGODB_DEBUG=true
```

---

## 🚀 Deployment con MongoDB Atlas

### Paso 1: Crear Cluster

1. Ir a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crear cuenta gratuita
3. Crear nuevo cluster (Free Tier)
4. Esperar a que se provisione

### Paso 2: Configurar Acceso

1. Database Access → Add New Database User
2. Network Access → Add IP Address (0.0.0.0/0 para desarrollo)

### Paso 3: Obtener Connection String

1. Clusters → Connect → Connect your application
2. Copiar connection string
3. Reemplazar `<password>` y `<dbname>`

### Paso 4: Actualizar .env

```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/bezhas?retryWrites=true&w=majority
```

---

## 📊 Índices Recomendados

Estos índices se crean automáticamente con los schemas, pero puedes crearlos manualmente:

```javascript
// En MongoDB Compass o Mongo Shell:

// Transactions
db.transactions.createIndex({ walletAddress: 1, timestamp: -1 });
db.transactions.createIndex({ walletAddress: 1, type: 1, timestamp: -1 });
db.transactions.createIndex({ transactionHash: 1 }, { unique: true });

// Rewards
db.rewards.createIndex({ walletAddress: 1, status: 1 });
db.rewards.createIndex({ expiresAt: 1, status: 1 });

// UserBalances
db.userbalances.createIndex({ walletAddress: 1 }, { unique: true });

// PaymentIntents
db.paymentintents.createIndex({ externalId: 1 }, { unique: true });
db.paymentintents.createIndex({ walletAddress: 1, timestamp: -1 });

// DailyRewards
db.dailyrewards.createIndex({ walletAddress: 1, date: 1 }, { unique: true });
```

---

## ✅ Checklist de Migración

- [ ] Instalar Mongoose
- [ ] Crear modelos en `backend/models/`
- [ ] Configurar conexión en `backend/config/database.js`
- [ ] Actualizar `server.js` para conectar a MongoDB
- [ ] Reemplazar `Map` por modelos de Mongoose en rutas
- [ ] Probar queries básicas
- [ ] Crear índices
- [ ] Migrar datos existentes (si hay)
- [ ] Actualizar tests
- [ ] Deploy con MongoDB Atlas

---

**¡Base de datos lista para producción! 🎉**
