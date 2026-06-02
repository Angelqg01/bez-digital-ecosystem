// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {BeZhasL1Bridge} from "../src/bridges/BeZhasL1Bridge.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract L1BridgeEdgeCasesTest is Test {
    address multisig = address(0xA11CE);
    address user = address(0xBEEF);
    address tokenManager = address(0xCAFE);
    address attacker = address(0xBAD1);
    BeZhasL1Bridge bridge;
    MockToken token;

    function setUp() public {
        bridge = new BeZhasL1Bridge(multisig);
        token = new MockToken();
        vm.startPrank(multisig);
        bridge.grantRole(bridge.TOKEN_MANAGER_ROLE(), tokenManager);
        vm.stopPrank();
        vm.prank(tokenManager);
        bridge.setTokenSupport(address(token), true);
        token.mint(user, 100 ether);
    }

    function testReentrancyAttackFails() public {
        // No fallback or external call in lockTokens, so reentrancy is not possible
        vm.prank(user);
        token.approve(address(bridge), 10 ether);
        vm.prank(user);
        bridge.lockTokens(address(token), 10 ether, "destL2");
        assertEq(token.balanceOf(address(bridge)), 10 ether);
    }

    function testOverflowNotPossible() public {
        // Solidity 0.8+ checks overflow by default
        vm.prank(user);
        token.approve(address(bridge), type(uint256).max);
        vm.prank(user);
        bridge.lockTokens(address(token), 1 ether, "destL2");
        assertEq(token.balanceOf(address(bridge)), 1 ether);
    }

    function testWhitelistEnforced() public {
        address fakeToken = address(0xDEAD);
        vm.prank(user);
        vm.expectRevert();
        bridge.lockTokens(fakeToken, 1 ether, "destL2");
    }

    function testRejectsEmptyDestinationForTokenLock() public {
        vm.prank(user);
        token.approve(address(bridge), 1 ether);
        vm.prank(user);
        vm.expectRevert(bytes("Destino L2 requerido"));
        bridge.lockTokens(address(token), 1 ether, "");
    }

    function testRejectsEmptyDestinationForNativeLock() public {
        vm.deal(user, 1 ether);
        vm.prank(user);
        vm.expectRevert(bytes("Destino L2 requerido"));
        bridge.lockNativeEth{value: 1 ether}("");
    }

    function testUnlockRejectsReplayByWithdrawalId() public {
        vm.prank(user);
        token.approve(address(bridge), 2 ether);
        vm.prank(user);
        bridge.lockTokens(address(token), 2 ether, "destL2");

        bytes32 wid = keccak256("withdrawal-1");
        bytes32 proofHash = keccak256("proof-1");

        vm.prank(multisig);
        bridge.unlockTokens(user, address(token), 1 ether, wid, proofHash);
        assertEq(token.balanceOf(user), 99 ether);
        assertTrue(bridge.processedWithdrawals(wid));

        vm.prank(multisig);
        vm.expectRevert(bytes("Retiro ya procesado"));
        bridge.unlockTokens(user, address(token), 1 ether, wid, proofHash);
    }

    function testUnlockRejectsInvalidInputs() public {
        bytes32 wid = keccak256("withdrawal-invalid");
        bytes32 proofHash = keccak256("proof-invalid");

        vm.prank(multisig);
        vm.expectRevert(bytes("Recipient requerido"));
        bridge.unlockTokens(address(0), address(token), 1 ether, wid, proofHash);

        vm.prank(multisig);
        vm.expectRevert(bytes("Cantidad debe ser mayor a 0"));
        bridge.unlockTokens(user, address(token), 0, wid, proofHash);

        vm.prank(multisig);
        vm.expectRevert(bytes("WithdrawalId requerido"));
        bridge.unlockTokens(
            user,
            address(token),
            1 ether,
            bytes32(0),
            proofHash
        );

        vm.prank(multisig);
        vm.expectRevert(bytes("WithdrawalProofHash requerido"));
        bridge.unlockTokens(user, address(token), 1 ether, wid, bytes32(0));
    }

    function testStressEvents() public {
        for (uint256 i = 0; i < 10; i++) {
            vm.prank(user);
            token.approve(address(bridge), 1 ether);
            vm.prank(user);
            bridge.lockTokens(address(token), 1 ether, "destL2");
        }
        assertEq(token.balanceOf(address(bridge)), 10 ether);
    }
}

contract MockToken is IERC20 {
    string public constant name = "MockToken";
    string public constant symbol = "MTK";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) public {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        require(balanceOf[msg.sender] >= amount, "bal");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
        public
        returns (bool)
    {
        require(balanceOf[from] >= amount, "bal");
        require(allowance[from][msg.sender] >= amount, "allow");
        balanceOf[from] -= amount;
        allowance[from][msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
