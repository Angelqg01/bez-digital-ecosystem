# NFT y credenciales SBT

En BeZhas los NFT no son coleccionables: son **el registro de propiedad y trazabilidad de activos industriales**. Un NFT representa un contenedor, un vehículo, una parcela, una póliza o un certificado de calidad — algo que existe fuera de la cadena y necesita una identidad verificable dentro de ella.

## NFT (ERC-721) vs SBT (soulbound)

| | NFT (ERC-721) | SBT (soulbound) |
| --- | --- | --- |
| Transferible | Sí | **No** |
| Representa | Un activo o derecho | Una identidad o credencial |
| Se vende / cede | Sí | Nunca |
| Ejemplos | `BeZhasLogisticsNFT`, `VehicleIdentityNFT`, `PolicyNFT` | `BeZhasPartnerSBT`, `HealthRecordSBT`, `SkillBadgeSBT` |

La regla práctica: **si el activo puede cambiar de dueño, es NFT; si acredita quién eres o qué has logrado, es SBT.**

## Cómo funciona un SBT en BeZhas

`BeZhasPartnerSBT` es un ERC-721 que bloquea la transferencia sobrescribiendo `_update`: solo permite el *mint* inicial (desde la dirección cero) y, en su caso, el *burn*. Cualquier intento de transferencia entre carteras revierte.

```solidity
function _update(address to, uint256 tokenId, address auth)
    internal virtual override returns (address)
{
    // Solo mint (from == address(0)) o burn. Transferencias bloqueadas.
    ...
}
```

Consecuencia para tu integración: **no construyas UI de "enviar" para un SBT**. Si un partner cambia de wallet, el flujo correcto es revocar y reemitir, no transferir.

## Emitir un NFT

```js
import { ethers } from 'ethers';
import { getContract, getABI } from '@bezhas/sdk';

const info = getContract('BeZhasLogisticsNFT', 'bezhas-l2');
const nft  = new ethers.Contract(info.address, getABI('BeZhasLogisticsNFT'), signer);

const tx = await nft.safeMint(
  destinatario,                       // address to
  'ipfs://bafy.../manifiesto.json',   // string uri
  'MSKU7654321'                       // string containerId
);
await tx.wait();
```

`safeMint` requiere `MINTER_ROLE`. El contrato implementa `ERC721URIStorage`, así que cada token guarda su propio URI de metadatos, y `AccessControl` para la gestión de permisos.

### Evento a escuchar

```solidity
event LogisticsManifestCreated(
    uint256 indexed tokenId,
    string containerId,
    address indexed to
);
```

```js
nft.on('LogisticsManifestCreated', (tokenId, containerId, to) => {
  // sincroniza con tu ERP/WMS
});
```

## Estructura recomendada de metadatos

```json
{
  "name": "Manifiesto MSKU7654321",
  "description": "Contenedor 40HC — Algeciras → Rotterdam",
  "image": "ipfs://bafy.../sello.png",
  "attributes": [
    { "trait_type": "Contenedor",   "value": "MSKU7654321" },
    { "trait_type": "Tipo",         "value": "40HC" },
    { "trait_type": "Origen",       "value": "ESALG" },
    { "trait_type": "Destino",      "value": "NLRTM" },
    { "trait_type": "Precinto",     "value": "SL-889231" },
    { "trait_type": "DocHash",      "value": "0x9f2c…" }
  ]
}
```

Compatible con el estándar de metadatos ERC-721, así que exploradores y wallets lo interpretan sin trabajo extra.

> **Nunca** incluyas datos personales, documentos completos ni precios confidenciales en los metadatos. Ancla el **hash** del documento (`DocHash`) y conserva el original en tu sistema con control de acceso. Lo publicado en un URI es público y permanente.

## Catálogo de NFT y SBT por sector

| Sector | Contrato | Representa |
| --- | --- | --- |
| Logística | `BeZhasLogisticsNFT` | Manifiesto / contenedor |
| Supply chain | `ProcurementNFT` | Orden de compra |
| Supply chain | `ClearanceCertificateNFT` | Despacho aduanero |
| Automoción | `VehicleIdentityNFT` | Identidad del vehículo |
| Industria | `QualityCertificateNFT` | Certificado de calidad |
| Agricultura | `LandTitleNFT` | Título de parcela |
| Seguros | `PolicyNFT` | Póliza |
| Legal | `IPRegistryNFT` | Propiedad intelectual |
| Servicios | `ServiceReputationNFT` | Reputación de proveedor |
| Educación | `CourseTokenNFT` | Matrícula / curso |
| Entretenimiento | `EventTicketNFT` | Entrada de evento |
| Gobierno | `CitizenIdentityNFT` | Identidad ciudadana |
| Ecosistema | `BeZhasPartnerSBT` *(SBT)* | Partner verificado |
| Salud | `HealthRecordSBT` *(SBT)* | Historial clínico |
| Educación | `SkillBadgeSBT` *(SBT)* | Competencia acreditada |

Direcciones y ABIs: SDK o `GET /api/gateway/v1/contracts/addresses`.

## Buenas prácticas

1. **Un token = un activo.** Los hitos del ciclo de vida son eventos, no tokens nuevos.
2. **Mint siempre restringido por rol.** Un `MINTER_ROLE` custodiado por multi-firma o por el backend corporativo, nunca abierto.
3. **URI estable y verificable.** IPFS o un endpoint inmutable con hash. Un URI que apunta a un servidor mutable destruye la trazabilidad.
4. **Usa `safeMint`, no `mint` crudo**, para que los contratos destinatarios que no soportan ERC-721 no bloqueen el token.
5. **Consulta `supportsInterface`** antes de asumir capacidades: estos contratos combinan ERC-721, `URIStorage` y `AccessControl`.
6. **Quema con criterio.** Un activo que deja de existir (contenedor desguazado, póliza vencida) puede quemarse; uno que solo cambia de estado, no.

## Ver también

- [Tokenización de activos](/docs/tokenizacion-activos)
- [Smart contracts y ABIs](/docs/smart-contracts)
