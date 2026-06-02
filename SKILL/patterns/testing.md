# Testing Patterns — BeZhas Blockchain
> Patrones de testing con Foundry

## Stack
- **Framework**: Foundry (forge test)
- **Language**: Solidity (test contracts)
- **Convention**: Test.t.sol suffix
- **Path**: smart-contracts/test/

## Test File Structure
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/module/Contract.sol";

contract ContractTest is Test {
    Contract public target;
    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    
    function setUp() public {
        vm.startPrank(admin);
        target = new Contract(/* args */);
        // Setup roles, state, etc.
        vm.stopPrank();
    }
    
    // Tests grouped by function
    function test_BasicFunction() public { ... }
    function test_FunctionRevertsOnBadInput() public { ... }
    function test_FunctionWithPermission() public { ... }
}
```

## Naming Convention
```
test_{FunctionName}                    // Happy path
test_{FunctionName}_Reverts{Reason}    // Expected revert
test_{FunctionName}_With{Condition}    // Variant
testFuzz_{FunctionName}                // Fuzz test
```

## Common Cheatcodes
```solidity
vm.prank(addr)          // Next call from addr (ONE call only)
vm.startPrank(addr)     // All subsequent calls from addr
vm.stopPrank()          // Stop prank

vm.deal(addr, amount)   // Set ETH balance
vm.warp(timestamp)      // Set block.timestamp
vm.roll(blockNum)       // Set block.number

vm.expectRevert("msg")  // Expect next call to revert
vm.expectEmit(true, true, false, true)  // Check event

makeAddr("label")       // Deterministic address from label
```

## Timelock Testing Pattern
```solidity
function test_TimelockOperation() public {
    // 1. Schedule
    vm.prank(admin);
    target.scheduleOperation(params);
    
    // 2. Warp past delay
    vm.warp(block.timestamp + TIMELOCK_DELAY + 1);
    
    // 3. Execute
    vm.prank(admin);
    target.executeOperation(params);
    
    // 4. Assert
    assertTrue(target.operationCompleted());
}
```

## Multi-Sig Testing Pattern
```solidity
function test_MultiSigApproval() public {
    // 1. Submit
    vm.prank(signer1);
    uint256 txId = target.submitTransaction(to, value, data);
    
    // 2. Approve (reach threshold)
    vm.prank(signer2);
    target.approveTransaction(txId);
    
    // 3. Execute
    vm.prank(signer1);
    target.executeTransaction(txId);
}
```

## Daily Limit Testing Pattern
```solidity
function test_DailyLimitExceeded() public {
    vm.startPrank(user);
    
    // Spend up to limit
    target.execute(to, dailyLimit, "");
    
    // Next should fail
    vm.expectRevert("SW: daily limit exceeded");
    target.execute(to, 1, "");
    
    // Warp 24h
    vm.warp(block.timestamp + 1 days + 1);
    target.execute(to, 1, ""); // Should work
    
    vm.stopPrank();
}
```

## Test Counts (Current)
| Module | File | Tests |
|--------|------|-------|
| SmartWallet | SmartWalletTest.t.sol | 33 |
| MultiSig | MultiSigWalletTest.t.sol | 21 |
| Paymaster | PaymasterTest.t.sol | 18 |
| SecurityModule | SecurityModuleTest.t.sol | 27 |
| WalletGuardian | WalletGuardianTest.t.sol | 16 |
| **Wallet Total** | | **115** |
| **Global Total** | | **931+** |

## Running Tests
```powershell
cd smart-contracts
& "$env:USERPROFILE\.foundry\bin\forge.exe" test
& "$env:USERPROFILE\.foundry\bin\forge.exe" test --match-path test/SmartWalletTest.t.sol -vvv
& "$env:USERPROFILE\.foundry\bin\forge.exe" test --match-test "test_DailyLimit" -vvv
```
