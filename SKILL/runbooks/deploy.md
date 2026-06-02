# Runbook: Deploy Contracts
> Procedimiento para desplegar contratos en la red BeZhas

## Pre-requisitos
- Foundry instalado (`$USERPROFILE\.foundry\bin\forge.exe`)
- Nodo L2 corriendo (localhost:8545 o remoto)
- Balance de ETH en deployer wallet
- Variables de entorno configuradas

## Deploy Local (Development)

### 1. Compilar
```powershell
cd smart-contracts
& "$env:USERPROFILE\.foundry\bin\forge.exe" build
```

### 2. Deploy Core
```powershell
& "$env:USERPROFILE\.foundry\bin\forge.exe" script script/DeployCore.s.sol `
  --rpc-url http://localhost:8545 `
  --private-key $env:DEPLOYER_PRIVATE_KEY `
  --broadcast
```

### 3. Deploy Sectors
```powershell
& "$env:USERPROFILE\.foundry\bin\forge.exe" script script/DeploySectors.s.sol `
  --rpc-url http://localhost:8545 `
  --private-key $env:DEPLOYER_PRIVATE_KEY `
  --broadcast
```

### 4. Parse Addresses
```powershell
node script/parse-deployment.js
```

### 5. Migrate DB
```powershell
cd ../api
node db/migrate.js
node db/seed.js
```

## Deploy Testnet/Mainnet

### Checklist
- [ ] Todas las pruebas pasan (`forge test`)
- [ ] Auditoría completada
- [ ] MultiSig wallet creada para admin
- [ ] Timelock configurado
- [ ] Environment variables de producción
- [ ] Deploy-config.json actualizado

### Proceso
1. Compilar con optimizer: `forge build --optimize`
2. Deploy vía script con gas estimado
3. Verificar contratos en explorer
4. Transferir ownership a MultiSig
5. Configurar SecurityModule guardians
6. Activar circuit breakers
7. Registrar addresses en DB

## Verificar Deploy
```powershell
# Comprobar que BEZCoinV2 responde
cast call $BEZ_ADDRESS "totalSupply()" --rpc-url http://localhost:8545
# Comprobar SmartWalletFactory
cast call $FACTORY_ADDRESS "totalWallets()" --rpc-url http://localhost:8545
```

## Rollback
- Si un contrato falla: no desplegar dependientes
- Contratos son inmutables — se despliega nueva versión
- Actualizar DB con nueva dirección
- Invalidar cache Redis: `redis-cli FLUSHDB`
