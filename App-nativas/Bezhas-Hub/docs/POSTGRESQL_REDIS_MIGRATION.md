# 🗄️ Migración a PostgreSQL + Redis

## 📋 Resumen Ejecutivo

Este documento detalla la migración del sistema BeZhas desde almacenamiento en memoria hacia una arquitectura escalable con PostgreSQL (base de datos relacional) y Redis (caché en memoria).

## 🎯 Objetivos de la Migración

1. **Persistencia de Datos**: Eliminar pérdida de datos al reiniciar servidor
2. **Escalabilidad**: Soportar millones de registros y múltiples instancias
3. **Performance**: Cache inteligente con Redis para consultas frecuentes
4. **Confiabilidad**: Backups automáticos y recuperación ante desastres
5. **Análisis**: Queries complejos y reportes con SQL

## 📊 Estado Actual

### Problemas Identificados

```javascript
// backend/routes/logistics.routes.js
let containersDB = []; // ❌ Almacenamiento en memoria

// backend/routes/nftRental.routes.js
// ❌ Sin persistencia de listados activos

// backend/routes/nftOffers.routes.js  
// ❌ Sin cache de ofertas populares
```

### Limitaciones:
- ❌ Datos se pierden al reiniciar
- ❌ No hay búsqueda avanzada
- ❌ Sin historial de transacciones
- ❌ Performance degrada con muchos registros
- ❌ No hay métricas ni analytics

## 🏗️ Arquitectura Propuesta

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
┌──────▼───────────────────────────┐
│     Backend (Express.js)          │
│  ┌─────────────────────────────┐ │
│  │   API Layer (REST/GraphQL)  │ │
│  └──────────┬──────────────────┘ │
│             │                     │
│  ┌──────────▼──────────┐         │
│  │  Service Layer      │         │
│  │  - Business Logic   │         │
│  │  - Validation       │         │
│  └──────┬──────┬───────┘         │
└─────────┼──────┼──────────────────┘
          │      │
    ┌─────▼───┐  │  ┌──────▼──────┐
    │  Redis  │  └─▶│ PostgreSQL  │
    │  Cache  │     │  Database   │
    └─────────┘     └─────────────┘
          │               │
    ┌─────▼───────────────▼─────┐
    │   Blockchain (Polygon)    │
    │  - NFTRental              │
    │  - NFTOffers              │
    │  - LogisticsContainer     │
    │  - BeZhasRealEstate       │
    └───────────────────────────┘
```

## 📦 Instalación

### 1. Instalar Dependencias

```bash
npm install pg redis ioredis sequelize
npm install --save-dev sequelize-cli
```

### 2. Instalar PostgreSQL

**Windows:**
```bash
# Descargar desde https://www.postgresql.org/download/windows/
# O usar Chocolatey
choco install postgresql
```

**Linux/Mac:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Mac
brew install postgresql
```

### 3. Instalar Redis

**Windows:**
```bash
# Opción 1: Redis para Windows
# https://github.com/microsoftarchive/redis/releases

# Opción 2: WSL + Redis
wsl --install
wsl
sudo apt update
sudo apt install redis-server
```

**Linux:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

**Mac:**
```bash
brew install redis
brew services start redis
```

## 🔧 Configuración

### 1. PostgreSQL Setup

```bash
# Crear usuario y base de datos
sudo -u postgres psql

CREATE USER bezhas WITH PASSWORD 'bezhas_secure_password';
CREATE DATABASE bezhas_db OWNER bezhas;
GRANT ALL PRIVILEGES ON DATABASE bezhas_db TO bezhas;
\q
```

### 2. Variables de Entorno

Actualizar `.env`:

```env
# PostgreSQL
DATABASE_URL=postgresql://bezhas:bezhas_secure_password@localhost:5432/bezhas_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bezhas_db
DB_USER=bezhas
DB_PASSWORD=bezhas_secure_password
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
CACHE_TTL=3600 # 1 hora en segundos

# Cache Strategy
CACHE_ENABLED=true
CACHE_NFT_LISTINGS=true
CACHE_USER_OFFERS=true
CACHE_CONTAINERS=true
```

### 3. Sequelize Setup

```bash
# Inicializar Sequelize
npx sequelize-cli init
```

Esto creará:
```
config/
├── config.json       # Configuración de DB
models/
├── index.js          # Auto-loader de modelos
migrations/
├── YYYYMMDDHHMMSS-create-*.js
seeders/
```

## 📊 Esquema de Base de Datos

### Tablas Principales

#### 1. NFT Rentals

