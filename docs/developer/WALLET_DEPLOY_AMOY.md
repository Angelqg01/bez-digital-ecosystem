# Despliegue de los contratos de wallet en Polygon Amoy (pruebas)

> **Estado (2026-10-26):** preparado y simulado, **no desplegado**. En Polygon (137) tampoco están: sus 6 direcciones no tienen código,
> y por eso `/api/wallet/*` responde 503 `CONTRACT_NOT_DEPLOYED`. Amoy va primero; mainnet solo con confirmación expresa.

## Qué se despliega
`smart-contracts/script/DeployWallet.s.sol`: `SmartWalletFactory`, `Paymaster`, `WalletGuardian`, `SecurityModule`, `MultiSigWallet`,
`IdentityRegistry`, y en Amoy un `BEZCoinV2` **de prueba** (BEZ real solo existe en Polygon; el Paymaster necesita un token).

Simulación sobre un fork de Amoy: **~15,7 M de gas, ~0,47 POL a 30 gwei**. La del fork de Polygon: ~12,7 M de gas, ~7,1 POL (sin el token de prueba).

## Qué clave usar
Una clave **nueva, solo de pruebas**, con POL de grifo:

```bash
cast wallet new          # apunta la dirección; la clave privada guárdala solo en tu gestor de contraseñas
```

1. Pide ~1 POL de Amoy para esa dirección en <https://faucet.polygon.technology> (red *Polygon Amoy*).
2. Expórtala **solo en tu terminal** (no en un `.env` del repo, no en un chat):
   `export DEPLOYER_PRIVATE_KEY=0x…`

**No uses** la Hot Wallet (`0x52Df…044E`), la Treasury DAO (`0x89c2…9b12`), la firmante del paymaster del KMS (`0x80b8…5c7C`) ni la
clave pública de Anvil (`0xf39F…2266`): el script las rechaza. Tampoco una clave con fondos reales en otra red.

## Pasos
```bash
scripts/deploy-wallet-amoy.sh              # comprueba red y saldo y SIMULA; no envía nada
scripts/deploy-wallet-amoy.sh --broadcast  # envía, tras escribir «DESPLEGAR EN AMOY»
```
Opcionales antes de `--broadcast`: `WALLET_ADMIN`, `GUARDIANS=0xA,0xB,0xC`, `MULTISIG_SIGNERS=0xA,0xB,0xC`, `TIMELOCK_DELAY`.
Sin `MULTISIG_SIGNERS` el multisig lleva a un firmante de prueba conocido públicamente: válido para probar, nunca para fondos.

## Después
1. Copiar las direcciones impresas a `smart-contracts/deployments/80002.json` (sección `"wallet"`, y `core.BEZCoinV2` del token de prueba).
   A mano: CLAUDE.md prohíbe sobrescribir direcciones sin confirmación. Después `node sync-daemon.js --once`.
2. En la API de pruebas: `BEZHAS_CHAIN_ID=80002`, `ALLOWED_CHAIN_IDS=80002` y `RPC_URLS_80002=https://polygon-amoy-bor-rpc.publicnode.com`.
3. Comprobar `GET /api/wallet/portfolio` y `/api/wallet/security/status` (deben dejar de dar 503) y crear una SmartWallet desde wallet.bezhas.com.

## Mainnet (137): fuera de este alcance
Mismo script, sin `BEZ_TOKEN` (usa el BEZ real). Antes hay que decidir: dueño/admin (multisig, no una EOA), 3 o más guardianes, 2 o más
firmantes reales del multisig, y desde qué cuenta se paga el gas (la Hot Wallet tiene ~33,9 POL; la simulación pide ~7,1). Requiere la
confirmación explícita del responsable y una clave que no esté en un ordenador de desarrollo (KMS).

## Aviso: el RPC oficial de Amoy ya no resuelve
`https://rpc-amoy.polygon.technology` no tiene DNS. Se sustituyó en el código por `https://polygon-amoy-bor-rpc.publicnode.com`
(el de Ankr exige API key). Los documentos `.md` antiguos del Hub siguen citando el viejo.
