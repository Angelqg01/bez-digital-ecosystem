// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/education/CourseTokenNFT.sol";

contract CourseTokenNFTTest is Test {
    CourseTokenNFT ct;
    address admin    = address(this);
    address instructor = address(0xA1);
    address student1 = address(0xB1);
    address student2 = address(0xB2);

    function setUp() public {
        ct = new CourseTokenNFT();
        ct.grantRole(ct.INSTRUCTOR_ROLE(), instructor);
        vm.deal(student1, 10 ether);
        vm.deal(student2, 10 ether);
    }

    function testCreateCourse() public {
        vm.startPrank(instructor);
        uint256 id = ct.createCourse("Blockchain 101", "UNAM", 0.5 ether, 30, block.timestamp + 1 days);
        vm.stopPrank();

        CourseTokenNFT.Course memory c = ct.getCourse(id);
        assertEq(c.title, "Blockchain 101");
        assertEq(c.institution, "UNAM");
        assertEq(c.instructor, instructor);
        assertEq(c.price, 0.5 ether);
        assertEq(c.maxStudents, 30);
        assertTrue(c.active);
    }

    function testCreateCourseRevertNotInstructor() public {
        vm.startPrank(student1);
        vm.expectRevert();
        ct.createCourse("Course", "Inst", 0, 10, block.timestamp + 1 days);
        vm.stopPrank();
    }

    function testEnrollStudent() public {
        vm.startPrank(instructor);
        uint256 cid = ct.createCourse("DeFi", "TecMilenio", 1 ether, 2, block.timestamp + 1 days);
        vm.stopPrank();

        vm.startPrank(student1);
        ct.enrollStudent{value: 1 ether}(cid);
        vm.stopPrank();

        assertTrue(ct.enrolled(cid, student1));
        CourseTokenNFT.Course memory c = ct.getCourse(cid);
        assertEq(c.enrolled, 1);
    }

    function testEnrollRevertCourseFull() public {
        vm.startPrank(instructor);
        uint256 cid = ct.createCourse("Tiny", "IPN", 0, 1, block.timestamp + 1 days);
        vm.stopPrank();

        vm.startPrank(student1);
        ct.enrollStudent(cid);
        vm.stopPrank();

        vm.startPrank(student2);
        vm.expectRevert("Course full");
        ct.enrollStudent(cid);
        vm.stopPrank();
    }

    function testEnrollRevertInsufficientPayment() public {
        vm.startPrank(instructor);
        uint256 cid = ct.createCourse("Paid", "Platzi", 2 ether, 10, block.timestamp + 1 days);
        vm.stopPrank();

        vm.startPrank(student1);
        vm.expectRevert("Insufficient payment");
        ct.enrollStudent{value: 1 ether}(cid);
        vm.stopPrank();
    }

    function testIssueCertificate() public {
        vm.startPrank(instructor);
        uint256 cid = ct.createCourse("Solidity", "BeZhas Academy", 0, 10, block.timestamp + 1 days);
        vm.stopPrank();

        vm.startPrank(student1);
        ct.enrollStudent(cid);
        vm.stopPrank();

        vm.startPrank(instructor);
        uint256 certId = ct.issueCertificate(cid, student1, 95, "ipfs://cert1");
        vm.stopPrank();

        CourseTokenNFT.Certificate memory cert = ct.getCertificate(certId);
        assertEq(cert.courseId, cid);
        assertEq(cert.student, student1);
        assertEq(cert.score, 95);
        assertEq(cert.metadataURI, "ipfs://cert1");
        assertEq(ct.getCourseCertCount(cid), 1);
    }

    function testIssueCertRevertNotEnrolled() public {
        vm.startPrank(instructor);
        uint256 cid = ct.createCourse("Test", "Inst", 0, 10, block.timestamp + 1 days);
        vm.expectRevert("Student not enrolled");
        ct.issueCertificate(cid, student1, 80, "uri");
        vm.stopPrank();
    }

    function testIssueCertRevertScoreOver100() public {
        vm.startPrank(instructor);
        uint256 cid = ct.createCourse("Test", "Inst", 0, 10, block.timestamp + 1 days);
        vm.stopPrank();

        vm.startPrank(student1);
        ct.enrollStudent(cid);
        vm.stopPrank();

        vm.startPrank(instructor);
        vm.expectRevert("Score 0-100");
        ct.issueCertificate(cid, student1, 101, "uri");
        vm.stopPrank();
    }

    function testCloseCourse() public {
        vm.startPrank(instructor);
        uint256 cid = ct.createCourse("Closing", "Inst", 0, 10, block.timestamp + 1 days);
        ct.closeCourse(cid);
        vm.stopPrank();

        CourseTokenNFT.Course memory c = ct.getCourse(cid);
        assertFalse(c.active);
    }

    function testEnrollRevertClosedCourse() public {
        vm.startPrank(instructor);
        uint256 cid = ct.createCourse("Closed", "Inst", 0, 10, block.timestamp + 1 days);
        ct.closeCourse(cid);
        vm.stopPrank();

        vm.startPrank(student1);
        vm.expectRevert("Course not active");
        ct.enrollStudent(cid);
        vm.stopPrank();
    }
}
