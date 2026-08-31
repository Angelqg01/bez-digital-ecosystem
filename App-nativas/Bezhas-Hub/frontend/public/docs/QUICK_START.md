# ⚡ Quick Start - BeZhas Industrial Contracts

## 🚀 Comandos Rápidos

### 1. Testing

```bash
# Ejecutar todos los tests
npx hardhat test

# Test específico - NFTRental
npx hardhat test test/NFTRental.test.js

# Test específico - NFTOffers
npx hardhat test test/NFTOffers.test.js

# Test específico - LogisticsContainer
npx hardhat test test/LogisticsContainer.test.js

# Test específico - BeZhasRealEstate
npx hardhat test test/BeZhasRealEstate.test.js

# Test con coverage
npx hardhat coverage

# Test con gas report
REPORT_GAS=true npx hardhat test
```

### 2. Deployment - Testnet (Amoy)

```bash
# NFTRental
npx hardhat run scripts/deploy-nft-rental.js --network amoy

# NFTOffers
npx hardhat run scripts/deploy-nft-offers.js --network amoy

# Verificar en PolygonScan
npx hardhat verify --network amoy <CONTRACT_ADDRESS> <BEZ_TOKEN_ADDRESS>
```

### 3. Deployment - Mainnet (después de auditoría)

```bash
# ⚠️ SOLO DESPUÉS DE AUDITORÍA PROFESIONAL

# NFTRental
npx hardhat run scripts/deploy-nft-rental.js --network polygon

# NFTOffers
npx hardhat run scripts/deploy-nft-offers.js --network polygon

# Verificar en PolygonScan
npx hardhat verify --network polygon <CONTRACT_ADDRESS> <BEZ_TOKEN_ADDRESS>
```

### 4. PostgreSQL Setup

```bash
# Instalar dependencias
npm install pg redis ioredis sequelize

# Crear base de datos
sudo -u postgres psql
CREATE USER bezhas WITH PASSWORD 'bezhas_secure_password';
CREATE DATABASE bezhas_db OWNER bezhas;
GRANT ALL PRIVILEGES ON DATABASE bezhas_db TO bezhas;
\q

# Ejecutar migrations
npx sequelize-cli db:migrate

# Seed data (opcional)
npx sequelize-cli db:seed:all
```

### 5. Redis Setup

```bash
# Instalar Redis
# Windows: https://github.com/microsoftarchive/redis/releases
# Linux: sudo apt install redis-server

# Start Redis
# Windows: redis-server.exe
# Linux: sudo systemctl start redis

# Verificar Redis
redis-cli ping  # Debe retornar PONG
```

### 6. Backend Server

```bash
# Instalar dependencias
npm install

# Start development server
npm run dev

# Start production server
NODE_ENV=production npm start

# Verificar endpoints
curl http://localhost:3000/api/nft-rental/config
curl http://localhost:3000/api/nft-offers/config
```

---

## 🔧 Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# Blockchain
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
POLYGON_MAINNET_RPC=https://polygon-rpc.com
PRIVATE_KEY=your_deployer_private_key_here

# Contract Addresses
BEZ_TOKEN_ADDRESS=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
BEZHAS_NFT_ADDRESS=deployed_nft_address_here
NFT_RENTAL_ADDRESS=deployed_rental_address_here
NFT_OFFERS_ADDRESS=deployed_offers_address_here
FEE_RECIPIENT=your_wallet_address_here

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
CACHE_TTL=3600

# Cache Strategy
CACHE_ENABLED=true
CACHE_NFT_LISTINGS=true
CACHE_USER_OFFERS=true
CACHE_CONTAINERS=true

# API
PORT=3000
NODE_ENV=development
```

---

## 📋 Checklist de Verificación

### Pre-Testing
- [ ] Node.js instalado (v16+)
- [ ] Hardhat configurado
- [ ] `.env` file creado
- [ ] Dependencias instaladas (`npm install`)

### Pre-Deployment Testnet
- [ ] Tests pasando (100%)
- [ ] Gas profiling ejecutado
- [ ] Wallet con MATIC en Amoy
- [ ] BEZ token address verificada
- [ ] Hardhat config correcta

### Pre-Deployment Mainnet
- [ ] ⚠️ Auditoría profesional completada
- [ ] ⚠️ Fixes de seguridad implementados
- [ ] ⚠️ Testing en Amoy (2+ semanas)
- [ ] ⚠️ Multisig wallet setup (Gnosis Safe)
- [ ] ⚠️ Bug bounty program activo
- [ ] ⚠️ Emergency pause implementado
- [ ] ⚠️ Monitoring setup

### Pre-Backend Launch
- [ ] PostgreSQL instalado y configurado
- [ ] Redis instalado y running
- [ ] Database migrations ejecutadas
- [ ] Backend routes testeados
- [ ] Monitoring configurado

---

## 🎯 Testing Coverage

```bash
# Generar reporte de coverage
npx hardhat coverage

# Ver reporte en browser
open coverage/index.html
```

**Expected Coverage**:
- **Statements**: 95%+
- **Branches**: 90%+
- **Functions**: 95%+
- **Lines**: 95%+

---

## 🐛 Debugging

```bash
# Ejecutar con logs detallados
DEBUG=* npx hardhat test

