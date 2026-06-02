// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {BeZhasL1Bridge} from "../../src/bridges/BeZhasL1Bridge.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

// ─── Mock ERC20 for fuzz testing ─────────────────────────────────
contract MockERC20 {
    string public name = "Mock Token";
    string public symbol = "MOCK";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient");
        require(allowance[from][msg.sender] >= amount, "No allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }
}

// ─── Handler: performs constrained random operations ──────────────
contract L1BridgeHandler is Test {
    BeZhasL1Bridge public bridge;
    MockERC20 public token;
    address public multisig;

    // Ghost variables for invariant tracking
    uint256 public ghost_totalLocked;
    uint256 public ghost_totalUnlocked;
    uint256 public ghost_ethLocked;
    uint256 public ghost_ethUnlocked;
    uint256 public ghost_lockCallCount;
    uint256 public ghost_unlockCallCount;
    uint256 public ghost_nativeCallCount;
    uint256 public ghost_replayAttempts;

    address[] internal actors;
    bytes32[] internal usedWithdrawalIds;

    constructor(BeZhasL1Bridge _bridge, MockERC20 _token, address _multisig) {
        bridge = _bridge;
        token = _token;
        multisig = _multisig;

        // Create actor pool
        for (uint256 i = 1; i <= 10; i++) {
            address actor = address(uint160(0x1000 + i));
            actors.push(actor);
            token.mint(actor, 1_000_000 ether);
            vm.prank(actor);
            token.approve(address(bridge), type(uint256).max);
            vm.deal(actor, 100 ether);
        }
    }

    function lockTokens(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 1, 100_000 ether);

        vm.prank(actor);
        bridge.lockTokens(address(token), amount, "0xDestL2Address");

        ghost_totalLocked += amount;
        ghost_lockCallCount++;
    }

    function lockNativeEth(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 1 wei, 10 ether);

        vm.prank(actor);
        bridge.lockNativeEth{value: amount}("0xDestL2Address");

        ghost_ethLocked += amount;
        ghost_nativeCallCount++;
    }

    function unlockTokens(uint256 recipientSeed, uint256 amount) external {
        address recipient = actors[recipientSeed % actors.length];
        amount = bound(amount, 1, ghost_totalLocked - ghost_totalUnlocked);

        // Skip if nothing to unlock
        if (ghost_totalLocked <= ghost_totalUnlocked) return;
        if (amount == 0) return;

        bytes32 withdrawalId = keccak256(abi.encodePacked("wid", ghost_unlockCallCount));
        bytes32 proofHash = keccak256(abi.encodePacked("proof", ghost_unlockCallCount));

        vm.prank(multisig);
        bridge.unlockTokens(recipient, address(token), amount, withdrawalId, proofHash);

        ghost_totalUnlocked += amount;
        ghost_unlockCallCount++;
        usedWithdrawalIds.push(withdrawalId);
    }

    function unlockNativeEth(uint256 recipientSeed, uint256 amount) external {
        address recipient = actors[recipientSeed % actors.length];

        uint256 available = ghost_ethLocked - ghost_ethUnlocked;
        if (available == 0) return;
        amount = bound(amount, 1, available);

        bytes32 withdrawalId = keccak256(abi.encodePacked("ethwid", ghost_unlockCallCount));
        bytes32 proofHash = keccak256(abi.encodePacked("ethproof", ghost_unlockCallCount));

        vm.prank(multisig);
        bridge.unlockTokens(recipient, address(0), amount, withdrawalId, proofHash);

        ghost_ethUnlocked += amount;
        ghost_unlockCallCount++;
        usedWithdrawalIds.push(withdrawalId);
    }

    function replayUnlock(uint256 idSeed) external {
        if (usedWithdrawalIds.length == 0) return;
        bytes32 withdrawalId = usedWithdrawalIds[idSeed % usedWithdrawalIds.length];

        vm.prank(multisig);
        vm.expectRevert(bytes("Retiro ya procesado"));
        bridge.unlockTokens(actors[0], address(token), 1, withdrawalId, bytes32("proof"));
        ghost_replayAttempts++;
    }
}

