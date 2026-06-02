// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/energy/ESGScoreOracle.sol";

contract ESGScoreOracleTest is Test {
    ESGScoreOracle esg;
    address admin = address(1);
    address registrar = address(2);
    address auditor = address(3);
    address oracle = address(4);
    address random = address(5);

    function setUp() public {
        vm.startPrank(admin);
        esg = new ESGScoreOracle(admin);
        esg.grantRole(esg.REGISTRAR_ROLE(), registrar);
        esg.grantRole(esg.AUDITOR_ROLE(), auditor);
        esg.grantRole(esg.ORACLE_ROLE(), oracle);
        vm.stopPrank();
    }

    function testRegisterCompany() public {
        vm.startPrank(registrar);
        uint256 id = esg.registerCompany("ESG-001", "Iberdrola", "ENERGY");
        vm.stopPrank();

        assertEq(id, 0);
        (string memory cid, string memory name, string memory sector,,,,,bool certified) = esg.getCompanyScore(0);
        assertEq(keccak256(bytes(cid)), keccak256(bytes("ESG-001")));
        assertEq(keccak256(bytes(name)), keccak256(bytes("Iberdrola")));
        assertEq(keccak256(bytes(sector)), keccak256(bytes("ENERGY")));
        assertFalse(certified);
    }

    function testRegisterRevertsUnauthorized() public {
        vm.startPrank(random);
        vm.expectRevert();
        esg.registerCompany("X", "X", "X");
        vm.stopPrank();
    }

    function testSubmitAudit() public {
        vm.startPrank(registrar);
        esg.registerCompany("ESG-002", "Maersk", "SHIPPING");
        vm.stopPrank();

        vm.startPrank(auditor);
        esg.submitAudit(0, 65, 78, 73, "ENV", "Scope 1 Emissions", -15);
        vm.stopPrank();

        // totalScore = (65*40 + 78*30 + 73*30) / 100 = (2600+2340+2190)/100 = 71
        (,,, uint256 env, uint256 soc, uint256 gov, uint256 total,) = esg.getCompanyScore(0);
        assertEq(env, 65);
        assertEq(soc, 78);
        assertEq(gov, 73);
        assertEq(total, 71);
        assertEq(esg.totalAudits(), 1);
    }

    function testSubmitAuditScoreOutOfRangeReverts() public {
        vm.startPrank(registrar);
        esg.registerCompany("ESG-003", "Test", "TECH");
        vm.stopPrank();

        vm.startPrank(auditor);
        vm.expectRevert("Score out of range");
        esg.submitAudit(0, 101, 50, 50, "ENV", "Test", 0);
        vm.stopPrank();
    }

    function testCertifyScore() public {
        vm.startPrank(registrar);
        esg.registerCompany("ESG-004", "Acciona", "CONSTRUCTION");
        vm.stopPrank();

        vm.startPrank(auditor);
        esg.submitAudit(0, 88, 79, 82, "ENV", "Renewable %", 4);
        vm.stopPrank();

        vm.startPrank(oracle);
        esg.certifyScore(0);
        vm.stopPrank();

        (,,,,,,, bool certified) = esg.getCompanyScore(0);
        assertTrue(certified);
    }

    function testCertifyWithoutAuditReverts() public {
        vm.startPrank(registrar);
        esg.registerCompany("ESG-005", "NoAudit", "OIL");
        vm.stopPrank();

        vm.startPrank(oracle);
        vm.expectRevert("No audit yet");
        esg.certifyScore(0);
        vm.stopPrank();
    }

    function testAuditResetsCertification() public {
        vm.startPrank(registrar);
        esg.registerCompany("ESG-006", "ReAudit", "ENERGY");
        vm.stopPrank();

        vm.startPrank(auditor);
        esg.submitAudit(0, 80, 80, 80, "ENV", "Test", 10);
        vm.stopPrank();

        vm.startPrank(oracle);
        esg.certifyScore(0);
        vm.stopPrank();

        // Second audit should reset certification
        vm.startPrank(auditor);
        esg.submitAudit(0, 85, 85, 85, "SOC", "Diversity", 5);
        vm.stopPrank();

        (,,,,,,, bool certified) = esg.getCompanyScore(0);
        assertFalse(certified);
    }

    function testGetGrade() public view {
        assertEq(keccak256(bytes(esg.getGrade(95))), keccak256(bytes("A+")));
        assertEq(keccak256(bytes(esg.getGrade(85))), keccak256(bytes("A")));
        assertEq(keccak256(bytes(esg.getGrade(75))), keccak256(bytes("B+")));
        assertEq(keccak256(bytes(esg.getGrade(65))), keccak256(bytes("B")));
        assertEq(keccak256(bytes(esg.getGrade(55))), keccak256(bytes("C+")));
        assertEq(keccak256(bytes(esg.getGrade(45))), keccak256(bytes("C")));
        assertEq(keccak256(bytes(esg.getGrade(25))), keccak256(bytes("D")));
        assertEq(keccak256(bytes(esg.getGrade(10))), keccak256(bytes("F")));
    }

    function testAuditHistory() public {
        vm.startPrank(registrar);
        esg.registerCompany("ESG-007", "HistTest", "TECH");
        vm.stopPrank();

        vm.startPrank(auditor);
        esg.submitAudit(0, 70, 70, 70, "ENV", "Emissions", -10);
        esg.submitAudit(0, 75, 72, 71, "SOC", "Safety", -33);
        vm.stopPrank();

        assertEq(esg.getAuditCount(0), 2);
        assertEq(esg.totalAudits(), 2);
    }
}
