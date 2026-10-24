// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev Subconjunto del EntryPoint de ERC-4337 v0.7/v0.8 que usa el Gas Tank. La estructura es la pública del
///      estándar; se declara aquí para no depender de una librería externa hasta auditar la que se vaya a usar.
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;   // verificationGasLimit (16) | callGasLimit (16)
    uint256 preVerificationGas;
    bytes32 gasFees;            // maxPriorityFeePerGas (16) | maxFeePerGas (16)
    bytes paymasterAndData;     // paymaster (20) | verificationGasLimit (16) | postOpGasLimit (16) | paymasterData
    bytes signature;
}

enum PostOpMode { opSucceeded, opReverted, postOpReverted }

interface IEntryPointV8 {
    function depositTo(address account) external payable;
    function withdrawTo(address payable withdrawAddress, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function addStake(uint32 unstakeDelaySec) external payable;
    function unlockStake() external;
    function withdrawStake(address payable withdrawAddress) external;
}
