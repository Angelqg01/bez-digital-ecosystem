// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title ClinicalDataMarketplace
 * @dev Marketplace for anonymized clinical trial data. Sponsors register trials,
 * patients sign on-chain consent, researchers tokenize and sell anonymized datasets.
 * Patients earn BEZ rewards for contributing data.
 */
contract ClinicalDataMarketplace is AccessControl {
    bytes32 public constant SPONSOR_ROLE = keccak256("SPONSOR_ROLE");
    bytes32 public constant RESEARCHER_ROLE = keccak256("RESEARCHER_ROLE");

    enum TrialStatus { ENROLLING, ACTIVE, DATA_LOCK, COMPLETED, SUSPENDED }

    struct ClinicalTrial {
        string trialId;
        address sponsor;
        string title;
        uint8 phase;
        uint256 targetEnrollment;
        uint256 currentEnrollment;
        uint256 startDate;
        uint256 endDate;
        TrialStatus status;
    }

    struct PatientConsent {
        address patient;
        uint256 trialId;
        bytes32 consentHash;
        bool allowMarketplace;
        uint256 rewardsEarned;
        uint256 timestamp;
        bool active;
    }

    struct DataToken {
        uint256 trialId;
        string dataType;
        uint256 recordCount;
        bytes32 anonymizationProof;
        bytes32 dataHash;
        uint256 pricePerRecord;
        address researcher;
        bool zkVerified;
    }

    uint256 private _nextTrialId;
    uint256 private _nextConsentId;
    uint256 private _nextTokenId;

    mapping(uint256 => ClinicalTrial) private _trials;
    mapping(uint256 => PatientConsent) private _consents;
    mapping(uint256 => DataToken) private _dataTokens;
    mapping(uint256 => uint256) public dataTokenPurchases;

    uint256 public totalTrials;
    uint256 public totalConsents;
    uint256 public totalDataTokens;
    uint256 public totalMarketplaceRevenue;

    event TrialRegistered(uint256 indexed trialId, string trialIdStr, address indexed sponsor);
    event ConsentSigned(uint256 indexed consentId, uint256 indexed trialId, address indexed patient);
    event ConsentRevoked(uint256 indexed consentId);
    event DatasetTokenized(uint256 indexed tokenId, uint256 indexed trialId, string dataType, uint256 recordCount);
    event DataPurchased(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event RewardsDistributed(uint256 indexed trialId, uint256 totalAmount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Sponsor registers a new clinical trial.
     */
    function registerTrial(
        string calldata trialId,
        string calldata title,
        uint8 phase,
        uint256 targetEnrollment,
        uint256 startDate,
        uint256 endDate
    ) external onlyRole(SPONSOR_ROLE) returns (uint256 id) {
        require(phase >= 1 && phase <= 4, "ClinicalDataMarketplace: invalid phase");
        require(targetEnrollment > 0, "ClinicalDataMarketplace: zero target");
        require(endDate > startDate, "ClinicalDataMarketplace: invalid dates");

        id = _nextTrialId++;
        _trials[id] = ClinicalTrial({
            trialId: trialId,
            sponsor: msg.sender,
            title: title,
            phase: phase,
            targetEnrollment: targetEnrollment,
            currentEnrollment: 0,
            startDate: startDate,
            endDate: endDate,
            status: TrialStatus.ENROLLING
        });
        totalTrials++;

        emit TrialRegistered(id, trialId, msg.sender);
    }

    /**
     * @dev Patient signs on-chain informed consent for a trial.
     */
    function signConsent(
        uint256 trialId,
        bytes32 consentHash,
        bool allowMarketplace
    ) external returns (uint256 consentId) {
        ClinicalTrial storage trial = _trials[trialId];
        require(trial.sponsor != address(0), "ClinicalDataMarketplace: trial not found");
        require(
            trial.status == TrialStatus.ENROLLING || trial.status == TrialStatus.ACTIVE,
            "ClinicalDataMarketplace: not enrolling"
        );

        consentId = _nextConsentId++;
        _consents[consentId] = PatientConsent({
            patient: msg.sender,
            trialId: trialId,
            consentHash: consentHash,
            allowMarketplace: allowMarketplace,
            rewardsEarned: 0,
            timestamp: block.timestamp,
            active: true
        });

        trial.currentEnrollment++;
        totalConsents++;

        emit ConsentSigned(consentId, trialId, msg.sender);
    }

    /**
     * @dev Patient revokes consent.
     */
    function revokeConsent(uint256 consentId) external {
        PatientConsent storage consent = _consents[consentId];
        require(consent.patient == msg.sender, "ClinicalDataMarketplace: not patient");
        require(consent.active, "ClinicalDataMarketplace: already revoked");

        consent.active = false;
        emit ConsentRevoked(consentId);
    }

    /**
     * @dev Researcher tokenizes an anonymized dataset for sale.
     */
    function tokenizeDataset(
        uint256 trialId,
        string calldata dataType,
        uint256 recordCount,
        bytes32 anonymizationProof,
        bytes32 dataHash,
        uint256 pricePerRecord
    ) external onlyRole(RESEARCHER_ROLE) returns (uint256 tokenId) {
        require(_trials[trialId].sponsor != address(0), "ClinicalDataMarketplace: trial not found");
        require(recordCount > 0, "ClinicalDataMarketplace: zero records");

        tokenId = _nextTokenId++;
        _dataTokens[tokenId] = DataToken({
            trialId: trialId,
            dataType: dataType,
            recordCount: recordCount,
            anonymizationProof: anonymizationProof,
            dataHash: dataHash,
            pricePerRecord: pricePerRecord,
            researcher: msg.sender,
            zkVerified: false
        });
        totalDataTokens++;

        emit DatasetTokenized(tokenId, trialId, dataType, recordCount);
    }

    /**
     * @dev Mark a data token as ZK-verified (admin/oracle).
     */
    function setZKVerified(uint256 tokenId, bool verified) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _dataTokens[tokenId].zkVerified = verified;
    }

    /**
     * @dev Purchase access to a dataset. In production, handles BEZ token transfer.
     */
    function purchaseDataAccess(uint256 tokenId) external returns (bool) {
        DataToken storage dt = _dataTokens[tokenId];
        require(dt.zkVerified, "ClinicalDataMarketplace: not ZK-verified");
        require(dt.recordCount > 0, "ClinicalDataMarketplace: invalid token");

        dataTokenPurchases[tokenId]++;
        uint256 price = dt.recordCount * dt.pricePerRecord;
        totalMarketplaceRevenue += price;

        emit DataPurchased(tokenId, msg.sender, price);
        return true;
    }

    function getTrial(uint256 trialId) external view returns (ClinicalTrial memory) {
        return _trials[trialId];
    }

    function getConsent(uint256 consentId) external view returns (PatientConsent memory) {
        return _consents[consentId];
    }

    function getDataToken(uint256 tokenId) external view returns (DataToken memory) {
        return _dataTokens[tokenId];
    }
}
