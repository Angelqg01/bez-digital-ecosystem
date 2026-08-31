# Preguntas frecuentes

## Empezar

**¿Necesito saber Solidity para integrar BeZhas?**
No. La mayoría de integraciones se hacen contra la API Core y el SDK desde tu backend. Solidity solo es necesario si vas a desplegar contratos propios.

**¿Dónde consigo una API key?**
Solicita acceso de desarrollador por los canales del portal. Recibirás credenciales y acceso a la red de pruebas.

**¿Cómo conecto mi wallet?**
Añade la red BeZhas L2 (`chainId 2708`) con `wallet_addEthereumChain`. Ver [RPC y endpoints](/docs/rpc-endpoints).

**¿Qué gestor de paquetes uso?**
**pnpm v11+**, estándar del proyecto. No mezcles `npm` ni `yarn`.

## Token

**¿Cuál es el supply de BEZ?**
Hard cap de 10.000 millones, con 3.000 millones pre-acuñados en el despliegue para tesorería y liquidez. El cap es una constante del contrato, no modificable.

**¿Por qué `totalSupply()` no baja cuando se queman tokens?**
Porque en `BEZCoinV2` las funciones de quema **no destruyen tokens**: los transfieren a `treasuryWallet`. Es deliberado. Si calculas supply circulante, resta el saldo de tesorería. Ver [BEZ-Coin](/docs/bez-coin).

**¿Se paga el gas en ETH?**
No. La L2 usa BEZ como gas token personalizado.

**¿Tengo voto por tener BEZ?**
No hasta que delegues. `ERC20Votes` exige `delegate()` explícito, incluso para votar tú mismo.

## Validadores y nodos

**¿Cuánto necesito para ser validador?**
Desde 10.000 BEZ (Bronze). Los tiers suben a 50.000 (Silver), 250.000 (Gold) y 1.000.000 (Platinum), con multiplicadores de 1× a 2×.

**¿Puedo retirar mi stake cuando quiera?**
Hay un periodo de unbonding de **7 días** entre `initiateUnbonding()` y `completeWithdraw()`. No hay atajo.

**¿Qué pasa si mi nodo se cae?**
Por debajo del 90% de uptime el validador se desactiva y deja de acumular recompensas. Puedes reactivarlo reponiendo stake si hubo slashing.

**¿Cuál es la diferencia entre Enterprise Node y Edge Node?**
El Enterprise Node es tu pasarela privada al protocolo; el Edge Node valida trabajo y cobra recompensas DePIN. Ver [Nodos](/docs/nodos-enterprise-edge).

## Tokenización y NFT

**¿NFT o token fungible?**
Si el activo es único e identificable (un contenedor, un vehículo), NFT. Si es divisible e intercambiable (créditos, materias primas), ERC-20. Si acredita identidad o una certificación, SBT no transferible.

**¿Puedo transferir un SBT?**
No. Es su razón de ser. Si un partner cambia de wallet, se revoca y se reemite.

**¿Puedo poner datos de clientes en los metadatos?**
No. Los metadatos son públicos y permanentes. Ancla el hash del documento y guarda el original en tu sistema. Publicar datos personales en un registro inmutable compromete el derecho de supresión del RGPD.

**¿Puedo desplegar mis propios contratos?**
En la red local y de pruebas, libremente. Para la red principal se requiere revisión previa.

## Integración

**Recibo un `401`.**
Comprueba que el JWT no ha caducado y que envías tanto `Authorization: Bearer` como `X-API-Key`. El SDK renueva el JWT automáticamente; si lo gestionas a mano, no.

**Recibo `OrderAlreadyProcessed`.**
Ese `orderId` ya se liquidó. Es la protección anti-duplicado funcionando. Consulta el pago con `getPayment(orderId)`.

**¿Por qué mi transacción revierte con un `approve` hecho?**
Probablemente aprobaste el neto en lugar del bruto. `processPayment` mueve el importe completo (neto + comisión) desde el pagador.

**¿Las direcciones de contrato son las mismas en todas las redes?**
No. Nunca las codifiques a mano: resuélvelas por SDK o por `GET /contracts/addresses`.

**¿Cómo sé si una operación se completó?**
Por su evento on-chain, no por el `txHash` que devolviste al enviar. Escucha eventos y concilia contra ellos.

## Soporte

Para dudas técnicas, canales de la comunidad. Para incidencias de seguridad, reporte privado — nunca en foros públicos. Ver [Comunidad y soporte](/docs/comunidad).
