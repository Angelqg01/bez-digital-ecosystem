# Primeros Pasos

> Sigue esta guía para comenzar a desarrollar sobre BeZhas Blockchain.

## Requisitos Previos
- Node.js >= 20.x
- pnpm >= 11
- Docker Desktop para servicios locales
- Foundry (`forge`, `anvil`, `cast`) para contratos y RPC local
- Wallet compatible con EVM (Metamask, Rabby, etc.)
- Acceso a la red de pruebas BeZhas Testnet

## Obtención de Credenciales
Solicita acceso de desarrollador en el canal oficial de Discord o mediante el formulario en el portal. Recibirás un API Key y acceso a la testnet.

## Instalación del SDK
```bash
pnpm add @bezhas/sdk
```

Guia completa: [API, SDK, Nodos y RPC](api-sdk-nodos-rpc.md).

## Ejemplo de Integración Básica
```js
import { BeZhasClient } from '@bezhas/sdk';

const client = new BeZhasClient({ apiKey: 'TU_API_KEY', network: 'testnet' });

// Consultar saldo de BEZCoin
const balance = await client.tokens.getBalance('0xTuWallet');
console.log('Saldo:', balance);
```

> Nunca expongas tu API Key ni claves privadas en código público.
