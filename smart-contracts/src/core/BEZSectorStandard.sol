// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title BEZSectorStandard
 * @notice Base comun para contratos sectoriales que cobran, reservan o reparten valor en BEZCoinV2.
 * @dev Los modulos sectoriales deben heredar este contrato cuando migren desde pagos nativos.
 */
abstract contract BEZSectorStandard is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable bezToken;
    address public treasury;
    uint16 public feeBps;

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeBpsUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event BEZFeeCollected(address indexed payer, uint256 grossAmount, uint256 feeAmount, bytes32 indexed ref);

    error ZeroAddress();
    error InvalidFee();
    error ZeroAmount();

    constructor(address bezToken_, address treasury_, uint16 feeBps_, address owner_) Ownable(owner_) {
        if (bezToken_ == address(0) || treasury_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        if (feeBps_ > 1000) revert InvalidFee();
        bezToken = IERC20(bezToken_);
        treasury = treasury_;
        feeBps = feeBps_;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) revert InvalidFee();
        emit FeeBpsUpdated(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }

    function quoteBEZFee(uint256 amount) public view returns (uint256 fee, uint256 netAmount) {
        if (amount == 0) revert ZeroAmount();
        fee = (amount * feeBps) / 10_000;
        netAmount = amount - fee;
    }

    function _pullBEZWithFee(address payer, address recipient, uint256 amount, bytes32 ref)
        internal
        returns (uint256 fee, uint256 netAmount)
    {
        (fee, netAmount) = quoteBEZFee(amount);
        if (fee > 0) bezToken.safeTransferFrom(payer, treasury, fee);
        bezToken.safeTransferFrom(payer, recipient, netAmount);
        emit BEZFeeCollected(payer, amount, fee, ref);
    }

    function _pullBEZToContract(address payer, uint256 amount, bytes32 ref)
        internal
        returns (uint256 fee, uint256 netAmount)
    {
        (fee, netAmount) = quoteBEZFee(amount);
        bezToken.safeTransferFrom(payer, address(this), amount);
        if (fee > 0) bezToken.safeTransfer(treasury, fee);
        emit BEZFeeCollected(payer, amount, fee, ref);
    }
}
