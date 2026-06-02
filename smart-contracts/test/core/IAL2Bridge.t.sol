// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AegisSecurityProvider} from "../../src/core/AegisSecurityProvider.sol";
import {L2Sequencer} from "../../src/core/L2Sequencer.sol";
import {OpenClawAgent} from "../../src/core/OpenClawAgent.sol";

/**
 * @title IA-L2-Bridge Integration Test
 * @dev Validación completa de la fusión IA-L2-AEGIS:
 *      Amenaza → AegisSecurityProvider → OpenClawAgent → L2Sequencer
 *
 * Equivalente Foundry del test TypeScript original:
 *   IA-L2-Bridge.test.ts (Hardhat/Chai)
 */
contract IAL2BridgeIntegrationTest is Test {
    AegisSecurityProvider public aegis;
    L2Sequencer public sequencer;
    OpenClawAgent public agent;

    address public admin = address(1);
    address public oracle = address(2);
    address public keeper = address(3);  // Keeper que triggea el agente
    address public attacker = address(99);

    function setUp() public {
        vm.startPrank(admin);

        // 1. Deploy contratos
        aegis = new AegisSecurityProvider(admin);
        sequencer = new L2Sequencer(admin);
        agent = new OpenClawAgent(
            address(aegis),
            address(sequencer),
            address(0),  // SlashingManager opcional
            admin
        );

        // 2. Configurar roles
        // Oracle puede publicar señales en Aegis
        aegis.grantRole(aegis.ORACLE_ROLE(), oracle);

        // OpenClawAgent es CONSUMER en Aegis (puede consumir señales y pausar componentes)
        aegis.grantRole(aegis.CONSUMER_ROLE(), address(agent));

        // OpenClawAgent tiene AI_OPERATOR_ROLE en L2Sequencer (puede pausar/resumir)
        sequencer.grantRole(sequencer.AI_OPERATOR_ROLE(), address(agent));

        // Keeper puede operar el agente
        agent.grantRole(agent.OPERATOR_ROLE(), keeper);

        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST PRINCIPAL: Flujo Amenaza → AEGIS → Agente IA → Sequencer
    // ═══════════════════════════════════════════════════════════════════

    function test_FullFlow_Threat_Aegis_Agent_Sequencer() public {
        // A. Simulamos una señal de riesgo en AEGIS (Ciberseguridad)
        vm.prank(oracle);
        aegis.triggerRiskSignal("High_Slippage_Detected");

        // Verificar que la señal fue registrada
        assertEq(aegis.getSignalCount(), 1);
        assertEq(aegis.unconsumedCount(), 1);

        // B. El Agente IA procesa la señal y genera una orden de pausa
        vm.prank(keeper);
        uint256 signalId = agent.processSecurityAction();
        assertEq(signalId, 0);

        // C. Verificamos que el Sequencer recibió la orden del Agente
        bool isPaused = sequencer.isPausedByAI();
        assertEq(isPaused, true, "Sequencer deberia estar pausado por IA");

        // D. Verificamos logs de automatización (AIExecutionConfirmed event)
        // En Foundry, verificamos el estado final en vez de logs directos
        assertEq(agent.totalActionsExecuted(), 1);
        assertEq(agent.totalSequencerPauses(), 1);

        // E. Verificar que la señal fue consumida en Aegis
        (, , , , bool consumed) = aegis.getSignal(0);
        assertTrue(consumed, "Signal should be consumed");
        assertEq(aegis.unconsumedCount(), 0);

        console.log("=== Flujo completo validado ===");
        console.log("  Signal: High_Slippage_Detected");
        console.log("  Action: PAUSE_SEQUENCER_HIGH");
        console.log("  Sequencer paused: true");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST: Evento AIExecutionConfirmed emitido correctamente
    // ═══════════════════════════════════════════════════════════════════

    function test_AIExecutionConfirmed_EventEmitted() public {
        // Trigger señal
        vm.prank(oracle);
        aegis.triggerRiskSignal("Double_Signing_Detected");

        // Check that AIExecutionConfirmed event is emitted (check topic1=signalId only)
        vm.expectEmit(true, false, false, false);
        emit OpenClawAgent.AIExecutionConfirmed(0, "", 0);

        vm.prank(keeper);
        agent.processSecurityAction();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST: Nivel CRITICAL auto-activa emergencia global
    // ═══════════════════════════════════════════════════════════════════

    function test_CriticalLevel_GlobalEmergency() public {
        // Señal CRITICAL
        vm.prank(oracle);
        aegis.triggerRiskSignalWithLevel(
            "Protocol_Exploit_Detected",
            AegisSecurityProvider.RiskLevel.CRITICAL,
            ""
        );

        // Verifica auto-escalación a emergencia global
        assertTrue(aegis.globalEmergency(), "Global emergency should activate on CRITICAL");

        // Agente procesa
        vm.prank(keeper);
        agent.processSecurityAction();

        assertTrue(sequencer.isPausedByAI());

        // Verifica componente sequencer marcado como pausado
        assertTrue(
            aegis.isComponentPaused("sequencer"),
            "Sequencer component should be paused"
        );
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST: Nivel MEDIUM no pausa el sequencer
    // ═══════════════════════════════════════════════════════════════════

    function test_MediumLevel_NoPause() public {
        vm.prank(oracle);
        aegis.triggerRiskSignalWithLevel(
            "Unusual_Gas_Spike",
            AegisSecurityProvider.RiskLevel.MEDIUM,
            ""
        );

        vm.prank(keeper);
        agent.processSecurityAction();

        // Sequencer NO debería estar pausado con MEDIUM
        assertFalse(sequencer.isPausedByAI(), "MEDIUM should not pause sequencer");
        assertEq(agent.totalSequencerPauses(), 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST: Resume del sequencer tras resolver amenaza
    // ═══════════════════════════════════════════════════════════════════

    function test_ResumeSequencer_AfterThreatResolved() public {
        // 1. Amenaza → Pausa
        vm.prank(oracle);
        aegis.triggerRiskSignal("Bridge_Anomaly");

        vm.prank(keeper);
        agent.processSecurityAction();
        assertTrue(sequencer.isPausedByAI());

        // 2. Resolver → Resume
        vm.prank(keeper);
        agent.resumeSequencer();
        assertFalse(sequencer.isPausedByAI(), "Sequencer should be active after resume");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST: Cooldown entre acciones del agente
    // ═══════════════════════════════════════════════════════════════════

    function test_ActionCooldown_Enforced() public {
        // Primera señal + acción
        vm.prank(oracle);
        aegis.triggerRiskSignal("Threat_1");
        vm.prank(keeper);
        agent.processSecurityAction();

        // Resume para poder pausar de nuevo
        vm.prank(keeper);
        agent.resumeSequencer();

        // Segunda señal inmediata → debe fallar por cooldown
        vm.prank(oracle);
        aegis.triggerRiskSignal("Threat_2");

        vm.prank(keeper);
        vm.expectRevert("OCA: cooldown active");
        agent.processSecurityAction();

        // Avanzar 61 segundos → ahora sí
        vm.warp(block.timestamp + 61);
        vm.prank(keeper);
        agent.processSecurityAction();

        assertEq(agent.totalActionsExecuted(), 2);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST: Sin señales pendientes → revert
    // ═══════════════════════════════════════════════════════════════════

    function test_NoSignals_Reverts() public {
        vm.prank(keeper);
        vm.expectRevert("OCA: no pending signals");
        agent.processSecurityAction();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST: Solo roles autorizados
    // ═══════════════════════════════════════════════════════════════════

    function test_OnlyOracle_CanTriggerSignals() public {
        vm.prank(attacker);
        vm.expectRevert();
        aegis.triggerRiskSignal("Fake_Alert");
    }

    function test_OnlyOperator_CanProcessActions() public {
        vm.prank(oracle);
        aegis.triggerRiskSignal("Real_Threat");

        vm.prank(attacker);
        vm.expectRevert();
        agent.processSecurityAction();
    }

    function test_OnlyAIOperator_CanPauseSequencer() public {
        vm.prank(attacker);
        vm.expectRevert();
        sequencer.pauseByAI("hack attempt");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST: Auto-resume tras MAX_PAUSE_DURATION
    // ═══════════════════════════════════════════════════════════════════

    function test_AutoResume_AfterMaxDuration() public {
        vm.prank(oracle);
        aegis.triggerRiskSignal("Long_Threat");

        vm.prank(keeper);
        agent.processSecurityAction();
        assertTrue(sequencer.isPausedByAI());

        // Antes de 1 hora → no auto-resume
        vm.warp(block.timestamp + 30 minutes);
        vm.expectRevert("SEQ: max pause not reached");
        sequencer.autoResume();

        // Después de 1 hora → auto-resume disponible
        vm.warp(block.timestamp + 31 minutes);
        sequencer.autoResume();
        assertFalse(sequencer.isPausedByAI());
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST: Múltiples señales procesadas en secuencia
    // ═══════════════════════════════════════════════════════════════════

    function test_MultipleSignals_Sequential() public {
        string[3] memory threats = ["Slippage_Alert", "Oracle_Manipulation", "MEV_Attack"];

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(oracle);
            aegis.triggerRiskSignal(threats[i]);
        }

        assertEq(aegis.getSignalCount(), 3);
        assertEq(aegis.unconsumedCount(), 3);

        // Procesar la primera (más reciente = "MEV_Attack")
        vm.prank(keeper);
        uint256 processed = agent.processSecurityAction();
        assertEq(processed, 2); // Last signal (index 2)

        // Avanzar cooldown y procesar la siguiente
        vm.warp(block.timestamp + 61);
        vm.prank(keeper);
        agent.resumeSequencer();
        vm.prank(keeper);
        processed = agent.processSecurityAction();
        assertEq(processed, 1); // Signal index 1

        assertEq(aegis.unconsumedCount(), 1); // Solo queda 1
        assertEq(agent.totalActionsExecuted(), 2);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST: ProcessSignalById — señal específica
    // ═══════════════════════════════════════════════════════════════════

    function test_ProcessSignalById() public {
        vm.startPrank(oracle);
        aegis.triggerRiskSignal("Alert_A");
        aegis.triggerRiskSignal("Alert_B");
        aegis.triggerRiskSignal("Alert_C");
        vm.stopPrank();

        // Procesar específicamente la señal 0 (Alert_A)
        vm.prank(keeper);
        agent.processSignalById(0);

        (, , , , bool consumed0) = aegis.getSignal(0);
        (, , , , bool consumed1) = aegis.getSignal(1);
        assertTrue(consumed0, "Signal 0 should be consumed");
        assertFalse(consumed1, "Signal 1 NO deberia estar consumida");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST: Stats y vista del agente
    // ═══════════════════════════════════════════════════════════════════

    function test_AgentStats() public {
        vm.prank(oracle);
        aegis.triggerRiskSignal("Test_Threat");

        vm.prank(keeper);
        agent.processSecurityAction();

        (uint256 actions, uint256 pauses, uint256 slashes, uint256 lastAction) = agent.getStats();
        assertEq(actions, 1);
        assertEq(pauses, 1);
        assertEq(slashes, 0);
        assertGt(lastAction, 0);

        // Verificar historial de acciones
        (
            uint256 sigId,
            string memory sigType,
            ,
            string memory actionTaken,
        ) = agent.getAction(0);
        assertEq(sigId, 0);
        assertEq(sigType, "Test_Threat");
        assertEq(actionTaken, "PAUSE_SEQUENCER_HIGH");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TEST: L2Sequencer.getStatus()
    // ═══════════════════════════════════════════════════════════════════

    function test_SequencerStatus() public {
        // Estado inicial
        (bool paused, , , uint256 pauseCount, ) = sequencer.getStatus();
        assertFalse(paused);
        assertEq(pauseCount, 0);

        // Después de pausa
        vm.prank(oracle);
        aegis.triggerRiskSignal("Status_Test");
        vm.prank(keeper);
        agent.processSecurityAction();

        (paused, , , pauseCount, ) = sequencer.getStatus();
        assertTrue(paused);
        assertEq(pauseCount, 1);
    }
}
