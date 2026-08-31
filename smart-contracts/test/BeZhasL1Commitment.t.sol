// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BeZhasL1Commitment} from "../src/core/BeZhasL1Commitment.sol";

/// Ancla de la L2 en L1 con pruebas de fraude verificadas en cadena.
///
/// Estas pruebas vigilan dos cosas en igual medida:
///
///   (a) que un fraude real quede DEMOSTRADO y castigado, y
///   (b) que una acusación falsa NO pase.
///
/// La segunda importa tanto como la primera. Un sistema donde cualquiera puede
/// tumbar un lote honesto no es anti-fraude: es una herramienta de sabotaje, y
/// el secuenciador honesto sería el primero en no querer publicar nada.
contract BeZhasL1CommitmentTest is Test {
    BeZhasL1Commitment internal c;

    address internal admin    = address(this);
    uint256 internal batcherKey = 0xB47C4E;
    address internal batcher;
    address internal outsider = address(0x0157);
    address internal watcher  = address(0xAA7C);

    uint256 internal constant BOND    = 10 ether;
    uint256 internal constant DA_BOND = 1 ether;

    bytes32 internal constant L2_ROOT = bytes32(uint256(0xEF));

    function setUp() public {
        batcher = vm.addr(batcherKey);
        c = new BeZhasL1Commitment(batcher, BOND, DA_BOND);
        c.grantRole(c.CHALLENGER_ROLE(), outsider);
        vm.deal(batcher, 1000 ether);
        vm.deal(watcher, 100 ether);
        vm.deal(outsider, 100 ether);
    }

    receive() external payable {}

    // ── Utilidades: réplica en test del esquema de la plataforma ────────────

    function _leaves(uint256 n, string memory tag) internal pure returns (bytes32[] memory out) {
        out = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) out[i] = sha256(abi.encodePacked(tag, i));
    }

    function _dataHash(bytes32[] memory l) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(l));
    }

    /// Pares ordenados sobre sha256 — mismo esquema que TelemetryAnchor.
    function _root(bytes32[] memory input) internal pure returns (bytes32) {
        uint256 n = input.length;
        if (n == 0) return bytes32(0);
        bytes32[] memory lvl = new bytes32[](n);
        for (uint256 i = 0; i < n; i++) lvl[i] = input[i];
        while (n > 1) {
            uint256 w = 0;
            for (uint256 i = 0; i < n; i += 2) {
                bytes32 a = lvl[i];
                bytes32 b = (i + 1 < n) ? lvl[i + 1] : lvl[i];
                lvl[w++] = a <= b ? sha256(abi.encodePacked(a, b)) : sha256(abi.encodePacked(b, a));
            }
            n = w;
        }
        return lvl[0];
    }

    function _fold(bytes32 pre, bytes32[] memory l) internal pure returns (bytes32 acc) {
        acc = pre;
        for (uint256 i = 0; i < l.length; i++) acc = sha256(abi.encodePacked(acc, l[i]));
    }

    function _parent() internal view returns (bytes32) {
        uint256 n = c.commitmentCount();
        if (n == 0) return bytes32(0);
        (, bytes32 sr, , , , , , , , , , , ) = c.commitments(n - 1);
        return sr;
    }

    /// Publica con los argumentos YA calculados.
    /// @dev Los roots se calculan fuera a propósito: sha256 es un precompilado y
    ///      llamarlo entre `vm.prank` y `propose` consume el prank, con lo que
    ///      la transacción saldría del contrato de test y no del batcher.
    function _propose(
        bytes32 parent, bytes32 state, bytes32 batch, bytes32 data,
        uint64 from, uint64 to, uint32 n
    ) internal returns (uint256) {
        vm.prank(batcher);
        return c.propose{value: BOND}(parent, state, batch, data, L2_ROOT, from, to, n);
    }

    /// Compromiso honesto: raíces coherentes con los datos publicados.
    function _proposeHonest(uint64 from, uint64 to, bytes32[] memory l) internal returns (uint256) {
        bytes32 parent = _parent();
        bytes32 state = _fold(parent, l);
        bytes32 batch = _root(l);
        bytes32 data = _dataHash(l);
        return _propose(parent, state, batch, data, from, to, uint32(l.length));
    }

    function _status(uint256 i) internal view returns (BeZhasL1Commitment.Status s) {
        (, , , , , , , , , , , s, ) = c.commitments(i);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  Publicación e invariantes de cadena
    // ════════════════════════════════════════════════════════════════════════

    function testBatcherPublishesCommitment() public {
        bytes32[] memory l = _leaves(4, "a");
        uint256 i = _proposeHonest(0, 99, l);
        assertEq(i, 0);
        assertEq(c.commitmentCount(), 1);
        assertEq(c.lastCommittedBlock(), 99);
        assertFalse(c.isFinalized(0));
    }

    function testOnlyBatcherCanPropose() public {
        vm.prank(outsider);
        vm.expectRevert();
        c.propose{value: BOND}(bytes32(0), L2_ROOT, L2_ROOT, L2_ROOT, L2_ROOT, 0, 99, 1);
    }

    function testRejectsEmptyStateRoot() public {
        vm.prank(batcher);
        vm.expectRevert("Empty state root");
        c.propose{value: BOND}(bytes32(0), bytes32(0), L2_ROOT, L2_ROOT, L2_ROOT, 0, 99, 1);
    }

    function testRejectsInvertedRange() public {
        vm.prank(batcher);
        vm.expectRevert("Invalid block range");
        c.propose{value: BOND}(bytes32(0), L2_ROOT, L2_ROOT, L2_ROOT, L2_ROOT, 99, 0, 1);
    }

    /// Publicar sin fianza haría gratis mentir, que es justo lo que no puede ser.
    function testRejectsProposalWithoutBond() public {
        vm.prank(batcher);
        vm.expectRevert("Bond below the required amount");
        c.propose{value: BOND - 1}(bytes32(0), L2_ROOT, L2_ROOT, L2_ROOT, L2_ROOT, 0, 99, 1);
    }

    /// Un hueco dejaría bloques L2 sin anclar — donde alguien escondería algo.
    function testRejectsGapBetweenCommitments() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        bytes32 p = _parent();
        vm.prank(batcher);
        vm.expectRevert("Range must be contiguous with the previous commitment");
        c.propose{value: BOND}(p, L2_ROOT, L2_ROOT, L2_ROOT, L2_ROOT, 150, 200, 1);
    }

    function testRejectsOverlappingRange() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        bytes32 p = _parent();
        vm.prank(batcher);
        vm.expectRevert("Range must be contiguous with the previous commitment");
        c.propose{value: BOND}(p, L2_ROOT, L2_ROOT, L2_ROOT, L2_ROOT, 50, 200, 1);
    }

    /// El encadenado del acumulador se comprueba al publicar y no se deja para
    /// una prueba de fraude: comprobarlo aquí es gratis y evita el problema.
    function testRejectsBrokenStateChain() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        vm.prank(batcher);
        vm.expectRevert("Parent state root does not chain with the previous commitment");
        c.propose{value: BOND}(bytes32(uint256(0xDEAD)), L2_ROOT, L2_ROOT, L2_ROOT, L2_ROOT, 100, 199, 1);
    }

    function testAcceptsContiguousChainedRange() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        uint256 i = _proposeHonest(100, 199, _leaves(3, "b"));
        assertEq(i, 1);
        assertEq(c.lastCommittedBlock(), 199);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  Ventana de disputa y fianzas
    // ════════════════════════════════════════════════════════════════════════

    function testCannotFinalizeBeforeWindowCloses() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        vm.expectRevert("Challenge window still open");
        c.finalize(0);
    }

    function testFinalizesAfterWindowAndRefundsBond() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        skip(7 days);
        c.finalize(0);
        assertTrue(c.isFinalized(0));
        assertEq(c.withdrawable(batcher), BOND);

        uint256 before = batcher.balance;
        vm.prank(batcher);
        c.withdraw();
        assertEq(batcher.balance, before + BOND);
    }

    /// Finalizar no es un privilegio: es la consecuencia de que nadie objetara.
    function testAnyoneCanFinalize() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        skip(7 days);
        vm.prank(outsider);
        c.finalize(0);
        assertTrue(c.isFinalized(0));
    }

    function testTimeUntilFinalizableCountsDown() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        assertEq(c.timeUntilFinalizable(0), 7 days);
        skip(3 days);
        assertEq(c.timeUntilFinalizable(0), 4 days);
        skip(4 days);
        assertEq(c.timeUntilFinalizable(0), 0);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PRUEBA 1 — la raíz del lote no corresponde a los datos publicados
    // ════════════════════════════════════════════════════════════════════════

    function testProvesInvalidBatchRoot() public {
        bytes32[] memory l = _leaves(5, "carga");
        bytes32 parent = _parent();

        // Lote deshonesto: publica los datos de verdad pero ancla otra raíz.
        _propose(parent, _fold(parent, l), bytes32(uint256(0xBADBAD)), _dataHash(l), 0, 99, 5);
        assertEq(c.commitmentCount(), 1);

        vm.prank(watcher);
        c.proveInvalidBatchRoot(0, l);

        // El compromiso sale de la cadena vigente y la fianza es del denunciante.
        assertEq(c.commitmentCount(), 0);
        assertEq(c.lastCommittedBlock(), 0);
        assertEq(c.withdrawable(watcher), BOND);
        assertEq(c.fraudCount(), 1);
    }

    /// Anclar un txCount que no cuadra con los datos es la misma mentira por
    /// otra vía: dice "aquí van 5 evidencias" y entrega otra cosa.
    function testProvesInvalidTxCount() public {
        bytes32[] memory l = _leaves(5, "carga");
        bytes32 parent = _parent();
        _propose(parent, _fold(parent, l), _root(l), _dataHash(l), 0, 99, 9);

        vm.prank(watcher);
        c.proveInvalidBatchRoot(0, l);
        assertEq(c.commitmentCount(), 0);
    }

    /// SOLIDEZ: contra un lote honesto la prueba tiene que fallar.
    function testCannotProveFraudOnHonestBatch() public {
        bytes32[] memory l = _leaves(5, "carga");
        _proposeHonest(0, 99, l);

        vm.prank(watcher);
        vm.expectRevert("Batch root matches the published data: no fraud here");
        c.proveInvalidBatchRoot(0, l);
        assertEq(c.commitmentCount(), 1);
    }

    /// SOLIDEZ, y es la propiedad que sostiene todo el diseño: no vale traer
    /// unos datos cualesquiera. Sólo se acepta el preimagen que el propio
    /// secuenciador firmó. Si no, cualquiera tumbaría cualquier lote inventando
    /// una lista que no cuadre.
    function testRejectsFabricatedPreimage() public {
        _proposeHonest(0, 99, _leaves(5, "carga"));

        bytes32[] memory fake = _leaves(5, "inventado");
        vm.prank(watcher);
        vm.expectRevert("Preimage does not match the committed dataHash");
        c.proveInvalidBatchRoot(0, fake);
        assertEq(c.commitmentCount(), 1);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PRUEBA 2 — el acumulador no avanzó según la regla de transición
    // ════════════════════════════════════════════════════════════════════════

    function testProvesInvalidStateRoot() public {
        bytes32[] memory l = _leaves(6, "acc");
        bytes32 parent = _parent();

        _propose(parent, bytes32(uint256(0xC0FFEE)), _root(l), _dataHash(l), 0, 99, 6);

        vm.prank(watcher);
        c.proveInvalidStateRoot(0, l);
        assertEq(c.commitmentCount(), 0);
        assertEq(c.withdrawable(watcher), BOND);
    }

    function testCannotProveStateFraudOnHonestCommitment() public {
        bytes32[] memory l = _leaves(6, "acc");
        _proposeHonest(0, 99, l);

        vm.expectRevert("State root is correct: no fraud here");
        c.proveInvalidStateRoot(0, l);
    }

    /// Reordenar las evidencias cambia el acumulador: el plegado no es
    /// conmutativo, y por eso el orden de los hechos también queda anclado.
    function testStateProofCatchesReordering() public {
        bytes32[] memory l = _leaves(4, "acc");
        bytes32[] memory swapped = new bytes32[](4);
        swapped[0] = l[1]; swapped[1] = l[0]; swapped[2] = l[2]; swapped[3] = l[3];

        bytes32 parent = _parent();
        // Ancla el acumulador del orden equivocado, pero publica el orden real.
        _propose(parent, _fold(parent, swapped), _root(l), _dataHash(l), 0, 99, 4);

        vm.prank(watcher);
        c.proveInvalidStateRoot(0, l);
        assertEq(c.commitmentCount(), 0);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  PRUEBA 3 — censura: prometió incluir una evidencia y la dejó fuera
    // ════════════════════════════════════════════════════════════════════════

    function _sign(bytes32 txHash, uint64 promisedBlock) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(batcherKey, c.inclusionPromiseDigest(txHash, promisedBlock));
        return abi.encodePacked(r, s, v);
    }

    function testProvesCensorship() public {
        bytes32[] memory l = _leaves(4, "incluidas");
        bytes32 excluida = sha256("evidencia-que-incrimina");
        _proposeHonest(0, 99, l); // lote impecable… salvo por lo que falta

        bytes memory sig = _sign(excluida, 50);
        vm.prank(watcher);
        c.proveOmittedTransaction(0, excluida, 50, sig, l);

        assertEq(c.commitmentCount(), 0);
        assertEq(c.withdrawable(watcher), BOND);
        assertEq(c.fraudCount(), 1);
    }

    /// SOLIDEZ: si la evidencia sí está, no hay censura que probar.
    function testCannotClaimCensorshipForIncludedTx() public {
        bytes32[] memory l = _leaves(4, "incluidas");
        _proposeHonest(0, 99, l);

        bytes memory sig = _sign(l[2], 50);
        vm.expectRevert("The transaction is included: no censorship here");
        c.proveOmittedTransaction(0, l[2], 50, sig, l);
    }

    /// SOLIDEZ: sin promesa firmada no hay nada que reclamar. El secuenciador
    /// responde de lo que se comprometió a incluir, no de todo lo que exista.
    function testRejectsCensorshipClaimWithForgedSignature() public {
        bytes32[] memory l = _leaves(4, "incluidas");
        _proposeHonest(0, 99, l);

        bytes32 nunca = sha256("nunca-se-envio");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBEEF, c.inclusionPromiseDigest(nunca, 50));
        vm.expectRevert("Promise not signed by the sequencer");
        c.proveOmittedTransaction(0, nunca, 50, abi.encodePacked(r, s, v), l);
    }

    /// SOLIDEZ: una promesa para el bloque 500 no acusa al lote 0-99.
    function testRejectsCensorshipClaimOutsideRange() public {
        bytes32[] memory l = _leaves(4, "incluidas");
        _proposeHonest(0, 99, l);

        bytes32 otra = sha256("va-en-otro-lote");
        bytes memory sig = _sign(otra, 500);
        vm.expectRevert("The promised block is outside this commitment");
        c.proveOmittedTransaction(0, otra, 500, sig, l);
    }

    /// El dominio EIP-712 ata la firma a ESTE contrato y ESTA cadena: una
    /// promesa emitida en la testnet no sirve para acusar en mainnet.
    function testPromiseIsBoundToThisContract() public {
        bytes32[] memory l = _leaves(4, "incluidas");
        _proposeHonest(0, 99, l);

        BeZhasL1Commitment other = new BeZhasL1Commitment(batcher, BOND, DA_BOND);
        bytes32 excluida = sha256("evidencia");
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(batcherKey, other.inclusionPromiseDigest(excluida, 50));

        vm.expectRevert("Promise not signed by the sequencer");
        c.proveOmittedTransaction(0, excluida, 50, abi.encodePacked(r, s, v), l);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  Disponibilidad de datos — que retener no sea una escapatoria
    // ════════════════════════════════════════════════════════════════════════

    function testWithholdingDataIsPunished() public {
        bytes32[] memory l = _leaves(4, "ocultos");
        _proposeHonest(0, 99, l);

        vm.prank(watcher);
        c.challengeDataAvailability{value: DA_BOND}(0);
        assertEq(uint8(_status(0)), uint8(BeZhasL1Commitment.Status.DA_CHALLENGED));

        // No publica. Vencido el plazo, cae el lote.
        skip(1 days);
        vm.prank(watcher);
        c.resolveDataUnavailable(0);

        assertEq(c.commitmentCount(), 0);
        assertEq(c.withdrawable(watcher), BOND + DA_BOND); // fianza propia + botín
    }

    function testCannotFinalizeWhileDataIsChallenged() public {
        _proposeHonest(0, 99, _leaves(4, "ocultos"));
        vm.prank(watcher);
        c.challengeDataAvailability{value: DA_BOND}(0);
        skip(7 days);
        vm.expectRevert("Not in a finalizable state");
        c.finalize(0);
    }

    /// Responder cuesta al retador su fianza: el reto no puede salir gratis o
    /// se usaría para paralizar a un secuenciador honesto.
    function testAnsweringDataChallengeCostsTheChallengerItsBond() public {
        bytes32[] memory l = _leaves(4, "ocultos");
        _proposeHonest(0, 99, l);

        vm.prank(watcher);
        c.challengeDataAvailability{value: DA_BOND}(0);
        vm.prank(batcher);
        c.answerDataAvailability(0, l);

        assertEq(uint8(_status(0)), uint8(BeZhasL1Commitment.Status.PROPOSED));
        assertEq(c.withdrawable(batcher), DA_BOND);
        assertEq(c.withdrawable(watcher), 0);
    }

    /// Y responder tarde no le sirve para colar el lote: la ventana se reinicia,
    /// porque los datos sólo han estado disponibles a partir de ahora.
    function testAnsweringLateRestartsTheChallengeWindow() public {
        bytes32[] memory l = _leaves(4, "ocultos");
        _proposeHonest(0, 99, l);

        skip(6 days);
        vm.prank(watcher);
        c.challengeDataAvailability{value: DA_BOND}(0);
        vm.prank(batcher);
        c.answerDataAvailability(0, l);

        assertEq(c.timeUntilFinalizable(0), 7 days);
        vm.expectRevert("Challenge window still open");
        c.finalize(0);
    }

    function testCannotAnswerWithWrongData() public {
        _proposeHonest(0, 99, _leaves(4, "ocultos"));
        vm.prank(watcher);
        c.challengeDataAvailability{value: DA_BOND}(0);

        bytes32[] memory otros = _leaves(4, "otros");
        vm.prank(batcher);
        vm.expectRevert("Preimage does not match the committed dataHash");
        c.answerDataAvailability(0, otros);
    }

    function testCannotResolveBeforeResponseWindowCloses() public {
        _proposeHonest(0, 99, _leaves(4, "ocultos"));
        vm.prank(watcher);
        c.challengeDataAvailability{value: DA_BOND}(0);
        vm.expectRevert("Response window still open");
        c.resolveDataUnavailable(0);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  Efecto sobre la cadena: la descendencia de un fraude no sobrevive
    // ════════════════════════════════════════════════════════════════════════

    function testFraudDiscardsAllDescendants() public {
        _proposeHonest(0, 99, _leaves(2, "a"));

        bytes32[] memory bad = _leaves(3, "malo");
        bytes32 parent = _parent();
        _propose(parent, _fold(parent, bad), bytes32(uint256(1)), _dataHash(bad), 100, 199, 3);

        _proposeHonest(200, 299, _leaves(2, "c"));
        _proposeHonest(300, 399, _leaves(2, "d"));
        assertEq(c.commitmentCount(), 4);

        vm.prank(watcher);
        c.proveInvalidBatchRoot(1, bad);

        // Sólo sobrevive el compromiso honesto anterior al fraude.
        assertEq(c.commitmentCount(), 1);
        assertEq(c.lastCommittedBlock(), 99);
        assertFalse(c.isCanonical(1));
    }

    /// Y el secuenciador puede volver a publicar el rango, ya correctamente.
    function testChainResumesAfterFraud() public {
        bytes32[] memory bad = _leaves(3, "malo");
        _propose(bytes32(0), _fold(bytes32(0), bad), bytes32(uint256(1)), _dataHash(bad), 0, 99, 3);
        vm.prank(watcher);
        c.proveInvalidBatchRoot(0, bad);

        uint256 i = _proposeHonest(0, 99, _leaves(3, "bueno"));
        assertEq(i, 0);
        assertEq(c.lastCommittedBlock(), 99);
    }

    /// El rastro del fraude no se borra aunque el compromiso salga de la cadena.
    function testFraudRecordSurvivesTruncation() public {
        bytes32[] memory bad = _leaves(3, "malo");
        _propose(bytes32(0), _fold(bytes32(0), bad), bytes32(uint256(1)), _dataHash(bad), 0, 99, 3);
        vm.prank(watcher);
        c.proveInvalidBatchRoot(0, bad);

        (uint256 idx, , , , uint64 from, uint64 to, address proposer, address challenger, , uint256 slashed, string memory kind, ) =
            c.frauds(0);
        assertEq(idx, 0);
        assertEq(from, 0);
        assertEq(to, 99);
        assertEq(proposer, batcher);
        assertEq(challenger, watcher);
        assertEq(slashed, BOND);
        assertEq(kind, "invalid_batch_root");
    }

    // ════════════════════════════════════════════════════════════════════════
    //  Límites temporales de las pruebas
    // ════════════════════════════════════════════════════════════════════════

    /// Pasada la ventana el lote es firme. Es la hipótesis de seguridad de todo
    /// sistema optimista y conviene que esté escrita en una prueba: hace falta
    /// alguien vigilando dentro del plazo.
    function testCannotProveFraudAfterWindowCloses() public {
        bytes32[] memory bad = _leaves(3, "malo");
        _propose(bytes32(0), _fold(bytes32(0), bad), bytes32(uint256(1)), _dataHash(bad), 0, 99, 3);

        skip(7 days);
        vm.prank(watcher);
        vm.expectRevert("Challenge window closed");
        c.proveInvalidBatchRoot(0, bad);
    }

    function testCannotProveFraudOnFinalized() public {
        bytes32[] memory bad = _leaves(3, "malo");
        _propose(bytes32(0), _fold(bytes32(0), bad), bytes32(uint256(1)), _dataHash(bad), 0, 99, 3);
        skip(7 days);
        c.finalize(0);

        vm.expectRevert("Commitment is closed");
        c.proveInvalidBatchRoot(0, bad);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  Vía de gobernanza — se mantiene, y se mantiene aparte
    // ════════════════════════════════════════════════════════════════════════

    function testDisputeBlocksFinalization() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        vm.prank(outsider);
        c.dispute(0, "l2StateRoot does not match local execution");

        skip(7 days);
        vm.expectRevert("Not in a finalizable state");
        c.finalize(0);
    }

    function testDisputeNeedsReason() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        vm.prank(outsider);
        vm.expectRevert("A dispute needs a reason");
        c.dispute(0, "");
    }

    function testCannotDisputeAfterWindow() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        skip(7 days);
        vm.prank(outsider);
        vm.expectRevert("Challenge window closed");
        c.dispute(0, "too late");
    }

    function testCannotDisputeFinalized() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        skip(7 days);
        c.finalize(0);
        vm.prank(outsider);
        vm.expectRevert("Only a proposed commitment can be disputed");
        c.dispute(0, "already closed");
    }

    /// Sin fraude probado, gobernanza retira el lote pero NO se queda la fianza.
    /// Objetar no es demostrar, y el contrato no las trata igual.
    function testGovernanceRevertRefundsTheBond() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        _proposeHonest(100, 199, _leaves(2, "b"));
        vm.prank(outsider);
        c.dispute(1, "bad l2 root");

        c.revertCommitment(1, "verified off-chain as invalid");
        assertEq(c.lastCommittedBlock(), 99);
        assertEq(c.commitmentCount(), 1);
        assertEq(c.withdrawable(batcher), BOND);
        assertEq(c.fraudCount(), 0);
    }

    function testCannotRevertNonHeadCommitment() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        _proposeHonest(100, 199, _leaves(2, "b"));
        vm.prank(outsider);
        c.dispute(0, "bad root");

        vm.expectRevert("Only the head commitment can be reverted");
        c.revertCommitment(0, "nope");
    }

    function testCannotRevertUndisputed() public {
        _proposeHonest(0, 99, _leaves(2, "a"));
        vm.expectRevert("Only a disputed commitment can be reverted");
        c.revertCommitment(0, "nope");
    }

    // ════════════════════════════════════════════════════════════════════════
    //  Prueba de inclusión
    // ════════════════════════════════════════════════════════════════════════

    function testVerifyInBatchWithTwoLeaves() public {
        bytes32[] memory l = _leaves(2, "ev");
        _proposeHonest(0, 99, l);

        bytes32[] memory proof = new bytes32[](1);
        proof[0] = l[1];
        assertTrue(c.verifyInBatch(0, l[0], proof));
        proof[0] = l[0];
        assertTrue(c.verifyInBatch(0, l[1], proof));
    }

    function testVerifyInBatchRejectsForeignLeaf() public {
        bytes32[] memory l = _leaves(2, "ev");
        _proposeHonest(0, 99, l);

        bytes32[] memory proof = new bytes32[](1);
        proof[0] = l[1];
        assertFalse(c.verifyInBatch(0, sha256("no-estaba"), proof));
    }

    /// Exhibir como evidencia una hoja de un lote desacreditado por fraude sería
    /// justo lo que este contrato existe para impedir.
    function testInclusionProofFailsOnFraudulentBatch() public {
        bytes32[] memory l = _leaves(2, "ev");
        _propose(bytes32(0), bytes32(uint256(0xBAD)), _root(l), _dataHash(l), 0, 99, 2);

        bytes32[] memory proof = new bytes32[](1);
        proof[0] = l[1];
        assertTrue(c.verifyInBatch(0, l[0], proof));

        vm.prank(watcher);
        c.proveInvalidStateRoot(0, l);
        assertFalse(c.verifyInBatch(0, l[0], proof));
    }

    // ════════════════════════════════════════════════════════════════════════
    //  Configuración
    // ════════════════════════════════════════════════════════════════════════

    function testChallengeWindowCannotBeTriviallyShort() public {
        vm.expectRevert("Window too short to be meaningful");
        c.setChallengeWindow(60);
    }

    function testAdminCanShortenWindowWithinReason() public {
        c.setChallengeWindow(1 days);
        _proposeHonest(0, 99, _leaves(2, "a"));
        skip(1 days);
        c.finalize(0);
        assertTrue(c.isFinalized(0));
    }

    function testOnlyAdminSetsBonds() public {
        vm.prank(outsider);
        vm.expectRevert();
        c.setBonds(1, 1);
        c.setBonds(5 ether, 2 ether);
        assertEq(c.proposerBond(), 5 ether);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  Fuzz — el plegado no puede coincidir por casualidad
    // ════════════════════════════════════════════════════════════════════════

    function testFuzzHonestCommitmentIsNeverProvableAsFraud(bytes32 a, bytes32 b, bytes32 d) public {
        bytes32[] memory l = new bytes32[](3);
        l[0] = a; l[1] = b; l[2] = d;
        _proposeHonest(0, 99, l);

        vm.expectRevert("Batch root matches the published data: no fraud here");
        c.proveInvalidBatchRoot(0, l);
        vm.expectRevert("State root is correct: no fraud here");
        c.proveInvalidStateRoot(0, l);
    }
}
