# Smart Contracts & ABI

> Interfaz pública de los contratos inteligentes desplegados en BeZhas Blockchain.

## Contratos Públicos
- `BEZCoinV2.sol`: Token nativo BEZ (ERC-20)
- `BeZhasLogisticsNFT.sol`: NFT de activos logísticos
- `QualityEscrow.sol`: Escrow de calidad
- `GovernanceSystem.sol`: DAO de gobernanza

Consulta la lista completa en el repositorio smart-contracts/src/{sector}/

## Descarga de ABI
- [BEZCoinV2 ABI](../smart-contracts/abi/BEZCoinV2.json)
- [BeZhasLogisticsNFT ABI](../smart-contracts/abi/BeZhasLogisticsNFT.json)

> Solo se publican los ABI de interfaces públicas. El código fuente privado y scripts de despliegue no se exponen.

## Ejemplo de Interacción
```js
import { ethers } from 'ethers';
import BEZCoinV2 from './abi/BEZCoinV2.json';

const provider = new ethers.JsonRpcProvider('https://testnet.bezhas.io');
const contract = new ethers.Contract('0xCONTRACT_ADDRESS', BEZCoinV2, provider);
const totalSupply = await contract.totalSupply();
console.log('Total Supply:', totalSupply);
```

> Usa siempre direcciones de testnet y nunca claves privadas en ejemplos públicos.
