// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title ESGScoreOracle — On-chain ESG reputation scoring with AI + third-party verification
/// @notice Companies are scored on Environmental, Social, Governance axes; scores are tradeable NFTs
contract ESGScoreOracle is AccessControl {

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant AUDITOR_ROLE   = keccak256("AUDITOR_ROLE");
    bytes32 public constant ORACLE_ROLE    = keccak256("ORACLE_ROLE");

    struct CompanyESG {
        string  companyId;
        string  name;
        string  sector;
        uint256 envScore;       // 0-100
        uint256 socScore;       // 0-100
        uint256 govScore;       // 0-100
        uint256 totalScore;     // weighted: ENV 40% + SOC 30% + GOV 30%
        bool    certified;
        uint256 lastAudit;
        bool    exists;
    }

    struct AuditRecord {
        uint256 companyTokenId;
        string  category;       // ENV, SOC, GOV
        string  metric;
        int256  changePercent;
        string  verifier;
        uint256 timestamp;
    }

    uint256 public nextCompanyId;
    mapping(uint256 => CompanyESG) public companies;
    mapping(uint256 => AuditRecord[]) public auditHistory;
    uint256 public totalAudits;

    event CompanyRegistered(uint256 indexed tokenId, string companyId, string name, string sector);
    event AuditSubmitted(uint256 indexed tokenId, string category, string metric, int256 change);
    event ScoreCertified(uint256 indexed tokenId, uint256 totalScore);
    event ScoreUpdated(uint256 indexed tokenId, uint256 env, uint256 soc, uint256 gov, uint256 total);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
        _grantRole(AUDITOR_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
    }

    function registerCompany(
        string calldata companyId,
        string calldata name,
        string calldata sector
    ) external onlyRole(REGISTRAR_ROLE) returns (uint256 tokenId) {
        require(bytes(companyId).length > 0, "Empty ID");
        tokenId = nextCompanyId++;
        companies[tokenId] = CompanyESG({
            companyId: companyId,
            name: name,
            sector: sector,
            envScore: 0,
            socScore: 0,
            govScore: 0,
            totalScore: 0,
            certified: false,
            lastAudit: 0,
            exists: true
        });
        emit CompanyRegistered(tokenId, companyId, name, sector);
    }

    function submitAudit(
        uint256 tokenId,
        uint256 env,
        uint256 soc,
        uint256 gov,
        string calldata category,
        string calldata metric,
        int256 changePercent
    ) external onlyRole(AUDITOR_ROLE) {
        require(companies[tokenId].exists, "Company not found");
        require(env <= 100 && soc <= 100 && gov <= 100, "Score out of range");

        CompanyESG storage c = companies[tokenId];
        c.envScore = env;
        c.socScore = soc;
        c.govScore = gov;
        c.totalScore = (env * 40 + soc * 30 + gov * 30) / 100;
        c.lastAudit = block.timestamp;
        c.certified = false; // re-certification needed after new audit

        auditHistory[tokenId].push(AuditRecord({
            companyTokenId: tokenId,
            category: category,
            metric: metric,
            changePercent: changePercent,
            verifier: "",
            timestamp: block.timestamp
        }));

        totalAudits++;
        emit AuditSubmitted(tokenId, category, metric, changePercent);
        emit ScoreUpdated(tokenId, env, soc, gov, c.totalScore);
    }

    function certifyScore(uint256 tokenId) external onlyRole(ORACLE_ROLE) {
        require(companies[tokenId].exists, "Company not found");
        require(companies[tokenId].lastAudit > 0, "No audit yet");
        companies[tokenId].certified = true;
        emit ScoreCertified(tokenId, companies[tokenId].totalScore);
    }

    function getCompanyScore(uint256 tokenId) external view returns (
        string memory companyId, string memory name, string memory sector,
        uint256 env, uint256 soc, uint256 gov, uint256 total,
        bool certified
    ) {
        CompanyESG storage c = companies[tokenId];
        require(c.exists, "Not found");
        return (c.companyId, c.name, c.sector, c.envScore, c.socScore, c.govScore, c.totalScore, c.certified);
    }

    function getAuditCount(uint256 tokenId) external view returns (uint256) {
        return auditHistory[tokenId].length;
    }

    function getGrade(uint256 score) external pure returns (string memory) {
        if (score >= 90) return "A+";
        if (score >= 80) return "A";
        if (score >= 70) return "B+";
        if (score >= 60) return "B";
        if (score >= 50) return "C+";
        if (score >= 40) return "C";
        if (score >= 20) return "D";
        return "F";
    }
}
