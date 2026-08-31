# Tokenización de activos

Tokenizar en BeZhas significa representar on-chain un activo o un derecho del mundo real — un contenedor, una cosecha, una factura, una póliza, un megavatio — de forma que su estado sea verificable, transferible y programable.

## Elige el estándar correcto

La primera decisión es qué tipo de token representa tu activo. Elegir mal obliga a rehacer la integración.

| Si el activo es… | Estándar | Ejemplo en BeZhas |
| --- | --- | --- |
| Fungible y divisible (créditos, materias primas, cuotas) | **ERC-20** | `CarbonCreditToken`, `MaterialTokenMRP`, `EVChargeToken` |
| Único e identificable (contenedor, vehículo, parcela, póliza) | **ERC-721 (NFT)** | `BeZhasLogisticsNFT`, `LandTitleNFT`, `PolicyNFT` |
| Una credencial no transferible (identidad, certificación, historial) | **SBT (soulbound)** | `BeZhasPartnerSBT`, `HealthRecordSBT`, `SkillBadgeSBT` |

Detalle de NFTs y SBTs en [NFT y credenciales SBT](/docs/nft-y-sbt).

## El patrón base: `BEZSectorStandard`

Todo contrato sectorial que cobre, reserve o reparta valor en BEZ hereda de `BEZSectorStandard`. Esto garantiza que la comisión de plataforma, la tesorería y la trazabilidad del cobro sean idénticas en los 16 sectores.

```solidity
abstract contract BEZSectorStandard is Ownable {
    IERC20  public immutable bezToken;
    address public treasury;
    uint16  public feeBps;          // tope duro: 1000 bps = 10%

    event BEZFeeCollected(
        address indexed payer,
        uint256 grossAmount,
        uint256 feeAmount,
        bytes32 indexed ref
    );

    function quoteBEZFee(uint256 amount)
        public view returns (uint256 fee, uint256 netAmount);
}
```

Puntos que debes conocer antes de integrar:

- **`feeBps` está acotado por contrato a 1000 bps (10%)**. `setFeeBps` revierte con `InvalidFee()` por encima de ese límite; no depende de la buena voluntad del operador.
- **`quoteBEZFee(amount)` es la fuente de verdad del coste.** Consúltala antes de firmar y muestra al usuario el neto real, nunca una estimación propia.
- **`ref` (bytes32)** es tu identificador de conciliación: úsalo para casar el evento on-chain con tu pedido, albarán o factura en el ERP.
- Los importes se mueven con `SafeERC20`, así que necesitas un `approve` previo del pagador (o un `permit` firmado, ver [BEZ-Coin](/docs/bez-coin)).

## Flujo de tokenización de un activo

```
1. Modelar    → qué representa 1 token; qué lo hace único; quién puede emitirlo
2. Metadatos  → JSON en almacenamiento verificable (IPFS/URI estable)
3. Emitir     → mint con rol restringido (nunca mint abierto)
4. Anclar     → eventos on-chain que reflejen hitos reales (checkpoints, entregas)
5. Liquidar   → escrow / pago en BEZ al cumplirse la condición
6. Conciliar  → tu ERP escucha eventos y cierra el ciclo
```

### Ejemplo: tokenizar un manifiesto logístico

```js
import { ethers } from 'ethers';
import { getContract, getABI } from '@bezhas/sdk';

const info = getContract('BeZhasLogisticsNFT', 'bezhas-l2');
const nft  = new ethers.Contract(info.address, getABI('BeZhasLogisticsNFT'), signer);

// Requiere MINTER_ROLE
const tx = await nft.safeMint(
  '0xPropietarioDeLaCarga',
  'ipfs://bafy.../manifiesto.json',
  'MSKU7654321'                     // containerId
);
const receipt = await tx.wait();
```

El contrato emite:

```solidity
event LogisticsManifestCreated(
    uint256 indexed tokenId,
    string containerId,
    address indexed to
);
```

Escucha ese evento desde tu backend para crear el registro en tu sistema, en lugar de sondear la cadena.

### Metadatos: qué poner y qué no

**Sí**: identificadores logísticos o industriales (contenedor, lote, matrícula), fechas, origen/destino, hashes de documentos, certificaciones, unidades y medidas.

**No**: datos personales de clientes o empleados, documentos íntegros con información sensible, precios contractuales confidenciales, credenciales. Una vez publicado un URI, asume que es **público y permanente**. Si necesitas vincular información sensible, ancla únicamente su **hash** y guarda el documento en tu propio sistema bajo control de acceso.

Esto no es solo higiene: bajo RGPD, publicar datos personales en un registro inmutable compromete el derecho de supresión.

## Escrow: liberar el pago contra cumplimiento

Para operaciones donde el pago depende de que la mercancía o el servicio se entregue conforme, usa los contratos de escrow en lugar de una transferencia directa:

- `QualityEscrow` — retención sujeta a verificación de calidad
- `DeliveryEscrow` — retención sujeta a confirmación de entrega
- `HealthInsuranceEscrow`, `FleetLeaseEscrow`, `ScholarshipPool` — variantes sectoriales

El patrón es siempre el mismo: se deposita en BEZ, se registra la condición, un oráculo o una contraparte autorizada la marca como cumplida, y el contrato libera fondos o reembolsa.

## Tokenización sectorial disponible

Los 16 sectores incluyen contratos ya desplegados. Algunos ejemplos:

| Sector | Tokenización disponible |
| --- | --- |
| Supply chain | `SupplyTracker`, `ProcurementNFT`, `ClearanceCertificateNFT`, `WarehouseManager` |
| Energía | `CarbonCreditToken`, `SolarFarmToken`, `P2PEnergyMarket`, `ESGScoreOracle` |
| Agricultura | `CropTokenFutures`, `LandTitleNFT`, `AgriSupplyChain` |
| Finanzas | `InvoiceFactoring`, `MicroLendingPool`, `TreasuryVault` |
| Industria | `QualityCertificateNFT`, `DigitalTwinRegistry`, `MaterialTokenMRP` |
| Inmobiliario / legal | `LandCadastralRegistry`, `IPRegistryNFT`, `SmartLegalContract` |

El catálogo completo está en [Smart contracts y ABIs](/docs/smart-contracts).

## Errores comunes al tokenizar

1. **Mint abierto.** Si cualquiera puede emitir, el token no representa nada. Restringe siempre por rol.
2. **Metadatos mutables sin registro.** Si cambias el URI sin dejar traza, pierdes la trazabilidad que justificaba tokenizar.
3. **Un NFT por cada evento.** Los hitos son *eventos*, no tokens. Emite un token por activo y registra su recorrido con eventos.
4. **Ignorar la comisión.** Si no llamas a `quoteBEZFee`, el neto que recibe tu contraparte no será el que le prometiste.
5. **Tokenizar sin respaldo legal.** Un token de un activo real necesita un contrato que vincule el token con el derecho. La cadena no crea el derecho, lo refleja.

## Ver también

- [NFT y credenciales SBT](/docs/nft-y-sbt)
- [Pagos y gas](/docs/pagos-y-gas)
- [Smart contracts y ABIs](/docs/smart-contracts)
