// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Governor} from "openzeppelin-contracts/contracts/governance/Governor.sol";
import {GovernorSettings} from "openzeppelin-contracts/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "openzeppelin-contracts/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes, IVotes} from "openzeppelin-contracts/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "openzeppelin-contracts/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl, TimelockController} from "openzeppelin-contracts/contracts/governance/extensions/GovernorTimelockControl.sol";

interface IValidatorRegistryForGov {
    function isActiveValidator(address operator) external view returns (bool);
    function getValidatorTier(address operator) external view returns (uint8);
}

/**
 * @title BeZhas Governance System (DAO B2B)
 * @dev Módulo central DAO integrado con ValidatorRegistry y BEZCoinV2 (ERC20Votes).
 * 
 * Integración con el sistema de validación:
 *   - Usa BEZCoinV2 en modo timestamp (CLOCK_MODE=timestamp) para votos
 *   - Propuestas requieren mínimo tier Silver (2+) o threshold de tokens
 *   - El quorum se calcula sobre tokens delegados (ERC20Votes estándar)
 *   - Permite que la DAO controle parámetros de ValidatorRegistry, SlashingManager, etc.
 *   - TimelockController para ejecución segura de propuestas
 *
 * Parámetros DAO:
 *   - Voting Delay: 1 día
 *   - Voting Period: 1 semana
 *   - Proposal Threshold: 10K BEZ (previene spam, alineado con tier Bronze)
 *   - Quorum: 4% del total de votos delegados
 */
contract GovernanceSystem is 
    Governor, 
    GovernorSettings, 
    GovernorCountingSimple, 
    GovernorVotes, 
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    IValidatorRegistryForGov public validatorRegistry;

    event ValidatorRegistryUpdated(address indexed newRegistry);

    constructor(
        IVotes _token,
        TimelockController _timelock,
        address _validatorRegistry
    )
        Governor("BeZhas Governance System")
        GovernorSettings(
            1 days,             // Voting Delay
            1 weeks,            // Voting Period
            10_000 * 1e18       // Proposal Threshold: 10K BEZ
        )
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4)
        GovernorTimelockControl(_timelock)
    {
        validatorRegistry = IValidatorRegistryForGov(_validatorRegistry);
    }

    // ─── Clock en modo timestamp (para compatibilidad con BEZCoinV2) ─

    function clock() public view override(Governor, GovernorVotes) returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override(Governor, GovernorVotes) returns (string memory) {
        return "mode=timestamp";
    }

    // ─── Overrides obligatorios por herencia diamante ────────────────

    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256 timepoint) public view override(Governor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(timepoint);
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }

    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId) 
        public view override(Governor, GovernorTimelockControl) returns (bool) 
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }

    // ─── Update ValidatorRegistry (solo executor/timelock) ───────────

    function setValidatorRegistry(address _registry) external onlyGovernance {
        require(_registry != address(0), "GOV: zero address");
        validatorRegistry = IValidatorRegistryForGov(_registry);
        emit ValidatorRegistryUpdated(_registry);
    }
}
