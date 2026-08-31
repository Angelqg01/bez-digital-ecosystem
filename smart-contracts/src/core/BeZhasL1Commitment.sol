// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title BeZhasL1Commitment — ancla de la L2 de BeZhas en Ethereum L1
/// @notice Recibe los compromisos que publica el secuenciador de la L2 y permite
///         DEMOSTRAR EN L1, sin confiar en nadie, que uno de ellos es falso.
///
/// Por qué existe la prueba de fraude
/// ----------------------------------
/// Un ancla sin prueba de fraude sólo dice "BeZhas afirma que esto pasó". Eso no
/// vale ante un auditor, una aseguradora o un juzgado, porque BeZhas es parte
/// interesada. Lo que convierte el ancla en evidencia es que CUALQUIERA pueda
/// demostrar aritméticamente en Ethereum que la afirmación es falsa — y que
/// mentir cueste dinero.
///
/// Este contrato verifica tres fraudes de forma determinista. No hay árbitro, no
/// hay voto, no hay admin: o las cuentas cuadran o no cuadran.
///
///   1. proveInvalidBatchRoot   — la raíz anclada no corresponde a los datos
///                                que el propio secuenciador publicó.
///   2. proveInvalidStateRoot   — el acumulador no avanzó como manda la regla
///                                de transición.
///   3. proveOmittedTransaction — el secuenciador firmó que incluiría una
///                                evidencia y no la incluyó (censura).
///
/// Y un cuarto mecanismo cierra el hueco de "no publico los datos y así nadie
/// puede probar nada": challengeDataAvailability obliga a publicarlos en L1 o
/// pierdes la fianza.
///
/// Sobre qué es verificable y qué no
/// ---------------------------------
/// El estado que este contrato verifica es el ACUMULADOR de evidencias de
/// BeZhas, cuya transición es `acc' = sha256(acc || hoja)`. Esa regla sí cabe
/// en L1: recalcularla para un lote de 100 hojas cuesta menos que una
/// transferencia de ERC-20.
///
/// El campo `l2StateRoot` (la raíz del árbol de Patricia de la EVM de la L2) se
/// ancla como dato INFORMATIVO y NO es verificable aquí: comprobarla exigiría
/// reejecutar la EVM en L1, que es el problema que resuelven los juegos de
/// bisección con verificador de un paso (Cannon/MIPS y similares). Está
/// declarado así a propósito en lugar de dejarlo ambiguo.
///
/// Consecuencia práctica: la evidencia logística — que es lo que el cliente
/// ancla y lo que necesita defender frente a terceros — está cubierta por
/// pruebas completas. La ejecución EVM genérica, no.
contract BeZhasL1Commitment is AccessControl, EIP712 {
    bytes32 public constant BATCHER_ROLE     = keccak256("BATCHER_ROLE");
    bytes32 public constant CHALLENGER_ROLE  = keccak256("CHALLENGER_ROLE");
    bytes32 public constant SEQUENCER_ROLE   = keccak256("SEQUENCER_ROLE");

    /// @dev EIP-712: promesa de inclusión firmada por el secuenciador. Con
    ///      dominio separado, así que una promesa no se puede reutilizar en
    ///      otra cadena ni en otro despliegue de este contrato.
    bytes32 private constant INCLUSION_PROMISE_TYPEHASH =
        keccak256("InclusionPromise(bytes32 txHash,uint64 promisedBlock)");

    enum Status {
        PROPOSED,    // publicado, dentro de la ventana
        FINALIZED,   // ventana cerrada sin objeción
        DISPUTED,    // objetado por gobernanza (NO es prueba de fraude)
        REVERTED,    // retirado por gobernanza
        DA_CHALLENGED // se le exige publicar los datos
    }

    struct Commitment {
        bytes32 parentStateRoot; // acumulador de partida (= stateRoot del anterior)
        bytes32 stateRoot;       // acumulador resultante — VERIFICABLE
        bytes32 batchRoot;       // raíz merkle de las hojas del lote — VERIFICABLE
        bytes32 dataHash;        // keccak256 de las hojas: compromiso de disponibilidad
        bytes32 l2StateRoot;     // raíz MPT de la EVM L2 — INFORMATIVA, no verificable
        uint64  fromBlock;
        uint64  toBlock;
        uint32  txCount;
        uint64  proposedAt;
        address proposer;
        uint256 bond;
        Status  status;
        string  note;            // motivo de disputa / reversión / fraude
    }

    /// Ventana de disputa. Siete días es lo habitual en rollups optimistas:
    /// suficiente para que un verificador honesto detecte y reaccione incluso
    /// con censura temporal, y el motivo por el que las retiradas tardan.
    uint64 public challengeWindow = 7 days;

    /// Plazo para responder a un reto de disponibilidad de datos publicando el
    /// preimagen en L1. Corto a propósito: quien tiene los datos los tiene ya.
    uint64 public daResponseWindow = 1 days;

    /// Fianza que deposita el secuenciador por compromiso. Es lo que hace que
    /// mentir cueste: una prueba de fraude se la lleva entera el denunciante.
    uint256 public proposerBond;

    /// Fianza del retador de disponibilidad. Evita el reto gratuito en masa:
    /// si el secuenciador responde con los datos, se la queda él.
    uint256 public daChallengeBond;

    /// Cadena vigente. Un fraude probado la trunca en el punto malo: los
    /// compromisos posteriores descienden de un estado falso y no pueden
    /// sobrevivir a su antecesor.
    Commitment[] public commitments;

    /// Registro permanente de los fraudes probados. La cadena vigente se trunca,
    /// pero esto NO: borrar el rastro de que alguien mintió sería lo contrario
    /// de lo que hace útil a un ancla de evidencias. Es append-only.
    struct FraudRecord {
        uint256 index;
        bytes32 stateRoot;
        bytes32 batchRoot;
        bytes32 dataHash;
        uint64  fromBlock;
        uint64  toBlock;
        address proposer;
        address challenger;
        uint64  provenAt;
        uint256 slashed;
        string  kind;
        string  note;
    }
    FraudRecord[] public frauds;

    /// Último bloque L2 cubierto por la cadena vigente. Impide huecos y solapes.
    uint64 public lastCommittedBlock;

    /// Reto de disponibilidad abierto por compromiso.
    struct DAChallenge { address challenger; uint64 openedAt; uint256 bond; }
    mapping(uint256 => DAChallenge) public daChallenges;

    /// Pagos pendientes de retirar. Patrón pull: nunca enviamos ether dentro de
    /// la lógica de una prueba, para que un receptor hostil no pueda hacerla
    /// fallar y blindar así un fraude.
    mapping(address => uint256) public withdrawable;

    event CommitmentProposed(
        uint256 indexed index, bytes32 stateRoot, bytes32 batchRoot, bytes32 dataHash,
        uint64 fromBlock, uint64 toBlock, uint32 txCount, address proposer, uint256 bond
    );
    event CommitmentFinalized(uint256 indexed index, bytes32 stateRoot);
    event CommitmentDisputed(uint256 indexed index, address challenger, string reason);
    event CommitmentReverted(uint256 indexed index, string reason);
    event FraudProven(uint256 indexed index, address indexed challenger, string proofKind, uint256 reward);
    event DataAvailabilityChallenged(uint256 indexed index, address indexed challenger);
    event DataAvailabilityAnswered(uint256 indexed index, uint32 leafCount);
    event ChallengeWindowUpdated(uint64 previous, uint64 current);
    event BondsUpdated(uint256 proposerBond, uint256 daChallengeBond);
    event Withdrawn(address indexed account, uint256 amount);

    constructor(address batcher, uint256 proposerBond_, uint256 daChallengeBond_)
        EIP712("BeZhasL1Commitment", "1")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        address b = batcher == address(0) ? msg.sender : batcher;
        _grantRole(BATCHER_ROLE, b);
        // El secuenciador que firma promesas es, por defecto, quien publica.
        _grantRole(SEQUENCER_ROLE, b);
        _grantRole(CHALLENGER_ROLE, msg.sender);
        proposerBond = proposerBond_;
        daChallengeBond = daChallengeBond_;
    }

    // ── Publicación ─────────────────────────────────────────────────────────

    /// @notice El secuenciador publica el compromiso de un rango de bloques L2.
    /// @param parentStateRoot acumulador de partida. Debe encadenar con el
    ///        compromiso vigente anterior; se comprueba aquí en vez de dejarlo
    ///        para una prueba de fraude, porque comprobarlo es gratis.
    /// @param stateRoot acumulador resultante de plegar las hojas del lote.
    /// @param dataHash keccak256(abi.encodePacked(hojas)). Es el compromiso de
    ///        disponibilidad: sin él ninguna prueba de fraude sería sólida,
    ///        porque el secuenciador siempre podría negar los datos aportados.
    function propose(
        bytes32 parentStateRoot,
        bytes32 stateRoot,
        bytes32 batchRoot,
        bytes32 dataHash,
        bytes32 l2StateRoot,
        uint64 fromBlock,
        uint64 toBlock,
        uint32 txCount
    ) external payable onlyRole(BATCHER_ROLE) returns (uint256 index) {
        require(stateRoot != bytes32(0), "Empty state root");
        require(toBlock >= fromBlock, "Invalid block range");
        require(msg.value >= proposerBond, "Bond below the required amount");
        uint256 head = commitments.length;
        require(
            head == 0 || fromBlock == lastCommittedBlock + 1,
            "Range must be contiguous with the previous commitment"
        );
        require(
            parentStateRoot == (head == 0 ? bytes32(0) : commitments[head - 1].stateRoot),
            "Parent state root does not chain with the previous commitment"
        );

        index = head;
        commitments.push(Commitment({
            parentStateRoot: parentStateRoot,
            stateRoot: stateRoot,
            batchRoot: batchRoot,
            dataHash: dataHash,
            l2StateRoot: l2StateRoot,
            fromBlock: fromBlock,
            toBlock: toBlock,
            txCount: txCount,
            proposedAt: uint64(block.timestamp),
            proposer: msg.sender,
            bond: msg.value,
            status: Status.PROPOSED,
            note: ""
        }));
        lastCommittedBlock = toBlock;

        emit CommitmentProposed(
            index, stateRoot, batchRoot, dataHash, fromBlock, toBlock, txCount, msg.sender, msg.value
        );
    }

    /// @notice Cierra un compromiso pasada la ventana sin impugnación y devuelve
    ///         la fianza.
    /// @dev Cualquiera puede llamarla: finalizar no es un privilegio, es el
    ///      resultado de que nadie haya objetado a tiempo.
    function finalize(uint256 index) external {
        require(index < commitments.length, "Commitment is not canonical");
        Commitment storage c = commitments[index];
        require(c.status == Status.PROPOSED, "Not in a finalizable state");
        require(
            block.timestamp >= c.proposedAt + challengeWindow,
            "Challenge window still open"
        );
        c.status = Status.FINALIZED;
        uint256 bond = c.bond;
        c.bond = 0;
        if (bond > 0) withdrawable[c.proposer] += bond;
        emit CommitmentFinalized(index, c.stateRoot);
    }

    // ── Pruebas de fraude: verificadas en L1, sin árbitro ────────────────────

    /// @notice Demuestra que la raíz del lote no corresponde a los datos que el
    ///         propio secuenciador se comprometió a publicar.
    /// @dev Solidez: sólo se acepta el preimagen cuyo keccak256 coincide con el
    ///      `dataHash` que firmó el secuenciador. No es "la palabra del
    ///      denunciante contra la suya": son SUS datos contra SU raíz. Si no
    ///      cuadran, se contradijo a sí mismo, y eso L1 lo ve sin ayuda.
    function proveInvalidBatchRoot(uint256 index, bytes32[] calldata leaves) external {
        Commitment storage c = _challengeable(index);
        _requirePreimage(c, leaves);

        require(
            leaves.length != c.txCount || _merkleRoot(leaves) != c.batchRoot,
            "Batch root matches the published data: no fraud here"
        );

        _punish(index, "invalid_batch_root", "Batch root does not match the committed data");
    }

    /// @notice Demuestra que el acumulador no avanzó según la regla de
    ///         transición `acc' = sha256(acc || hoja)`.
    /// @dev Ésta es la prueba de validez de estado propiamente dicha. Se puede
    ///      hacer de una sola vez, sin juego de bisección, porque la transición
    ///      de BeZhas es un plegado de hashes y no una ejecución EVM: replegar
    ///      100 hojas en L1 cuesta calderilla. Montar una bisección para esto
    ///      sería complejidad sin contrapartida.
    function proveInvalidStateRoot(uint256 index, bytes32[] calldata leaves) external {
        Commitment storage c = _challengeable(index);
        _requirePreimage(c, leaves);

        require(_fold(c.parentStateRoot, leaves) != c.stateRoot, "State root is correct: no fraud here");

        _punish(index, "invalid_state_root", "State root does not follow from the committed data");
    }

    /// @notice Demuestra que el secuenciador firmó una promesa de inclusión y
    ///         luego no incluyó la evidencia. Censura, probada en Ethereum.
    /// @dev Es la garantía que de verdad le importa a un cliente institucional:
    ///      "me diste acuse de recibo de mi evidencia y después la tiraste".
    ///      Sin esto, un secuenciador puede publicar lotes impecables y aun así
    ///      hacer desaparecer selectivamente lo que le incrimina — y todas las
    ///      demás pruebas seguirían pasando.
    function proveOmittedTransaction(
        uint256 index,
        bytes32 txHash,
        uint64 promisedBlock,
        bytes calldata signature,
        bytes32[] calldata leaves
    ) external {
        Commitment storage c = _challengeable(index);
        _requirePreimage(c, leaves);

        require(
            promisedBlock >= c.fromBlock && promisedBlock <= c.toBlock,
            "The promised block is outside this commitment"
        );

        address signer = ECDSA.recover(
            _hashTypedDataV4(keccak256(abi.encode(INCLUSION_PROMISE_TYPEHASH, txHash, promisedBlock))),
            signature
        );
        require(hasRole(SEQUENCER_ROLE, signer), "Promise not signed by the sequencer");

        for (uint256 i = 0; i < leaves.length; i++) {
            require(leaves[i] != txHash, "The transaction is included: no censorship here");
        }

        _punish(index, "omitted_transaction", "Promised evidence was excluded from the batch");
    }

    // ── Disponibilidad de datos ─────────────────────────────────────────────

    /// @notice Exige al secuenciador que publique en L1 los datos del lote.
    /// @dev Cierra el agujero evidente: si no publicas los datos, nadie puede
    ///      construir ninguna de las pruebas anteriores. Retener datos deja de
    ///      ser una salida y pasa a ser, en sí mismo, causa de sanción.
    function challengeDataAvailability(uint256 index) external payable {
        Commitment storage c = _challengeable(index);
        require(daChallenges[index].challenger == address(0), "Already challenged");
        require(msg.value >= daChallengeBond, "Challenge bond below the required amount");

        daChallenges[index] = DAChallenge(msg.sender, uint64(block.timestamp), msg.value);
        c.status = Status.DA_CHALLENGED;
        emit DataAvailabilityChallenged(index, msg.sender);
    }

    /// @notice El secuenciador responde publicando el preimagen en L1.
    /// @dev Responder no le exonera: al contrario, deja los datos al alcance de
    ///      todos para que cualquiera ejecute las pruebas de fraude. Su premio
    ///      por responder es sólo quedarse la fianza del retador.
    function answerDataAvailability(uint256 index, bytes32[] calldata leaves) external {
        Commitment storage c = commitments[index];
        require(c.status == Status.DA_CHALLENGED, "No open data availability challenge");
        _requirePreimage(c, leaves);

        DAChallenge memory ch = daChallenges[index];
        delete daChallenges[index];
        c.status = Status.PROPOSED;
        if (ch.bond > 0) withdrawable[c.proposer] += ch.bond;

        // La ventana vuelve a empezar. Los datos acaban de estar disponibles y
        // sin esto el secuenciador tendría una jugada limpia: retenerlos hasta
        // el último día, publicarlos cuando ya no da tiempo a comprobarlos y
        // finalizar un lote que nadie ha podido revisar.
        c.proposedAt = uint64(block.timestamp);

        emit DataAvailabilityAnswered(index, uint32(leaves.length));
    }

    /// @notice Vencido el plazo sin publicar los datos, el compromiso cae.
    function resolveDataUnavailable(uint256 index) external {
        Commitment storage c = commitments[index];
        require(c.status == Status.DA_CHALLENGED, "No open data availability challenge");
        DAChallenge memory ch = daChallenges[index];
        require(block.timestamp >= ch.openedAt + daResponseWindow, "Response window still open");

        delete daChallenges[index];
        if (ch.bond > 0) withdrawable[ch.challenger] += ch.bond; // se le devuelve su fianza
        _punishTo(index, ch.challenger, "data_unavailable", "Sequencer withheld the batch data");
    }

    // ── Vía de gobernanza (más débil, y conviene no confundirla) ─────────────

    /// @notice Objeción razonada que detiene la finalización.
    /// @dev Esto NO es una prueba de fraude: es el asidero para lo que L1 no
    ///      puede verificar por sí sola — señaladamente `l2StateRoot`. Requiere
    ///      rol y su resolución la decide gobernanza. Se mantiene separada de
    ///      las pruebas precisamente para que nadie confunda "alguien objetó"
    ///      con "quedó demostrado".
    function dispute(uint256 index, string calldata reason) external onlyRole(CHALLENGER_ROLE) {
        Commitment storage c = commitments[index];
        require(c.status == Status.PROPOSED, "Only a proposed commitment can be disputed");
        require(block.timestamp < c.proposedAt + challengeWindow, "Challenge window closed");
        require(bytes(reason).length > 0, "A dispute needs a reason");

        c.status = Status.DISPUTED;
        c.note = reason;
        emit CommitmentDisputed(index, msg.sender, reason);
    }

    /// @notice Gobernanza retira un compromiso objetado. Devuelve la fianza:
    ///         sin fraude probado no hay motivo para quedársela.
    function revertCommitment(uint256 index, string calldata reason)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        Commitment storage c = commitments[index];
        require(c.status == Status.DISPUTED, "Only a disputed commitment can be reverted");
        require(index == commitments.length - 1, "Only the head commitment can be reverted");

        c.status = Status.REVERTED;
        c.note = reason;
        uint256 bond = c.bond;
        c.bond = 0;
        if (bond > 0) withdrawable[c.proposer] += bond;
        emit CommitmentReverted(index, reason);
        _truncateTo(index);
    }

    // ── Interno ─────────────────────────────────────────────────────────────

    /// Un compromiso es impugnable mientras sea canónico y no esté finalizado.
    function _challengeable(uint256 index) internal view returns (Commitment storage c) {
        require(index < commitments.length, "Commitment is not canonical");
        c = commitments[index];
        require(
            c.status == Status.PROPOSED || c.status == Status.DISPUTED || c.status == Status.DA_CHALLENGED,
            "Commitment is closed"
        );
        require(block.timestamp < c.proposedAt + challengeWindow, "Challenge window closed");
    }

    function _requirePreimage(Commitment storage c, bytes32[] calldata leaves) internal view {
        require(
            keccak256(abi.encodePacked(leaves)) == c.dataHash,
            "Preimage does not match the committed dataHash"
        );
    }

    function _punish(uint256 index, string memory kind, string memory note) internal {
        _punishTo(index, msg.sender, kind, note);
    }

    /// Fraude probado: la fianza entera va al denunciante y la cadena retrocede.
    /// @dev Íntegra y no a medias porque estas pruebas son deterministas: no se
    ///      puede denunciar en falso, así que no hay griefing que desincentivar,
    ///      y sí conviene que salga a cuenta vigilar.
    function _punishTo(uint256 index, address beneficiary, string memory kind, string memory note) internal {
        Commitment storage c = commitments[index];

        uint256 reward = c.bond;
        c.bond = 0;
        if (reward > 0) withdrawable[beneficiary] += reward;

        // El compromiso desaparece de la cadena vigente pero queda aquí para
        // siempre, con nombre y apellidos de quién lo publicó.
        frauds.push(FraudRecord({
            index: index,
            stateRoot: c.stateRoot,
            batchRoot: c.batchRoot,
            dataHash: c.dataHash,
            fromBlock: c.fromBlock,
            toBlock: c.toBlock,
            proposer: c.proposer,
            challenger: beneficiary,
            provenAt: uint64(block.timestamp),
            slashed: reward,
            kind: kind,
            note: note
        }));

        _truncateTo(index);
        emit FraudProven(index, beneficiary, kind, reward);
    }

    /// Descarta el compromiso `index` y todos los posteriores: descienden de un
    /// estado que resultó falso, así que no pueden sobrevivirlo.
    /// @dev Truncar el array es O(1) y deja la cadena vigente sin huecos, que es
    ///      la propiedad de la que dependen `propose` y `verifyInBatch`. Marcar
    ///      los descendientes uno a uno costaría gas no acotado, y ése es
    ///      exactamente el fallo que un secuenciador explotaría: publicar lotes
    ///      hasta que probar el fraude no quepa en un bloque. El rastro no se
    ///      pierde: queda en `frauds` y en los eventos CommitmentProposed.
    function _truncateTo(uint256 index) internal {
        assembly { sstore(commitments.slot, index) }
        lastCommittedBlock = index == 0 ? 0 : commitments[index - 1].toBlock;
    }

    /// Mismo esquema de pares ordenados que TelemetryAnchor y que el batcher de
    /// eventos logísticos: una sola implementación de prueba sirve en los tres.
    function _merkleRoot(bytes32[] calldata input) internal pure returns (bytes32) {
        uint256 n = input.length;
        if (n == 0) return bytes32(0);
        bytes32[] memory level = input;
        while (n > 1) {
            uint256 w = 0;
            for (uint256 i = 0; i < n; i += 2) {
                bytes32 a = level[i];
                bytes32 b = (i + 1 < n) ? level[i + 1] : level[i];
                level[w++] = a <= b ? sha256(abi.encodePacked(a, b)) : sha256(abi.encodePacked(b, a));
            }
            n = w;
        }
        return level[0];
    }

    /// Regla de transición del acumulador de evidencias.
    function _fold(bytes32 pre, bytes32[] calldata leaves) internal pure returns (bytes32 acc) {
        acc = pre;
        for (uint256 i = 0; i < leaves.length; i++) {
            acc = sha256(abi.encodePacked(acc, leaves[i]));
        }
    }

    // ── Cobros ──────────────────────────────────────────────────────────────

    function withdraw() external {
        uint256 amount = withdrawable[msg.sender];
        require(amount > 0, "Nothing to withdraw");
        withdrawable[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    // ── Configuración ───────────────────────────────────────────────────────

    function setChallengeWindow(uint64 seconds_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(seconds_ >= 1 hours, "Window too short to be meaningful");
        emit ChallengeWindowUpdated(challengeWindow, seconds_);
        challengeWindow = seconds_;
    }

    function setBonds(uint256 proposerBond_, uint256 daChallengeBond_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        proposerBond = proposerBond_;
        daChallengeBond = daChallengeBond_;
        emit BondsUpdated(proposerBond_, daChallengeBond_);
    }

    function setDaResponseWindow(uint64 seconds_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(seconds_ >= 1 hours, "Window too short to be meaningful");
        daResponseWindow = seconds_;
    }

    // ── Vistas ──────────────────────────────────────────────────────────────

    function commitmentCount() external view returns (uint256) {
        return commitments.length;
    }

    function fraudCount() external view returns (uint256) {
        return frauds.length;
    }

    /// @notice Vigente: sigue formando parte de la cadena. Un fraude probado
    ///         saca de aquí al compromiso y a toda su descendencia.
    function isCanonical(uint256 index) public view returns (bool) {
        return index < commitments.length;
    }

    function isFinalized(uint256 index) external view returns (bool) {
        return index < commitments.length && commitments[index].status == Status.FINALIZED;
    }

    /// @notice Segundos que faltan para poder finalizar. 0 si ya se puede.
    function timeUntilFinalizable(uint256 index) external view returns (uint64) {
        if (index >= commitments.length) return 0;
        Commitment storage c = commitments[index];
        if (c.status != Status.PROPOSED) return 0;
        uint64 ready = c.proposedAt + challengeWindow;
        return block.timestamp >= ready ? 0 : ready - uint64(block.timestamp);
    }

    /// @notice Verifica que una hoja pertenece al lote de un compromiso vigente.
    /// @dev Exige que sea canónico: probar inclusión en un lote huérfano por
    ///      fraude sería exhibir como evidencia justo lo que quedó desacreditado.
    function verifyInBatch(
        uint256 index,
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (bool) {
        if (!isCanonical(index)) return false;
        bytes32 acc = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            acc = acc <= proof[i]
                ? sha256(abi.encodePacked(acc, proof[i]))
                : sha256(abi.encodePacked(proof[i], acc));
        }
        return acc == commitments[index].batchRoot;
    }

    /// @notice Digest EIP-712 de una promesa de inclusión, para que el
    ///         secuenciador firme exactamente lo que este contrato verificará.
    function inclusionPromiseDigest(bytes32 txHash, uint64 promisedBlock) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(INCLUSION_PROMISE_TYPEHASH, txHash, promisedBlock)));
    }
}
