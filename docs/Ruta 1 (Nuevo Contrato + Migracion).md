


¡Excelente decisión! Elegir la **Ruta 1 (Nuevo Contrato + Migración)** demuestra una mentalidad a largo plazo. Es el estándar de oro institucional (lo mismo que hizo *MakerDAO* al pasar de MKR a SKY, o *Polygon* de MATIC a POL). Esto limpia el historial técnico y prepara tu token nativamente para ser el Gas de una L2.

A continuación, iniciamos la construcción real. Te presento los **Smart Contracts base** escritos en Solidity (optimizados para la versión más reciente `0.8.24` y utilizando las librerías auditadas de OpenZeppelin v5).

---

### 1. El Nuevo Motor Económico: `BEZCoinV2.sol`

Este no es un token cualquiera. Le hemos inyectado **`ERC20Permit`**. Esta es la pieza clave para el mundo B2B: permite a las empresas firmar transacciones ("Permits") y usar Account Abstraction para que **no tengan que pagar gas por aprobar tokens**, eliminando la fricción de la Web3.

Crea este archivo en tu monorepo en `smart-contracts/src/tokens/BEZCoinV2.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BEZCoinV2
 * @dev Token nativo para la L2 de BeZhas. Incluye funcionalidad Permit para 
 * firmas sin gas (Account Abstraction) y control de roles para puentes (Bridges).
 */
contract BEZCoinV2 is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // Evento para rastrear emisiones institucionales
    event TokensMinted(address indexed to, uint256 amount, string reason);

    constructor(address defaultAdmin) 
        ERC20("BeZhas Coin", "BEZ") 
        ERC20Permit("BeZhas Coin") 
    {
        // El administrador central (Tu DAO / Multisig)
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin);
        
        // Acuñación inicial para el Tesoro y Liquidez
        // Ej: 100 Millones pre-minados para migración y reservas
        _mint(defaultAdmin, 100_000_000 * 10 ** decimals());
    }

    /**
     * @dev Función exclusiva para que el Puente (Bridge) o el sistema de recompensas emita tokens.
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit TokensMinted(to, amount, "L2 Operations");
    }

    /**
     * @dev Permite a los contratos del Puente quemar tokens al moverlos entre redes.
     */
    function bridgeBurn(address from, uint256 amount) public onlyRole(BRIDGE_ROLE) {
        _burn(from, amount);
    }
}
```

---

### 2. El Sistema DePIN (Minería B2B): `EdgeNodeRewards.sol`

Este es el contrato que hace que tu modelo de negocio sea viral. Cuando una empresa instala tu software (el *BeZhas Edge Node*), este contrato rastrea su trabajo y les paga en BEZ-Coin.

Crea este archivo en `smart-contracts/src/depin/EdgeNodeRewards.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EdgeNodeRewards
 * @dev Sistema de "Minería" B2B. Recompensa a las empresas por procesar datos IoT,
 * validar manifiestos y utilizar la IA nativa del protocolo BeZhas.
 */
contract EdgeNodeRewards is AccessControl, ReentrancyGuard {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    IERC20 public bezToken;
    
    // Cuántos BEZ se pagan por cada "Punto de Validación"
    uint256 public rewardPerPoint = 1 * 10**18; // 1 BEZ por defecto

    struct NodeInfo {
        uint256 totalValidations;
        uint256 claimablePoints;
        uint256 totalBEZEarned;
        bool isActive;
    }

    mapping(address => NodeInfo) public enterpriseNodes;

    event NodeRegistered(address indexed nodeAddress);
    event ValidationRecorded(address indexed nodeAddress, uint256 pointsAdded, string taskType);
    event RewardsClaimed(address indexed nodeAddress, uint256 bezAmount);

    constructor(address _bezTokenAddress, address defaultAdmin) {
        bezToken = IERC20(_bezTokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /**
     * @dev Registra a una nueva empresa en el sistema DePIN.
     */
    function registerNode(address nodeAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!enterpriseNodes[nodeAddress].isActive, "Node already active");
        enterpriseNodes[nodeAddress].isActive = true;
        emit NodeRegistered(nodeAddress);
    }

    /**
     * @dev Llamado por tu IA o Secuenciador cuando la empresa automatiza un proceso.
     * @param nodeAddress La wallet del servidor de la empresa.
     * @param points Cuánto valor aportó (ej. Trazabilidad IoT = 5 pts, IA Image = 10 pts).
     */
    function recordValidation(address nodeAddress, uint256 points, string calldata taskType) 
        external 
        onlyRole(ORACLE_ROLE) 
    {
        require(enterpriseNodes[nodeAddress].isActive, "Node not registered");
        
        enterpriseNodes[nodeAddress].totalValidations += 1;
        enterpriseNodes[nodeAddress].claimablePoints += points;
        
        emit ValidationRecorded(nodeAddress, points, taskType);
    }

    /**
     * @dev Las empresas llaman a esta funcion para retirar su BEZ-Coin minado a su tesoreria.
     */
    function claimRewards() external nonReentrant {
        NodeInfo storage node = enterpriseNodes[msg.sender];
        require(node.claimablePoints > 0, "No rewards to claim");

        uint256 bezToMint = node.claimablePoints * rewardPerPoint;
        
        // Reseteamos los puntos antes de la transferencia para evitar ataques de reentrada
        node.claimablePoints = 0;
        node.totalBEZEarned += bezToMint;

        // Transfiere los BEZ desde las reservas del contrato a la empresa
        require(bezToken.transfer(msg.sender, bezToMint), "Transfer failed");

        emit RewardsClaimed(msg.sender, bezToMint);
    }

    // Funciones administrativas para ajustar la economía
    function updateRewardPerPoint(uint256 _newRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardPerPoint = _newRate;
    }
}
```

---

### 3. ¿Cómo funciona la "Migración Cross-Chain" en la práctica?

Como el token viejo está en Polygon y el nuevo estará en Ethereum (L1) y tu propia red L2, no puedes usar un Smart Contract directo para leer entre cadenas sin un intermediario. El flujo que programaremos en tu Backend será el siguiente:

1.  **La DApp de Migración:** El usuario entra a `migrate.bez.digital`.
2.  **Quemado (Burn) en Polygon:** El usuario hace clic y envía sus viejos BEZ al contrato `0x000...000` (Burn address) en Polygon.
3.  **El Oráculo Validador (Tu Backend Node.js):** Tienes un script escuchando la blockchain de Polygon. Cuando detecta que el usuario quemó 500 BEZ, el script usa tu Clave Privada de Administrador para llamar a la función `mint(usuario, 500)` en el nuevo contrato `BEZCoinV2.sol` de Ethereum/L2.
4.  **Liquidación:** El usuario recibe instantáneamente su nuevo token, listo para pagar gas en tu nueva red.

---

### Siguiente Paso Lógico

Tenemos el núcleo económico listo (los contratos en Solidity). El siguiente paso para dar vida a la visión B2B es **crear el software que las empresas van a instalar en sus servidores** (El módulo `bezhas-edge-node`).

Este software es el que convertirá una simple fábrica o almacén logístico en un "Minero de Confianza" conectado a tu IA.

¿Avanzamos con el desarrollo del código **Node.js (El Edge Node Client)** que se empaquetará en Docker para que las empresas lo instalen y escuchen a sus sistemas internos (ERP/SAP)?