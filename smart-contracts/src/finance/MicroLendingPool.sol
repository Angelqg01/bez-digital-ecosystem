// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title MicroLendingPool — Decentralized micro-lending with collateral and repayment tracking
contract MicroLendingPool is AccessControl {

    bytes32 public constant LENDER_ROLE = keccak256("LENDER_ROLE");

    enum LoanStatus { REQUESTED, FUNDED, REPAYING, CLOSED, DEFAULTED, CANCELLED }

    struct Loan {
        uint256 id;
        address borrower;
        address lender;
        uint256 principal;
        uint256 interestBps;
        uint256 collateral;
        uint256 repaid;
        uint256 duration;
        uint256 fundedAt;
        LoanStatus status;
    }

    uint256 public nextLoanId;
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public borrowerLoans;

    // ─── Platform Fee ───
    uint256 public originationFeeBps = 100; // 1% origination fee
    address public treasury;
    uint256 public accruedFees;

    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 principal);
    event LoanFunded(uint256 indexed loanId, address indexed lender);
    event RepaymentMade(uint256 indexed loanId, uint256 amount);
    event LoanClosed(uint256 indexed loanId);
    event LoanDefaulted(uint256 indexed loanId);
    event LoanCancelled(uint256 indexed loanId);
    event FeeCollected(uint256 indexed loanId, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(address _treasury) {
        require(_treasury != address(0), "Invalid treasury");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(LENDER_ROLE, msg.sender);
        treasury = _treasury;
    }

    // ── Request a loan (borrower deposits collateral) ──────────────────
    function requestLoan(
        uint256 _principal,
        uint256 _interestBps,
        uint256 _duration
    ) external payable returns (uint256) {
        require(_principal > 0, "Principal must be > 0");
        require(msg.value > 0, "Collateral required");
        require(_duration > 0, "Duration must be > 0");
        require(_interestBps <= 5000, "Interest too high");

        uint256 lid = nextLoanId++;
        loans[lid] = Loan({
            id: lid,
            borrower: msg.sender,
            lender: address(0),
            principal: _principal,
            interestBps: _interestBps,
            collateral: msg.value,
            repaid: 0,
            duration: _duration,
            fundedAt: 0,
            status: LoanStatus.REQUESTED
        });
        borrowerLoans[msg.sender].push(lid);

        emit LoanRequested(lid, msg.sender, _principal);
        return lid;
    }

    // ── Fund a loan (lender sends principal) ──────────────────
    function fundLoan(uint256 _loanId) external payable onlyRole(LENDER_ROLE) {
        Loan storage l = loans[_loanId];
        require(l.status == LoanStatus.REQUESTED, "Not requested");
        require(msg.value == l.principal, "Must match principal");

        l.lender = msg.sender;
        l.status = LoanStatus.FUNDED;
        l.fundedAt = block.timestamp;

        // Deduct origination fee from principal
        uint256 fee = (l.principal * originationFeeBps) / 10_000;
        uint256 netPrincipal = l.principal - fee;
        accruedFees += fee;

        // Transfer net principal to borrower
        (bool ok, ) = l.borrower.call{value: netPrincipal}("");
        require(ok, "Transfer failed");

        emit LoanFunded(_loanId, msg.sender);
        if (fee > 0) emit FeeCollected(_loanId, fee);
    }

    // ── Make a repayment ──────────────────
    function repay(uint256 _loanId) external payable {
        Loan storage l = loans[_loanId];
        require(l.status == LoanStatus.FUNDED || l.status == LoanStatus.REPAYING, "Not active");
        require(msg.sender == l.borrower, "Not borrower");
        require(msg.value > 0, "Amount must be > 0");

        l.repaid += msg.value;
        l.status = LoanStatus.REPAYING;

        emit RepaymentMade(_loanId, msg.value);

        // Check if fully repaid (principal + interest)
        uint256 totalOwed = l.principal + (l.principal * l.interestBps / 10000);
        if (l.repaid >= totalOwed) {
            l.status = LoanStatus.CLOSED;
            // Return collateral to borrower
            (bool ok, ) = l.borrower.call{value: l.collateral}("");
            require(ok, "Collateral return failed");
            // Send repayments to lender
            (bool ok2, ) = l.lender.call{value: l.repaid}("");
            require(ok2, "Lender payment failed");
            emit LoanClosed(_loanId);
        }
    }

    // ── Mark loan as defaulted ──────────────────
    function markDefault(uint256 _loanId) external onlyRole(LENDER_ROLE) {
        Loan storage l = loans[_loanId];
        require(l.status == LoanStatus.FUNDED || l.status == LoanStatus.REPAYING, "Not active");
        require(block.timestamp > l.fundedAt + l.duration, "Not past due");

        l.status = LoanStatus.DEFAULTED;
        // Collateral goes to lender
        (bool ok, ) = l.lender.call{value: l.collateral}("");
        require(ok, "Collateral transfer failed");

        emit LoanDefaulted(_loanId);
    }

    // ── Cancel a requested loan ──────────────────
    function cancelLoan(uint256 _loanId) external {
        Loan storage l = loans[_loanId];
        require(l.status == LoanStatus.REQUESTED, "Cannot cancel");
        require(msg.sender == l.borrower, "Not borrower");

        l.status = LoanStatus.CANCELLED;
        // Return collateral
        (bool ok, ) = l.borrower.call{value: l.collateral}("");
        require(ok, "Collateral return failed");

        emit LoanCancelled(_loanId);
    }

    // ── View helpers ──────────────────
    function getBorrowerLoans(address _borrower) external view returns (uint256[] memory) {
        return borrowerLoans[_borrower];
    }

    function getTotalOwed(uint256 _loanId) external view returns (uint256) {
        Loan storage l = loans[_loanId];
        return l.principal + (l.principal * l.interestBps / 10000);
    }

    function getRemainingDebt(uint256 _loanId) external view returns (uint256) {
        Loan storage l = loans[_loanId];
        uint256 totalOwed = l.principal + (l.principal * l.interestBps / 10000);
        if (l.repaid >= totalOwed) return 0;
        return totalOwed - l.repaid;
    }

    // ── Admin ──────────────────
    function withdrawFees(address _to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_to != address(0), "Invalid address");
        uint256 amount = accruedFees;
        require(amount > 0, "No fees");
        accruedFees = 0;
        (bool ok, ) = _to.call{value: amount}("");
        require(ok, "Transfer failed");
        emit FeesWithdrawn(_to, amount);
    }

    function setOriginationFee(uint256 _newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newFeeBps <= 500, "Fee too high"); // max 5%
        originationFeeBps = _newFeeBps;
    }

    function setTreasury(address _newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newTreasury != address(0), "Invalid address");
        treasury = _newTreasury;
    }
}