```sql
CREATE TABLE nft_rentals (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER UNIQUE NOT NULL,
    nft_contract VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    owner VARCHAR(42) NOT NULL,
    renter VARCHAR(42),
    daily_rate DECIMAL(38, 0) NOT NULL,
    collateral DECIMAL(38, 0) NOT NULL,
    max_rental_days INTEGER NOT NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_owner (owner),
    INDEX idx_renter (renter),
    INDEX idx_nft (nft_contract, token_id),
    INDEX idx_status (status)
);
```

#### 2. NFT Offers

```sql
CREATE TABLE nft_offers (
    id SERIAL PRIMARY KEY,
    offer_id INTEGER UNIQUE NOT NULL,
    nft_contract VARCHAR(42) NOT NULL,
    token_id VARCHAR(78) NOT NULL,
    offerer VARCHAR(42) NOT NULL,
    nft_owner VARCHAR(42) NOT NULL,
    amount DECIMAL(38, 0) NOT NULL,
    duration INTEGER NOT NULL,
    expiration TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    counter_offer_id INTEGER,
    counter_amount DECIMAL(38, 0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_offerer (offerer),
    INDEX idx_nft_owner (nft_owner),
    INDEX idx_nft (nft_contract, token_id),
    INDEX idx_status (status),
    INDEX idx_expiration (expiration)
);
```

#### 3. Logistics Containers

```sql
CREATE TABLE logistics_containers (
    id SERIAL PRIMARY KEY,
    container_id VARCHAR(50) UNIQUE NOT NULL,
    owner VARCHAR(42) NOT NULL,
    location TEXT,
    status VARCHAR(50),
    contents TEXT,
    origin TEXT,
    metadata_uri TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_owner (owner),
    INDEX idx_status (status),
    INDEX idx_container_id (container_id)
);

CREATE TABLE container_updates (
    id SERIAL PRIMARY KEY,
    container_id VARCHAR(50) NOT NULL,
    location TEXT,
    status VARCHAR(50),
    timestamp TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(42),
    FOREIGN KEY (container_id) REFERENCES logistics_containers(container_id)
);
```

#### 4. Real Estate Properties

```sql
CREATE TABLE real_estate_properties (
    id SERIAL PRIMARY KEY,
    property_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    total_shares INTEGER NOT NULL,
    share_price DECIMAL(38, 0) NOT NULL,
    total_revenue DECIMAL(38, 0) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE property_shareholders (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL,
    shareholder VARCHAR(42) NOT NULL,
    shares INTEGER NOT NULL,
    claimed_dividends DECIMAL(38, 0) DEFAULT 0,
    last_claim TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES real_estate_properties(property_id),
    UNIQUE(property_id, shareholder),
    INDEX idx_shareholder (shareholder),
    INDEX idx_property (property_id)
);

CREATE TABLE revenue_deposits (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL,
    amount DECIMAL(38, 0) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    depositor VARCHAR(42),
    FOREIGN KEY (property_id) REFERENCES real_estate_properties(property_id)
);
```

#### 5. Transactions Log

```sql
CREATE TABLE blockchain_transactions (
    id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    contract_name VARCHAR(50),
    function_name VARCHAR(100),
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    value DECIMAL(38, 0),
    gas_used INTEGER,
    gas_price DECIMAL(38, 0),
    status VARCHAR(20),
    block_number INTEGER,
    timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_from (from_address),
    INDEX idx_to (to_address),
    INDEX idx_contract (contract_address),
    INDEX idx_tx_hash (tx_hash)
);
```

## 🔌 Implementación

### Database Connection (config/database.js)

```javascript
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 10,
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    acquire: 30000,
    idle: 10000
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});

// Test connection
sequelize.authenticate()
  .then(() => console.log('✅ PostgreSQL conectado'))
  .catch(err => console.error('❌ Error conectando a PostgreSQL:', err));

module.exports = sequelize;
```

### Redis Connection (config/redis.js)

```javascript
const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

redis.on('connect', () => {
  console.log('✅ Redis conectado');
});

redis.on('error', (err) => {
  console.error('❌ Error en Redis:', err);
});

module.exports = redis;
```

### Cache Service (services/cache.service.js)

