// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title DeliveryEscrow
 * @notice Economic escrow for BeZhas deliveries paid in BEZ.
 * @dev QualityEscrow stores validated telemetry; this contract holds funds and
 * releases or refunds them after oracle / edge-node delivery validation.
 */
contract DeliveryEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant EDGE_NODE_ROLE = keccak256("EDGE_NODE_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    enum Status {
        NONE,
        FUNDED,
        DISPUTED,
        RELEASED,
        REFUNDED
    }

    struct Escrow {
        address buyer;
        address seller;
        uint256 amount;
        uint256 fee;
        uint256 createdAt;
        uint256 settledAt;
        Status status;
        string memo;
        bytes32 evidenceHash;
    }

    IERC20 public immutable bezToken;
    address public treasury;
    uint16 public feeBps;
    uint256 public accruedFees;
    uint256 public totalEscrowed;
    uint256 public activeEscrows;

    mapping(bytes32 => Escrow) public escrows;

    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        string memo
    );
    event DeliveryValidated(bytes32 indexed escrowId, bytes32 evidenceHash, address indexed oracle);
    event EscrowReleased(bytes32 indexed escrowId, address indexed seller, uint256 netAmount, uint256 fee);
    event EscrowRefunded(bytes32 indexed escrowId, address indexed buyer, uint256 amount);
    event DisputeOpened(bytes32 indexed escrowId, address indexed openedBy, bytes32 evidenceHash);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event FeesWithdrawn(address indexed treasury, uint256 amount);

    error ZeroAddress();
    error InvalidAmount();
    error InvalidFee();
    error EscrowAlreadyExists(bytes32 escrowId);
    error EscrowNotFound(bytes32 escrowId);
    error InvalidStatus(bytes32 escrowId, Status current);
    error NotEscrowParticipant();
    error NotDeliveryValidator();
    error NoFeesToWithdraw();

    constructor(address _bezToken, address _treasury, uint16 _feeBps, address _admin) {
        if (_bezToken == address(0) || _treasury == address(0) || _admin == address(0)) revert ZeroAddress();
        if (_feeBps > 1000) revert InvalidFee();

        bezToken = IERC20(_bezToken);
        treasury = _treasury;
        feeBps = _feeBps;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ORACLE_ROLE, _admin);
        _grantRole(EDGE_NODE_ROLE, _admin);
        _grantRole(PAUSER_ROLE, _admin);
        _grantRole(TREASURY_ROLE, _treasury);
    }

    modifier onlyDeliveryValidator() {
        if (!hasRole(ORACLE_ROLE, msg.sender) && !hasRole(EDGE_NODE_ROLE, msg.sender)) {
            revert NotDeliveryValidator();
        }
        _;
    }

    function createEscrow(
        bytes32 escrowId,
        address seller,
        uint256 amount,
        string calldata memo
    ) external nonReentrant whenNotPaused {
        if (escrowId == bytes32(0)) revert EscrowNotFound(escrowId);
        if (seller == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (escrows[escrowId].status != Status.NONE) revert EscrowAlreadyExists(escrowId);

        escrows[escrowId] = Escrow({
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            fee: 0,
            createdAt: block.timestamp,
            settledAt: 0,
            status: Status.FUNDED,
            memo: memo,
            evidenceHash: bytes32(0)
        });

        totalEscrowed += amount;
        activeEscrows += 1;
        bezToken.safeTransferFrom(msg.sender, address(this), amount);

        emit EscrowCreated(escrowId, msg.sender, seller, amount, memo);
    }

    function validateAndRelease(bytes32 escrowId, bytes32 evidenceHash)
        external
        onlyDeliveryValidator
        nonReentrant
        whenNotPaused
    {
        Escrow storage escrow = _getFundedEscrow(escrowId);

        uint256 fee = (escrow.amount * feeBps) / 10_000;
        uint256 netAmount = escrow.amount - fee;

        escrow.fee = fee;
        escrow.evidenceHash = evidenceHash;
        escrow.status = Status.RELEASED;
        escrow.settledAt = block.timestamp;

        totalEscrowed -= escrow.amount;
        activeEscrows -= 1;
        accruedFees += fee;

        bezToken.safeTransfer(escrow.seller, netAmount);

        emit DeliveryValidated(escrowId, evidenceHash, msg.sender);
        emit EscrowReleased(escrowId, escrow.seller, netAmount, fee);
    }

    function openDispute(bytes32 escrowId, bytes32 evidenceHash) external whenNotPaused {
        Escrow storage escrow = _getFundedEscrow(escrowId);
        if (
            msg.sender != escrow.buyer
                && msg.sender != escrow.seller
                && !hasRole(ORACLE_ROLE, msg.sender)
                && !hasRole(EDGE_NODE_ROLE, msg.sender)
        ) {
            revert NotEscrowParticipant();
        }

        escrow.status = Status.DISPUTED;
        escrow.evidenceHash = evidenceHash;
        emit DisputeOpened(escrowId, msg.sender, evidenceHash);
    }

    function resolveDispute(bytes32 escrowId, bool releaseToSeller, bytes32 evidenceHash)
        external
        onlyDeliveryValidator
        nonReentrant
        whenNotPaused
    {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.status == Status.NONE) revert EscrowNotFound(escrowId);
        if (escrow.status != Status.DISPUTED) revert InvalidStatus(escrowId, escrow.status);

        if (releaseToSeller) {
            uint256 fee = (escrow.amount * feeBps) / 10_000;
            uint256 netAmount = escrow.amount - fee;

            escrow.fee = fee;
            escrow.status = Status.RELEASED;
            escrow.settledAt = block.timestamp;
            escrow.evidenceHash = evidenceHash;

            totalEscrowed -= escrow.amount;
            activeEscrows -= 1;
            accruedFees += fee;
            bezToken.safeTransfer(escrow.seller, netAmount);

            emit DeliveryValidated(escrowId, evidenceHash, msg.sender);
            emit EscrowReleased(escrowId, escrow.seller, netAmount, fee);
        } else {
            _refund(escrowId, escrow, evidenceHash);
        }
    }

    function refund(bytes32 escrowId, bytes32 evidenceHash)
        external
        onlyDeliveryValidator
        nonReentrant
        whenNotPaused
    {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.status == Status.NONE) revert EscrowNotFound(escrowId);
        if (escrow.status != Status.FUNDED && escrow.status != Status.DISPUTED) {
            revert InvalidStatus(escrowId, escrow.status);
        }
        _refund(escrowId, escrow, evidenceHash);
    }

    function withdrawFees() external onlyRole(TREASURY_ROLE) nonReentrant {
        uint256 amount = accruedFees;
        if (amount == 0) revert NoFeesToWithdraw();

        accruedFees = 0;
        bezToken.safeTransfer(treasury, amount);
        emit FeesWithdrawn(treasury, amount);
    }

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
        _grantRole(TREASURY_ROLE, newTreasury);
    }

    function setFeeBps(uint16 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeBps > 1000) revert InvalidFee();
        emit FeeUpdated(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function getEscrow(bytes32 escrowId) external view returns (Escrow memory) {
        Escrow memory escrow = escrows[escrowId];
        if (escrow.status == Status.NONE) revert EscrowNotFound(escrowId);
        return escrow;
    }

    function _getFundedEscrow(bytes32 escrowId) internal view returns (Escrow storage escrow) {
        escrow = escrows[escrowId];
        if (escrow.status == Status.NONE) revert EscrowNotFound(escrowId);
        if (escrow.status != Status.FUNDED) revert InvalidStatus(escrowId, escrow.status);
    }

    function _refund(bytes32 escrowId, Escrow storage escrow, bytes32 evidenceHash) internal {
        uint256 amount = escrow.amount;
        address buyer = escrow.buyer;

        escrow.status = Status.REFUNDED;
        escrow.settledAt = block.timestamp;
        escrow.evidenceHash = evidenceHash;

        totalEscrowed -= amount;
        activeEscrows -= 1;
        bezToken.safeTransfer(buyer, amount);

        emit EscrowRefunded(escrowId, buyer, amount);
    }
}