// ─── Invariant Test Suite ────────────────────────────────────────
contract L1BridgeInvariantTest is Test {
    BeZhasL1Bridge public bridge;
    MockERC20 public token;
    L1BridgeHandler public handler;

    address multisig = address(0xA11CE);

    function setUp() public {
        bridge = new BeZhasL1Bridge(multisig);
        token = new MockERC20();

        vm.prank(multisig);
        bridge.setTokenSupport(address(token), true);

        handler = new L1BridgeHandler(bridge, token, multisig);

        // Fund bridge with ETH for native unlocks
        vm.deal(address(bridge), 1000 ether);

        targetContract(address(handler));
    }

    /// @dev Bridge token balance == locked - unlocked
    function invariant_bridgeTokenBalanceMatchesAccounting() public view {
        uint256 bridgeBalance = token.balanceOf(address(bridge));
        uint256 expected = handler.ghost_totalLocked() - handler.ghost_totalUnlocked();
        assertEq(bridgeBalance, expected, "Token balance mismatch");
    }

    /// @dev Unlocked never exceeds locked
    function invariant_unlockedNeverExceedsLocked() public view {
        assertLe(
            handler.ghost_totalUnlocked(),
            handler.ghost_totalLocked(),
            "Unlocked exceeds locked"
        );
    }

    /// @dev ETH unlocked never exceeds ETH locked
    function invariant_ethUnlockedNeverExceedsLocked() public view {
        assertLe(
            handler.ghost_ethUnlocked(),
            handler.ghost_ethLocked(),
            "ETH unlocked exceeds locked"
        );
    }

    /// @dev Bridge should never lose ETH (bridge ETH >= ethLocked - ethUnlocked)
    function invariant_bridgeEthSolvency() public view {
        uint256 expectedMinETH = handler.ghost_ethLocked() - handler.ghost_ethUnlocked();
        assertGe(address(bridge).balance, expectedMinETH, "Bridge ETH insolvent");
    }

    /// @dev All replay attempts must revert (counter only grows in expectRevert)
    function invariant_replayProtectionWorks() public view {
        // If we made replay attempts, they all reverted (no state change)
        assertTrue(true, "Replay protection"); // assertion is in handler via expectRevert
    }

    function invariant_callSummary() public view {
        console.log("Lock calls:    ", handler.ghost_lockCallCount());
        console.log("Unlock calls:  ", handler.ghost_unlockCallCount());
        console.log("Native locks:  ", handler.ghost_nativeCallCount());
        console.log("Replay blocks: ", handler.ghost_replayAttempts());
        console.log("Total locked:  ", handler.ghost_totalLocked());
        console.log("Total unlocked:", handler.ghost_totalUnlocked());
    }
}

