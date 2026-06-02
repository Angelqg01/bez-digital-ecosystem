// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/education/SkillBadgeSBT.sol";

contract SkillBadgeSBTTest is Test {
    SkillBadgeSBT sbt;
    address admin  = address(this);
    address issuer = address(0xA1);
    address holder1 = address(0xB1);
    address holder2 = address(0xB2);

    function setUp() public {
        sbt = new SkillBadgeSBT();
        sbt.grantRole(sbt.ISSUER_ROLE(), issuer);
    }

    function testRegisterIssuer() public {
        uint256 id = sbt.registerIssuer("BeZhas Academy");
        (string memory name, address addr, uint256 badgesIssued, bool accredited) = sbt.issuers(id);
        assertEq(name, "BeZhas Academy");
        assertTrue(accredited);
    }

    function testRegisterIssuerRevertNotAdmin() public {
        vm.startPrank(issuer);
        vm.expectRevert();
        sbt.registerIssuer("Fake");
        vm.stopPrank();
    }

    function testMintBadge() public {
        vm.startPrank(issuer);
        uint256 id = sbt.mintBadge(holder1, "Solidity Dev", "Solidity", 2, 85);
        vm.stopPrank();

        SkillBadgeSBT.Badge memory b = sbt.getBadge(id);
        assertEq(b.title, "Solidity Dev");
        assertEq(b.skill, "Solidity");
        assertEq(b.level, 2);
        assertEq(b.score, 85);
        assertEq(b.holder, holder1);
        assertEq(b.issuer, issuer);
        assertFalse(b.verified);
        assertFalse(b.revoked);
    }

    function testMintRevertInvalidLevel() public {
        vm.startPrank(issuer);
        vm.expectRevert("Level 1-3");
        sbt.mintBadge(holder1, "Bad", "Level", 0, 50);
        vm.stopPrank();
    }

    function testMintRevertInvalidLevel4() public {
        vm.startPrank(issuer);
        vm.expectRevert("Level 1-3");
        sbt.mintBadge(holder1, "Bad", "Level", 4, 50);
        vm.stopPrank();
    }

    function testMintRevertScoreOver100() public {
        vm.startPrank(issuer);
        vm.expectRevert("Score 0-100");
        sbt.mintBadge(holder1, "Bad", "Score", 1, 101);
        vm.stopPrank();
    }

    function testMintRevertZeroAddress() public {
        vm.startPrank(issuer);
        vm.expectRevert("Invalid holder");
        sbt.mintBadge(address(0), "Bad", "Addr", 1, 50);
        vm.stopPrank();
    }

    function testVerifyBadge() public {
        vm.startPrank(issuer);
        uint256 id = sbt.mintBadge(holder1, "DeFi Analyst", "DeFi", 3, 92);
        sbt.verifyBadge(id);
        vm.stopPrank();

        assertTrue(sbt.getBadge(id).verified);
    }

    function testVerifyRevertAlreadyVerified() public {
        vm.startPrank(issuer);
        uint256 id = sbt.mintBadge(holder1, "Test", "Skill", 1, 60);
        sbt.verifyBadge(id);
        vm.expectRevert("Already verified");
        sbt.verifyBadge(id);
        vm.stopPrank();
    }

    function testRevokeBadge() public {
        vm.startPrank(issuer);
        uint256 id = sbt.mintBadge(holder1, "Rust Dev", "Rust", 1, 70);
        sbt.verifyBadge(id);
        sbt.revokeBadge(id);
        vm.stopPrank();

        SkillBadgeSBT.Badge memory b = sbt.getBadge(id);
        assertTrue(b.revoked);
        assertFalse(b.verified);
    }

    function testRevokeRevertAlreadyRevoked() public {
        vm.startPrank(issuer);
        uint256 id = sbt.mintBadge(holder1, "Test", "Skill", 2, 50);
        sbt.revokeBadge(id);
        vm.expectRevert("Already revoked");
        sbt.revokeBadge(id);
        vm.stopPrank();
    }

    function testGetHolderBadgeCount() public {
        vm.startPrank(issuer);
        sbt.mintBadge(holder1, "B1", "S1", 1, 50);
        sbt.mintBadge(holder1, "B2", "S2", 2, 60);
        sbt.mintBadge(holder1, "B3", "S3", 3, 70);
        vm.stopPrank();

        assertEq(sbt.getHolderBadgeCount(holder1), 3);
        assertEq(sbt.getHolderBadgeCount(holder2), 0);
    }
}
