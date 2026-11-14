// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// Lo que el reparto necesita del RWAFactory desplegado. El struct replica
/// `BeZhasRWAFactory.Asset` campo a campo: el ABI del getter depende del orden.
interface IRWAFactoryRent {
    struct Asset {
        string name;
        uint8 category;
        string legalDocumentCID;
        string imagesCID;
        uint256 totalSupply;
        uint256 valuationUSD;
        uint256 pricePerFraction;
        uint256 estimatedYield;
        address creator;
        string location;
        uint256 createdAt;
        bool isActive;
    }

    function getAsset(uint256 assetId) external view returns (Asset memory);
    function isVerified(uint256 assetId, address investor) external view returns (bool);
}

/**
 * @title RWARentDistributor
 * @notice Reparto de rentas (alquileres, cupones, dividendos) de un activo del
 *         RWAFactory a los titulares de sus fracciones, en cualquier ERC-20
 *         (BEZ o una stablecoin).
 *
 * @dev ⚠️ PENDIENTE DE AUDITORÍA Y DE DICTAMEN (MiFID II), igual que
 *      RWAPrimarySale: pagar rendimientos a titulares de fracciones refuerza
 *      que sean instrumentos financieros. No se despliega en red principal sin
 *      las dos cosas.
 *
 *      Por qué un árbol de Merkle: el RWAFactory ya está desplegado y no tiene
 *      ni snapshots ni un gancho en las transferencias, así que un contrato no
 *      puede saber quién tenía cuántas fracciones en una fecha. El emisor fija
 *      un bloque de corte, calcula fuera de la cadena el saldo de cada titular
 *      en ese bloque (es reproducible por cualquiera a partir de los eventos
 *      TransferSingle/TransferBatch) y publica la raíz. Cada titular reclama lo
 *      suyo con su prueba.
 *
 *      Hoja = keccak256(bytes.concat(keccak256(abi.encode(cuenta, importe)))),
 *      el formato de StandardMerkleTree de OpenZeppelin con ["address","uint256"].
 *
 *      Garantías:
 *        · Sin owner y sin pausa: nadie de BeZhas puede mover ni retener fondos.
 *        · Cada reparto tiene su propio saldo. Una raíz mal calculada (o
 *          maliciosa) nunca puede sacar más de lo que el emisor depositó en ESE
 *          reparto, ni tocar los fondos de otro.
 *        · El emisor sólo recupera lo no reclamado pasada la fecha límite, que
 *          tiene un mínimo de MIN_CLAIM_WINDOW desde la creación.
 *        · En categorías de alto valor el titular tiene que estar verificado en
 *          el factory para cobrar (mismo criterio que RWAPrimarySale). Si no lo
 *          está, puede verificarse y reclamar antes de la fecha límite.
 *        · No admite tokens que cobran comisión en la transferencia: lo
 *          recibido tiene que ser exactamente lo declarado.
 */
