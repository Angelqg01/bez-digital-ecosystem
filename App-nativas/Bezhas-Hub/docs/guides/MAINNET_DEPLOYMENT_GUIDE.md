# Guía de Despliegue en Polygon Mainnet

## ⚠️ ADVERTENCIA: RED DE PRODUCCIÓN
Este contrato está desplegado en **Polygon Mainnet** (ChainID 137), no en testnet. Todas las transacciones requieren **MATIC real** y son **irreversibles**.

## Información del Contrato BEZ-Coin

- **Dirección**: `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8`
- **Red**: Polygon Mainnet (ChainID 137)
- **Token**: BEZ-Coin (BEZ)
- **Standard**: ERC20Pausable + AccessControl
- **Creator/Owner**: `0x52Df82920CBAE522880dD7657e43d1A754eD044E`
- **Deployed**: 41 días atrás (Diciembre 2025)
- **Explorer**: https://polygonscan.com/address/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8

## Verificación de Balance

Antes de desplegar contratos en mainnet, verifica el balance de MATIC:

```bash
# PowerShell
$hotWallet = "0x52Df82920CBAE522880dD7657e43d1A754eD044E"
$response = Invoke-RestMethod -Method Post -Uri "https://polygon-rpc.com" `
  -ContentType "application/json" `
  -Body (@{jsonrpc="2.0";method="eth_getBalance";params=@($hotWallet,"latest");id=1} | ConvertTo-Json)
$balanceWei = $response.result
$balanceEth = [decimal]::Parse([bigint]::Parse($balanceWei.TrimStart('0x'), 'AllowHexSpecifier').ToString()) / 1e18
Write-Host "Balance: $balanceEth MATIC"
```

## Configuración de RPC

### Polygon Mainnet RPC URLs (públicos gratuitos):
- `https://polygon-rpc.com`
- `https://1rpc.io/matic`
- `https://rpc-mainnet.matic.network`

### Para producción (recomendado):
- Alchemy: `https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY`
- Infura: `https://polygon-mainnet.infura.io/v3/YOUR_KEY`
- QuickNode: `https://YOUR_ENDPOINT.matic.quiknode.pro/YOUR_KEY/`

## Costos de Despliegue Estimados

| Contrato | Gas Estimado | Costo (MATIC) @ 50 Gwei |
|----------|--------------|-------------------------|
| QualityEscrow | ~2,000,000 | ~0.1 MATIC |
| Marketplace | ~2,500,000 | ~0.125 MATIC |
| Staking Pool | ~2,000,000 | ~0.1 MATIC |
| DAO Governance | ~3,000,000 | ~0.15 MATIC |
| NFT Offers | ~1,500,000 | ~0.075 MATIC |
| NFT Rental | ~1,500,000 | ~0.075 MATIC |
| Liquidity Farming | ~2,500,000 | ~0.125 MATIC |
| **TOTAL** | **~15,000,000** | **~0.75 MATIC** |

## Servicios a Desplegar

### Fase 1: Core DeFi (Prioridad Alta)
1. **Quality Oracle & Escrow**
   ```bash
   npx hardhat run scripts/deploy-quality-oracle.js --network polygon
   ```

2. **Staking Pool**
   ```bash
   npx hardhat run scripts/deploy-staking.js --network polygon
   ```

### Fase 2: Marketplace & DAO (Prioridad Media)
3. **Marketplace NFT**
   ```bash
   npx hardhat run scripts/deploy-marketplace-polygon.js --network polygon
   ```

4. **DAO Governance**
   ```bash
   npx hardhat run scripts/deploy-dao.js --network polygon
   ```

### Fase 3: NFT Features (Prioridad Media)
5. **NFT Offers**
   ```bash
   npx hardhat run scripts/deploy-nft-offers.js --network polygon
   ```

6. **NFT Rental**
   ```bash
   npx hardhat run scripts/deploy-nft-rental.js --network polygon
   ```

### Fase 4: Liquidity (Prioridad Baja)
7. **Liquidity Farming**
   ```bash
   npx hardhat run scripts/deploy-liquidity-farming.js --network polygon
   ```

## Servicios Backend (No requieren despliegue blockchain)

### Fase 5: Backend Services
8. **Watch-to-Earn**
   - Backend: `backend/services/watch-to-earn.service.js`
   - Endpoints: `/api/watch-to-earn/*`
   - Implementación: Servicio Node.js que recompensa por visualización

9. **RWA Tokenization**
   - Backend: `backend/services/rwa-tokenization.service.js`
   - Integración: Con contrato BEZ-Coin existente
   - Implementación: Servicio de tokenización de activos reales

10. **Cross-Chain Bridge**
    - Backend: `backend/services/bridge.service.js`
    - Protocolo: LayerZero o Wormhole
    - Implementación: Servicio de puente entre chains

## Checklist Pre-Despliegue

- [ ] Hot Wallet tiene suficiente MATIC (mínimo 1 MATIC)
- [ ] Variables de entorno configuradas para mainnet
- [ ] RPC URLs actualizados a Polygon mainnet
- [ ] Scripts de despliegue revisados y probados en testnet
- [ ] Contratos compilados sin errores
- [ ] Backup de private keys en lugar seguro
- [ ] Plan de rollback definido
- [ ] Monitoreo configurado (opcional)

## Verificación Post-Despliegue

Después de desplegar cada contrato:

```bash
# Verificar en PolygonScan
npx hardhat verify --network polygon <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

Actualizar direcciones en:
- `backend/.env` → Variables de contrato
- `frontend/.env` → Variables VITE_*
- `ESTADO_IMPLEMENTACION_SERVICIOS.md` → Direcciones deployadas

## Comandos de Emergencia

### Pausar BEZ-Coin (Solo owner)
```javascript
const bezCoin = await ethers.getContractAt("BEZCoin", "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8");
await bezCoin.pause();
```

### Reanudar BEZ-Coin (Solo owner)
```javascript
await bezCoin.unpause();
```

### Transferir Ownership (⚠️ IRREVERSIBLE)
```javascript
await bezCoin.transferOwnership("NEW_OWNER_ADDRESS");
```

## Soporte y Recursos

- **PolygonScan**: https://polygonscan.com/
- **Polygon Docs**: https://wiki.polygon.technology/
- **Gas Tracker**: https://polygonscan.com/gastracker
- **Faucet**: No disponible (mainnet = MATIC real)

## Troubleshooting

### Error: "insufficient funds for gas"
Solución: Comprar más MATIC y enviar a Hot Wallet

### Error: "nonce too low"
Solución: 
```bash
npx hardhat clean
rm -rf cache/ artifacts/
```

### Error: "replacement transaction underpriced"
Solución: Esperar a que la transacción anterior se confirme o aumentar gas price

---

**Última actualización**: Enero 2026
**Mantenedor**: BeZhas DevOps Team