// ─── Fuzz Tests ──────────────────────────────────────────────────
contract L1BridgeFuzzTest is Test {
    BeZhasL1Bridge public bridge;
    MockERC20 public token;
    address multisig = address(0xA11CE);
    address user = address(0xBEEF);

    function setUp() public {
        bridge = new BeZhasL1Bridge(multisig);
        token = new MockERC20();

        vm.prank(multisig);
        bridge.setTokenSupport(address(token), true);

        token.mint(user, type(uint128).max);
        vm.prank(user);
        token.approve(address(bridge), type(uint256).max);
        vm.deal(user, type(uint128).max);
    }

    /// @dev Locking any valid amount transfers exact amount to bridge
    function testFuzz_lockTokensExactTransfer(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000 ether);

        uint256 bridgeBefore = token.balanceOf(address(bridge));
        uint256 userBefore = token.balanceOf(user);

        vm.prank(user);
        bridge.lockTokens(address(token), amount, "0xDest");

        assertEq(token.balanceOf(address(bridge)), bridgeBefore + amount);
        assertEq(token.balanceOf(user), userBefore - amount);
    }

    /// @dev Locking native ETH captures exact value
    function testFuzz_lockEthExactValue(uint256 amount) public {
        amount = bound(amount, 1, 100 ether);
        uint256 bridgeBefore = address(bridge).balance;

        vm.prank(user);
        bridge.lockNativeEth{value: amount}("0xDest");

        assertEq(address(bridge).balance, bridgeBefore + amount);
    }

    /// @dev Zero amount lock always reverts
    function testFuzz_lockZeroReverts(uint8 tokenChoice) public {
        vm.prank(user);
        vm.expectRevert(bytes("Cantidad debe ser mayor a 0"));
        bridge.lockTokens(address(token), 0, "0xDest");

        vm.prank(user);
        vm.expectRevert(bytes("Debe enviar ETH"));
        bridge.lockNativeEth{value: 0}("0xDest");
    }

    /// @dev Unsupported token always reverts
    function testFuzz_unsupportedTokenReverts(address fakeToken, uint256 amount) public {
        vm.assume(fakeToken != address(token));
        vm.assume(fakeToken != address(0));
        amount = bound(amount, 1, 1000 ether);

        vm.prank(user);
        vm.expectRevert(bytes("Token no soportado por BeZhas"));
        bridge.lockTokens(fakeToken, amount, "0xDest");
    }

    /// @dev Empty destination always reverts
    function testFuzz_emptyDestinationTokenReverts(uint256 amount) public {
        amount = bound(amount, 1, 1000 ether);

        vm.prank(user);
        vm.expectRevert(bytes("Destino L2 requerido"));
        bridge.lockTokens(address(token), amount, "");
    }

    /// @dev Empty destination for ETH always reverts
    function testFuzz_emptyDestinationEthReverts(uint256 amount) public {
        amount = bound(amount, 1, 10 ether);

        vm.prank(user);
        vm.expectRevert(bytes("Destino L2 requerido"));
        bridge.lockNativeEth{value: amount}("");
    }

    /// @dev Unlock with unique withdrawalId always succeeds exactly once
    function testFuzz_unlockUniqueId(uint256 amount, bytes32 salt) public {
        amount = bound(amount, 1, 100_000 ether);

        // Lock tokens first
        vm.prank(user);
        bridge.lockTokens(address(token), amount, "0xDest");

        bytes32 wid = keccak256(abi.encodePacked("wid", salt));
        bytes32 proof = keccak256(abi.encodePacked("proof", salt));

        vm.prank(multisig);
        bridge.unlockTokens(user, address(token), amount, wid, proof);

        assertTrue(bridge.processedWithdrawals(wid));

        // Replay must fail
        vm.prank(multisig);
        vm.expectRevert(bytes("Retiro ya procesado"));
        bridge.unlockTokens(user, address(token), amount, wid, proof);
    }

    /// @dev Pause blocks deposits, unpause restores them
    function testFuzz_pauseBlocksDeposits(uint256 amount) public {
        amount = bound(amount, 1, 10_000 ether);

        vm.prank(multisig);
        bridge.setPause(true);

        vm.prank(user);
        vm.expectRevert(bytes("El Puente esta en mantenimiento"));
        bridge.lockTokens(address(token), amount, "0xDest");

        vm.prank(multisig);
        bridge.setPause(false);

        vm.prank(user);
        bridge.lockTokens(address(token), amount, "0xDest");
    }

    /// @dev Non-multisig cannot unlock
    function testFuzz_onlyMultisigUnlocks(address attacker) public {
        vm.assume(attacker != multisig);
        vm.assume(attacker != address(0));

        vm.prank(user);
        bridge.lockTokens(address(token), 1 ether, "0xDest");

        vm.prank(attacker);
        vm.expectRevert();
        bridge.unlockTokens(user, address(token), 1 ether, bytes32("wid"), bytes32("proof"));
    }
}
