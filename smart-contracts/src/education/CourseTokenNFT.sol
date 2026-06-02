// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title CourseTokenNFT — Tokenized courses with certificate NFTs on BeZhas Chain
/// @notice Create courses, enroll students, issue completion certificates
contract CourseTokenNFT is AccessControl {

    bytes32 public constant INSTRUCTOR_ROLE = keccak256("INSTRUCTOR_ROLE");

    struct Course {
        string  title;
        string  institution;
        address instructor;
        uint256 price;
        uint256 maxStudents;
        uint256 enrolled;
        uint256 startDate;
        bool    active;
    }

    struct Certificate {
        uint256 courseId;
        address student;
        uint256 completedAt;
        uint256 score;          // 0-100
        string  metadataURI;
    }

    uint256 public nextCourseId;
    mapping(uint256 => Course) public courses;

    uint256 public nextCertId;
    mapping(uint256 => Certificate) public certificates;
    mapping(uint256 => mapping(address => bool)) public enrolled;
    mapping(uint256 => uint256[]) public courseCerts;

    event CourseCreated(uint256 indexed courseId, string title, string institution, address indexed instructor);
    event StudentEnrolled(uint256 indexed courseId, address indexed student);
    event CertificateIssued(uint256 indexed courseId, uint256 certId, address indexed student, uint256 score);
    event CourseClosed(uint256 indexed courseId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(INSTRUCTOR_ROLE, msg.sender);
    }

    function createCourse(
        string calldata title,
        string calldata institution,
        uint256 price,
        uint256 maxStudents,
        uint256 startDate
    ) external onlyRole(INSTRUCTOR_ROLE) returns (uint256) {
        require(maxStudents > 0, "Max students must be > 0");

        uint256 id = nextCourseId++;
        courses[id] = Course({
            title: title,
            institution: institution,
            instructor: msg.sender,
            price: price,
            maxStudents: maxStudents,
            enrolled: 0,
            startDate: startDate,
            active: true
        });

        emit CourseCreated(id, title, institution, msg.sender);
        return id;
    }

    function enrollStudent(uint256 courseId) external payable {
        Course storage c = courses[courseId];
        require(c.active, "Course not active");
        require(c.enrolled < c.maxStudents, "Course full");
        require(!enrolled[courseId][msg.sender], "Already enrolled");
        require(msg.value >= c.price, "Insufficient payment");

        enrolled[courseId][msg.sender] = true;
        c.enrolled++;

        emit StudentEnrolled(courseId, msg.sender);
    }

    function issueCertificate(
        uint256 courseId,
        address student,
        uint256 score,
        string calldata metadataURI
    ) external onlyRole(INSTRUCTOR_ROLE) returns (uint256) {
        require(enrolled[courseId][student], "Student not enrolled");
        require(score <= 100, "Score 0-100");

        uint256 cid = nextCertId++;
        certificates[cid] = Certificate({
            courseId: courseId,
            student: student,
            completedAt: block.timestamp,
            score: score,
            metadataURI: metadataURI
        });
        courseCerts[courseId].push(cid);

        emit CertificateIssued(courseId, cid, student, score);
        return cid;
    }

    function closeCourse(uint256 courseId) external onlyRole(INSTRUCTOR_ROLE) {
        require(courses[courseId].active, "Already closed");
        courses[courseId].active = false;
        emit CourseClosed(courseId);
    }

    function getCourse(uint256 courseId) external view returns (Course memory) {
        return courses[courseId];
    }

    function getCertificate(uint256 certId) external view returns (Certificate memory) {
        return certificates[certId];
    }

    function getCourseCertCount(uint256 courseId) external view returns (uint256) {
        return courseCerts[courseId].length;
    }

    receive() external payable {}
}
