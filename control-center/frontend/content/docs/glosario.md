# Glosario

**ABI** — Descripción de la interfaz de un contrato. Necesaria para que tu código sepa cómo llamarlo. Obtenla del SDK o de `/contracts-abi/*`, nunca a mano.

**Account Abstraction** — Cuentas controladas por un contrato en lugar de por una clave. Permite guardianes, límites de gasto y recuperación. En BeZhas: `SmartWallet`.

**Basis point (bps)** — Una centésima de punto porcentual. 10 bps = 0,1%; 1000 bps = 10%. Las comisiones del protocolo se expresan así.

**BEZ / BEZ-Coin** — Token nativo. Gas de la L2, colateral de validación y peso de voto.

**Boost** — Multiplicador de recompensa según el tier del validador: de 1× (Bronze) a 2× (Platinum).

**Bridge** — Puente entre redes. Bloquea en origen y acuña o libera en destino; ninguna transacción cruza realmente de cadena.

**Chain ID** — Identificador de red. BeZhas L2 = `2708`, local = `31337`, Polygon = `137`, BNB Chain = `56`.

**DAO** — Organización autónoma descentralizada. En BeZhas, `GovernanceSystem` sobre OpenZeppelin Governor con timelock.

**DePIN** — *Decentralized Physical Infrastructure Network*. Red donde operadores aportan infraestructura física real y cobran por trabajo verificado. En BeZhas: `EdgeNodeRewards`.

**Edge Node** — Nodo ligero de validación que reporta trabajo verificado y cobra recompensas DePIN.

**Enterprise Node** — Pasarela privada al protocolo que una empresa despliega en su propio perímetro.

**ERC-20** — Estándar de token fungible.

**ERC-721** — Estándar de token no fungible (NFT): cada unidad es única e identificable.

**ERC20Permit (EIP-2612)** — Autorización firmada off-chain. Permite aprobar sin transacción y sin gas para el usuario.

**ERC20Votes** — Extensión que convierte el saldo en poder de voto delegable. Requiere `delegate()` explícito.

**Escrow** — Retención de fondos hasta que se cumple una condición verificable. En BeZhas: `QualityEscrow`, `DeliveryEscrow`.

**EVM** — Máquina virtual de Ethereum. La L2 es compatible, así que las herramientas Ethereum funcionan sin adaptación.

**Foundry** — Toolkit de desarrollo Solidity (`forge`, `anvil`, `cast`). Es el estándar del proyecto, no Hardhat.

**Gas token personalizado** — Configuración por la que la L2 cobra el gas en BEZ en lugar de ETH.

**Heartbeat** — Señal periódica con la que un validador prueba su disponibilidad.

**JWT** — Token de sesión. Se mantiene **en memoria**, nunca en disco ni en `localStorage`.

**L1 / L2** — Capa base de seguridad (Ethereum) y capa de ejecución sobre ella (BeZhas). La L2 ancla su estado en la L1.

**MCP** — *Model Context Protocol*. Protocolo de interoperabilidad entre agentes, contratos y servicios.

**Multi-firma** — Cuenta que exige varias firmas para operar. Obligatoria para operaciones institucionales.

**NFT** — Ver ERC-721. En BeZhas representa activos industriales, no coleccionables.

**OP Stack** — Marco de construcción de L2 optimistas sobre el que se levanta BeZhas.

**Oráculo** — Servicio autorizado que escribe en la cadena datos verificados del mundo real.

**Paymaster** — Contrato que patrocina el gas de otros, permitiendo operaciones sin coste para el usuario final.

**Quórum** — Participación mínima para que una votación sea válida. En BeZhas, 4% del supply con voto.

**RPC** — Punto de acceso JSON-RPC a la cadena.

**SBT (Soulbound Token)** — Token no transferible que acredita identidad, pertenencia o logro.

**Secuenciador** — Nodo que ordena las transacciones de la L2. Rota entre validadores elegibles.

**Slashing** — Penalización sobre el stake de un validador por incumplimiento o comportamiento malicioso.

**Staking** — Bloqueo de BEZ como colateral a cambio de recompensas y derechos de validación.

**Tier** — Nivel de validador según stake: Bronze, Silver, Gold, Platinum.

**Timelock** — Retardo obligatorio entre la aprobación de una propuesta y su ejecución. Última ventana para detectar un error.

**Tokenización** — Representar on-chain un activo o derecho del mundo real.

**Unbonding** — Periodo de espera (7 días en BeZhas) entre solicitar la retirada del stake y poder retirarlo.

**Uptime** — Porcentaje de disponibilidad de un nodo. Mínimo del 90% para mantenerse activo como validador.
