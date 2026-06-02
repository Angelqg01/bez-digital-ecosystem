// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BeZhasWorkflowRegistry
 * @dev Almacena y verifica la ejecución de workflows automatizados on-chain.
 */
contract BeZhasWorkflowRegistry is AccessControl {
    uint256 private _workflowIds;

    bytes32 public constant WORKFLOW_MANAGER_ROLE = keccak256("WORKFLOW_MANAGER_ROLE");

    struct Workflow {
        uint256 id;
        string name;
        address creator;
        bytes32 contentHash; // Hash de la configuración del workflow
        bool isActive;
        uint256 lastRunAt;
        uint256 totalRuns;
    }

    mapping(uint256 => Workflow) public workflows;
    mapping(address => uint256[]) public creatorWorkflows;

    event WorkflowRegistered(uint256 indexed id, string name, address creator, bytes32 contentHash);
    event WorkflowExecuted(uint256 indexed id, uint256 timestamp, bytes32 runHash);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function registerWorkflow(string memory name, bytes32 contentHash) public returns (uint256) {
        _workflowIds++;
        uint256 newId = _workflowIds;

        workflows[newId] = Workflow({
            id: newId,
            name: name,
            creator: msg.sender,
            contentHash: contentHash,
            isActive: true,
            lastRunAt: 0,
            totalRuns: 0
        });

        creatorWorkflows[msg.sender].push(newId);
        emit WorkflowRegistered(newId, name, msg.sender, contentHash);
        return newId;
    }

    function recordExecution(uint256 workflowId, bytes32 runHash) public onlyRole(WORKFLOW_MANAGER_ROLE) {
        require(workflows[workflowId].id != 0, "Workflow does not exist");
        workflows[workflowId].lastRunAt = block.timestamp;
        workflows[workflowId].totalRuns += 1;
        emit WorkflowExecuted(workflowId, block.timestamp, runHash);
    }
}