# Hardhat console
npx hardhat console --network amoy

# Verificar balance
npx hardhat run scripts/check-balance.js --network amoy

# Verificar deployment
npx hardhat run scripts/verify-deployment.js --network amoy
```

---

## 📊 Gas Profiling

```bash
# Generar reporte de gas
REPORT_GAS=true npx hardhat test

# Configurar en hardhat.config.js
gasReporter: {
  enabled: true,
  currency: 'USD',
  coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  token: 'MATIC'
}
```

---

## 🔐 Security Checks

```bash
# Slither (static analysis)
pip install slither-analyzer
slither contracts/NFTRental.sol
slither contracts/NFTOffers.sol

# Mythril (symbolic execution)
pip install mythril
myth analyze contracts/NFTRental.sol
myth analyze contracts/NFTOffers.sol

# Echidna (fuzzing)
docker pull trailofbits/eth-security-toolbox
echidna-test contracts/NFTRental.sol
```

---

## 📈 Monitoring

```bash
# Backend health check
curl http://localhost:3000/health

# Database connection check
psql -U bezhas -d bezhas_db -c "SELECT NOW();"

# Redis health check
redis-cli ping

# Gas price monitoring
curl https://gasstation-mainnet.matic.network/v2
```

---

## 🚀 CI/CD Pipeline (Recomendado)

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx hardhat test
      - run: npx hardhat coverage
```

---

## 📞 Comandos de Emergencia

```bash
# Pausar contrato (si Pausable implementado)
npx hardhat run scripts/emergency-pause.js --network polygon

# Despausar contrato
npx hardhat run scripts/emergency-unpause.js --network polygon

# Transfer ownership a multisig
npx hardhat run scripts/transfer-ownership.js --network polygon

# Actualizar fee en emergencia
npx hardhat run scripts/update-fee.js --network polygon
```

---

## 📚 Documentación Completa

1. **Análisis**: [INDUSTRIAL_CONTRACTS_ANALYSIS.md](./INDUSTRIAL_CONTRACTS_ANALYSIS.md)
2. **Deployment**: [INDUSTRIAL_CONTRACTS_DEPLOYMENT_GUIDE.md](./INDUSTRIAL_CONTRACTS_DEPLOYMENT_GUIDE.md)
3. **Database**: [POSTGRESQL_REDIS_MIGRATION.md](./POSTGRESQL_REDIS_MIGRATION.md)
4. **Security**: [SECURITY_AUDIT_PREPARATION.md](./SECURITY_AUDIT_PREPARATION.md)
5. **Summary**: [IMPLEMENTATION_COMPLETE_SUMMARY.md](./IMPLEMENTATION_COMPLETE_SUMMARY.md)

---

## ✅ Workflow Recomendado

### 1. Development
```bash
# 1. Escribir tests
vim test/NewFeature.test.js

# 2. Ejecutar tests
npx hardhat test test/NewFeature.test.js

# 3. Verificar coverage
npx hardhat coverage

# 4. Commit
git add .
git commit -m "feat: new feature with tests"
git push
```

### 2. Deployment a Testnet
```bash
# 1. Verificar tests
npx hardhat test

# 2. Deploy
npx hardhat run scripts/deploy-new-feature.js --network amoy

# 3. Verificar
npx hardhat verify --network amoy <ADDRESS> <ARGS>

# 4. Testing manual
# Interactuar con contrato en Amoy
```

### 3. Deployment a Mainnet
```bash
# ⚠️ SOLO DESPUÉS DE AUDITORÍA

# 1. Auditoría completada
# 2. Fixes implementados
# 3. Re-testing
npx hardhat test

# 4. Deploy con multisig
npx hardhat run scripts/deploy-new-feature.js --network polygon

# 5. Verificar
npx hardhat verify --network polygon <ADDRESS> <ARGS>

# 6. Transfer ownership a multisig
npx hardhat run scripts/transfer-ownership.js --network polygon

# 7. Monitor
# Verificar eventos y transacciones en PolygonScan
```

---

## 🎓 Tips & Best Practices

### Testing
- ✅ Siempre escribir tests ANTES de código
- ✅ Cubrir edge cases (0, MAX_UINT, etc.)
- ✅ Usar time manipulation para tests temporales
- ✅ Verificar eventos emitidos
- ✅ Test gas consumption

### Deployment
- ✅ Usar multisig para ownership
- ✅ Timelock para cambios críticos
- ✅ Emergency pause implementado
- ✅ Verificar contratos en explorer
- ✅ Documentar addresses en config

### Security
- ✅ Auditoría profesional obligatoria
- ✅ Bug bounty program activo
- ✅ Monitoring 24/7
- ✅ Incident response plan
- ✅ Regular security reviews

### Performance
- ✅ Usar PostgreSQL indexes
- ✅ Redis cache para queries frecuentes
- ✅ Batch operations cuando posible
- ✅ Optimize gas consumption
- ✅ Monitor slow queries

---

**Última Actualización**: Diciembre 2024  
**Mantenido por**: BeZhas Development Team  
**Soporte**: [GitHub Issues](https://github.com/bezhas/bezhas-web3/issues)