```javascript
const redis = require('../config/redis');

class CacheService {
  constructor() {
    this.ttl = parseInt(process.env.CACHE_TTL) || 3600;
    this.enabled = process.env.CACHE_ENABLED === 'true';
  }

  async get(key) {
    if (!this.enabled) return null;
    
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache GET error:', error);
      return null;
    }
  }

  async set(key, value, ttl = this.ttl) {
    if (!this.enabled) return;
    
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache SET error:', error);
    }
  }

  async delete(key) {
    if (!this.enabled) return;
    
    try {
      await redis.del(key);
    } catch (error) {
      console.error('Cache DELETE error:', error);
    }
  }

  async deletePattern(pattern) {
    if (!this.enabled) return;
    
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache DELETE PATTERN error:', error);
    }
  }

  // NFT Rental specific
  async getNFTRentalListings(owner) {
    return await this.get(`nft_rental:listings:${owner}`);
  }

  async setNFTRentalListings(owner, listings) {
    await this.set(`nft_rental:listings:${owner}`, listings);
  }

  async invalidateNFTRentalCache(owner) {
    await this.deletePattern(`nft_rental:listings:${owner}*`);
  }

  // NFT Offers specific
  async getNFTOffers(nftContract, tokenId) {
    return await this.get(`nft_offers:${nftContract}:${tokenId}`);
  }

  async setNFTOffers(nftContract, tokenId, offers) {
    await this.set(`nft_offers:${nftContract}:${tokenId}`, offers);
  }

  async invalidateNFTOffersCache(nftContract, tokenId) {
    await this.delete(`nft_offers:${nftContract}:${tokenId}`);
  }

  // Container specific
  async getContainer(containerId) {
    return await this.get(`container:${containerId}`);
  }

  async setContainer(containerId, container) {
    await this.set(`container:${containerId}`, container, 1800); // 30 min
  }
}

module.exports = new CacheService();
```

## 📝 Modelos Sequelize

### NFTRental Model (models/nftRental.model.js)

```javascript
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NFTRental = sequelize.define('NFTRental', {
  listingId: {
    type: DataTypes.INTEGER,
    unique: true,
    allowNull: false
  },
  nftContract: {
    type: DataTypes.STRING(42),
    allowNull: false
  },
  tokenId: {
    type: DataTypes.STRING(78),
    allowNull: false
  },
  owner: {
    type: DataTypes.STRING(42),
    allowNull: false
  },
  renter: {
    type: DataTypes.STRING(42)
  },
  dailyRate: {
    type: DataTypes.DECIMAL(38, 0),
    allowNull: false
  },
  collateral: {
    type: DataTypes.DECIMAL(38, 0),
    allowNull: false
  },
  maxRentalDays: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  startTime: {
    type: DataTypes.DATE
  },
  endTime: {
    type: DataTypes.DATE
  },
  status: {
    type: DataTypes.ENUM('active', 'rented', 'returned', 'cancelled'),
    defaultValue: 'active'
  }
}, {
  tableName: 'nft_rentals',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['owner'] },
    { fields: ['renter'] },
    { fields: ['nft_contract', 'token_id'] },
    { fields: ['status'] }
  ]
});

module.exports = NFTRental;
```

## 🔄 Migración de Datos

### Script de Migración (scripts/migrate-to-postgres.js)

```javascript
const sequelize = require('../config/database');
const NFTRental = require('../models/nftRental.model');
const NFTOffer = require('../models/nftOffer.model');
const LogisticsContainer = require('../models/logisticsContainer.model');

async function migrate() {
  console.log('🔄 Iniciando migración a PostgreSQL...\n');

  try {
    // 1. Sync database (create tables)
    await sequelize.sync({ force: false });
    console.log('✅ Tablas sincronizadas');

    // 2. Migrate existing in-memory data (if any)
    // This would read from blockchain events and populate DB

    // 3. Verify migration
    const rentalCount = await NFTRental.count();
    const offerCount = await NFTOffer.count();
    const containerCount = await LogisticsContainer.count();

    console.log('\n📊 Estadísticas:');
    console.log(`- NFT Rentals: ${rentalCount}`);
    console.log(`- NFT Offers: ${offerCount}`);
    console.log(`- Containers: ${containerCount}`);

    console.log('\n✨ Migración completada');
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  migrate().then(() => process.exit(0));
}

module.exports = migrate;
```

## 📌 Siguiente Paso

Ver [POSTGRESQL_IMPLEMENTATION.md](./POSTGRESQL_IMPLEMENTATION.md) para la implementación completa de los modelos y rutas actualizadas.

## 🔐 Seguridad

1. **Conexiones Encriptadas**: Usar SSL/TLS para PostgreSQL
2. **Autenticación**: Contraseñas fuertes, rotación periódica
3. **Firewall**: Restringir acceso a puertos DB (5432, 6379)
4. **Backups**: Automatizados diarios con retención 30 días
5. **Monitoring**: Logs de queries lentos, conexiones activas

## 📈 Performance

### Índices Recomendados
- Todas las direcciones (owner, renter, offerer)
- Campos de búsqueda frecuente (status, nft_contract)
- Fechas de expiración (expiration, end_time)

### Query Optimization
- Usar EXPLAIN ANALYZE
- Pagination con LIMIT/OFFSET
- Eager loading con Sequelize include
- Connection pooling configurado

## 🚀 Despliegue

```bash
# Desarrollo
npm run migrate
npm run seed # Optional

# Producción
NODE_ENV=production npm run migrate
NODE_ENV=production npm start
```