contract RWARentDistributor is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// Comisión máxima admisible al desplegar (10 %).
    uint16 public constant MAX_FEE_BPS = 1000;
    /// Plazo mínimo que tiene un titular para reclamar.
    uint64 public constant MIN_CLAIM_WINDOW = 30 days;

    IRWAFactoryRent public immutable factory;
    address public immutable treasury;
    /// Comisión de BeZhas, cobrada al emisor ENCIMA del importe a repartir.
    uint16 public immutable feeBps;

    struct Distribution {
        uint256 assetId;
        address issuer;
        IERC20 token;
        uint256 amount;       // depositado para repartir
        uint256 remaining;    // aún sin reclamar ni recuperar
        bytes32 merkleRoot;
        uint64 snapshotBlock; // bloque de corte de los saldos
        uint64 claimDeadline;
        string detailsCID;    // justificante del reparto (IPFS): periodo, cálculo, lista
    }

    uint256 public distributionCount;
    mapping(uint256 => Distribution) public distributions;
    mapping(uint256 => mapping(address => bool)) public isClaimed;

    event DistributionCreated(
        uint256 indexed distributionId,
        uint256 indexed assetId,
        address indexed issuer,
        address token,
        uint256 amount,
        uint256 fee,
        bytes32 merkleRoot,
        uint64 snapshotBlock,
        uint64 claimDeadline,
        string detailsCID
    );
    event Claimed(uint256 indexed distributionId, address indexed account, uint256 amount);
    event Reclaimed(uint256 indexed distributionId, address indexed issuer, uint256 amount);

    error ZeroAddress();
    error FeeTooHigh();
    error ZeroAmount();
    error EmptyRoot();
    error NotCreator();
    error AssetInactive();
    error SnapshotNotInPast();
    error DeadlineTooSoon();
    error UnexpectedAmountReceived();
    error UnknownDistribution();
    error ClaimWindowClosed();
    error ClaimWindowOpen();
    error AlreadyClaimed();
    error InvalidProof();
    error ExceedsDistribution();
    error KycRequired();
    error NotIssuer();
    error NothingToReclaim();

    constructor(address _factory, address _treasury, uint16 _feeBps) {
        if (_factory == address(0) || _treasury == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        factory = IRWAFactoryRent(_factory);
        treasury = _treasury;
        feeBps = _feeBps;
    }

    /**
     * @notice El emisor del activo deposita `amount` de `token` para repartirlo
     *         según `merkleRoot`. Paga aparte la comisión a la tesorería.
     * @param snapshotBlock Bloque (ya pasado) en el que se tomaron los saldos.
     * @param claimDeadline Hasta cuándo se puede reclamar; después el emisor
     *        recupera lo que quede.
     */
    function createDistribution(
        uint256 assetId,
        IERC20 token,
        uint256 amount,
        bytes32 merkleRoot,
        uint64 snapshotBlock,
        uint64 claimDeadline,
        string calldata detailsCID
    ) external nonReentrant returns (uint256 distributionId) {
        if (address(token) == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (merkleRoot == bytes32(0)) revert EmptyRoot();
        if (snapshotBlock >= block.number) revert SnapshotNotInPast();
        if (claimDeadline < block.timestamp + MIN_CLAIM_WINDOW) revert DeadlineTooSoon();

        IRWAFactoryRent.Asset memory a = factory.getAsset(assetId);
        if (a.creator != msg.sender) revert NotCreator();
        if (!a.isActive) revert AssetInactive();

        distributionId = ++distributionCount;
        distributions[distributionId] = Distribution({
            assetId: assetId,
            issuer: msg.sender,
            token: token,
            amount: amount,
            remaining: amount,
            merkleRoot: merkleRoot,
            snapshotBlock: snapshotBlock,
            claimDeadline: claimDeadline,
            detailsCID: detailsCID
        });

        uint256 fee = (amount * feeBps) / 10_000;
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - before != amount) revert UnexpectedAmountReceived();
        if (fee > 0) token.safeTransferFrom(msg.sender, treasury, fee);

        emit DistributionCreated(
            distributionId, assetId, msg.sender, address(token), amount, fee,
            merkleRoot, snapshotBlock, claimDeadline, detailsCID
        );
    }

    /**
     * @notice Cobra la parte de `account` en un reparto. Puede llamarla
     *         cualquiera (un relayer, el propio emisor): el dinero va siempre a
     *         `account`.
     */
    function claim(uint256 distributionId, address account, uint256 amount, bytes32[] calldata proof)
        external nonReentrant
    {
        Distribution storage d = distributions[distributionId];
        if (d.issuer == address(0)) revert UnknownDistribution();
        if (block.timestamp > d.claimDeadline) revert ClaimWindowClosed();
        if (isClaimed[distributionId][account]) revert AlreadyClaimed();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account, amount))));
        if (!MerkleProof.verifyCalldata(proof, d.merkleRoot, leaf)) revert InvalidProof();
        if (amount > d.remaining) revert ExceedsDistribution();

        IRWAFactoryRent.Asset memory a = factory.getAsset(d.assetId);
        if (_altoValor(a.category) && !factory.isVerified(d.assetId, account)) revert KycRequired();

        isClaimed[distributionId][account] = true;
        d.remaining -= amount;
        d.token.safeTransfer(account, amount);

        emit Claimed(distributionId, account, amount);
    }

    /// Pasada la fecha límite, el emisor recupera lo que nadie reclamó.
    function reclaim(uint256 distributionId) external nonReentrant {
        Distribution storage d = distributions[distributionId];
        if (d.issuer != msg.sender) revert NotIssuer();
        if (block.timestamp <= d.claimDeadline) revert ClaimWindowOpen();
        uint256 rest = d.remaining;
        if (rest == 0) revert NothingToReclaim();

        d.remaining = 0;
        d.token.safeTransfer(msg.sender, rest);

        emit Reclaimed(distributionId, msg.sender, rest);
    }

    /// INMUEBLE, HOTEL, BARCO, HELICOPTERO: el mismo criterio que el factory.
    function _altoValor(uint8 category) private pure returns (bool) {
        return category == 0 || category == 1 || category == 5 || category == 6;
    }
}
