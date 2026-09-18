'use strict';

/**
 * txOrchestrator — el ciclo de vida de una operación con fondos.
 *
 *   CREADA → VALIDADA → SIMULADA → RIESGO → POLÍTICA
 *        → ready (el cliente firma)          [custodia propia, permitida]
 *        → awaiting_approval → approved      [aprobación firmada]
 *        → executing → broadcast | dispatched | awaiting_manual_execution
 *        → denied | rejected | expired | failed | failed_needs_review
 *
 * Nunca de CREADA a FIRMADA (§47). Cada transición que importa deja rastro en
 * la auditoría de seguridad.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA EJECUCIÓN VUELVE A PREGUNTAR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Entre aprobar y ejecutar pasa tiempo: el cliente puede haber gastado su
 * límite diario con otras operaciones, alguien puede haber activado el kill
 * switch o la wallet puede haberse quedado sin saldo. `ejecutar` repite la
 * simulación, el riesgo y la política con datos frescos. Si ahora se deniega,
 * no sale. Si ahora exige MÁS aprobaciones que las que se dieron, vuelve a
 * aprobación. Si exige las mismas o menos, las firmas recibidas siguen
 * cubriéndola y se usa la política que se firmó.
 *
 * Dependencias inyectables: el orquestador no sabe de Postgres ni de HTTP, y se
 * prueba entero con dobles.
 */

const crypto = require('crypto');
const { ethers } = require('ethers');

const txIntent = require('./txIntent');
const { evaluarRiesgo } = require('./txRiskEngine');
const { evaluarPolitica, resolverProveedor } = require('./txPolicyEngine');
const { CRYPTO_ASSETS } = require('../config/tx-rails');
const { getEntitlements } = require('../config/plan-entitlements');
const { TxError } = require('./txErrors');

const ESTADOS_TERMINALES = new Set(['denied', 'rejected', 'expired', 'failed', 'broadcast', 'dispatched']);

function dependenciasPorDefecto() {
    return {
        repo: require('./txRepository'),
        killSwitch: require('./killSwitch'),
        auditoria: require('./securityAudit'),
        aprobacion: require('./txApproval'),
        simulador: require('./txSimulator'),
        quorumPara: require('./rpcQuorum').quorumPara,
        firmante: require('./txSignerClient'),
        fiat: require('./fiatPayout').adaptadorPara,
        fx: require('./fxService').getEurUsdRate,
        entitlementsPara: getEntitlements,
        env: process.env,
        ahora: () => new Date(),
    };
}

function crearOrquestador(inyectadas = {}) {
    const d = { ...dependenciasPorDefecto(), ...inyectadas };
    const env = d.env;

    const tesoreria = (chainId) => env[`TX_TREASURY_ADDRESS_${chainId}`] || env.TX_TREASURY_ADDRESS || null;
    const expirada = (row) => Date.parse(row.intent.expiresAt) <= d.ahora().getTime();

    // ── Contexto ─────────────────────────────────────────────────────────────

    async function importeEnEuros(intent) {
        const desdeUsd = async (usd) => {
            const { rate } = await d.fx({ fallback: Number(env.EUR_USD_RATE) || undefined });
            return usd / rate;
        };
        try {
            if (intent.asset === 'EUR') return Number(intent.amount);
            if (intent.asset === 'USD') return await desdeUsd(Number(intent.amount));
            if (CRYPTO_ASSETS[intent.asset]?.estable === 'USD') return await desdeUsd(Number(intent.amount));
            const precio = await d.repo.precioToken(intent.asset);
            const ventanaMs = (Number(env.ORACLE_FRESHNESS_WINDOW_S) || 900) * 1000;
            if (!precio?.updatedAt || d.ahora().getTime() - new Date(precio.updatedAt).getTime() > ventanaMs) return null;
            return await desdeUsd(Number(intent.amount) * precio.priceUsd);
        } catch {
            return null;
        }
    }

    async function nivelVerificacion(intent, app) {
        if (intent.source.type === 'bezhas_treasury') return 2; // BeZhas es la parte que paga
        const kyb = await d.repo.kybNivel(app.enterpriseId);
        if (intent.source.type === 'evm_address') return Math.max(kyb, await d.repo.kycNivel(intent.source.value));
        if (intent.rail === 'fiat_to_crypto') return Math.max(kyb, await d.repo.kycNivel(intent.destination.value));
        return kyb;
    }

    async function simular(intent, proveedor) {
        if (intent.rail === 'crypto_transfer') {
            const desde = intent.custody === 'self' ? intent.source.value : tesoreria(intent.chainId);
            if (!desde) return { ok: false, motivo: 'TREASURY_NOT_CONFIGURED' };
            return d.simulador.simularCripto({
                intent, desde, quorum: d.quorumPara(intent.chainId), forkUrl: env[`SIMULATOR_FORK_URL_${intent.chainId}`],
            });
        }
        return d.simulador.simularFiat({ intent, adaptador: proveedor ? d.fiat(proveedor.id, env) : null });
    }

    /** Todo lo que decide: riesgo + política sobre datos frescos. */
    async function evaluar(intent, intentHash, { app, agente, plan, excluirId = null }) {
        const operaciones = d.entitlementsPara(plan).operaciones;
        const proveedor = resolverProveedor(intent, env);
        const [ks, kyc, importeEur, destino, simulacion] = await Promise.all([
            d.killSwitch.estadoEfectivo({ appId: app.id, rail: intent.rail }),
            nivelVerificacion(intent, app),
            importeEnEuros(intent),
            d.repo.destino({ appId: app.id, type: intent.destination.type, value: intent.destination.value }),
            simular(intent, proveedor),
        ]);
        const uso = await d.repo.uso({
            appId: app.id, rail: intent.rail, agentId: agente?.agentId || null,
            umbralEur: operaciones?.rails?.[intent.rail]?.aprobacionDesdeEur ?? null, excluirId,
        });
        const riesgo = evaluarRiesgo(intent, {
            importeEur,
            destinoConocido: destino.conocido,
            destinoRecienteHoras: destino.horasDesdeAlta,
            operacionesUltimaHora: uso.operacionesUltimaHora,
            mediaEur30d: uso.mediaEur30d,
            cercaDeUmbral24h: uso.cercaDeUmbral24h,
            simulacion,
            verificacionBeneficiario: simulacion?.verificacionBeneficiario ?? null,
        }, env);
        const politica = evaluarPolitica({
            intent, intentHash, app, agente, operaciones, kycNivel: kyc, uso, importeEur,
            destino, proveedor, riesgo, killSwitch: ks,
        });
        return { politica, riesgo, simulacion, importeEur, destino, proveedor, killSwitch: ks };
    }

    // ── Vista ────────────────────────────────────────────────────────────────

    function paraFirma(row) {
        return { id: row.id, app_id: row.app_id, intent: row.intent, intent_hash: row.intent_hash, policy_hash: row.policy_hash };
    }

    function vista(row, extra = {}) {
        const i = row.intent;
        const sim = row.simulation || null;
        return {
            id: row.id,
            estado: row.status,
            decision: row.decision,
            carril: row.rail,
            custodia: row.custody,
            importe: i.amount,
            activo: i.asset,
            activoDestino: i.targetAsset || undefined,
            red: i.network || undefined,
            destino: { tipo: i.destination.type, valor: i.destination.value, nombre: i.destination.name || null },
            importeEur: row.amount_eur === null || row.amount_eur === undefined ? null : Number(row.amount_eur),
            motivos: row.policy?.motivos || [],
            aprobacionesRequeridas: row.required_approvals,
            riesgo: { nivel: row.risk?.nivel, factores: row.risk?.factores || [] },
            simulacion: sim ? {
                ok: sim.ok, motivo: sim.motivo, efectos: sim.efectos, gasEstimado: sim.gasEstimado,
                verificacionBeneficiario: sim.verificacionBeneficiario, discrepancia: sim.discrepancia,
            } : null,
            txSinFirmar: row.status === 'ready' ? row.tx_request : undefined,
            txHash: row.tx_hash || undefined,
            referenciaProveedor: row.provider_ref || undefined,
            ejecucion: row.execution || undefined,
            intentHash: row.intent_hash,
            policyHash: row.policy_hash,
            caduca: i.expiresAt,
            aprobacion: row.status === 'awaiting_approval'
                ? { datosTipados: d.aprobacion.datosTipados(paraFirma(row), 'APPROVE') }
                : undefined,
            ...extra,
        };
    }

    async function cargarPropia(id, app) {
        const row = await d.repo.obtener(id);
        const admin = (app?.scopes || []).includes('admin');
        // Una intención de otro cliente es indistinguible de una inexistente.
        if (!row || (!admin && String(row.app_id) !== String(app?.id))) {
            throw new TxError('INTENT_NOT_FOUND', 404, 'Intención no encontrada.');
        }
        return row;
    }

    // ── Crear ────────────────────────────────────────────────────────────────

    async function crearIntencion({ entrada, app, agente = null, plan, canal = 'api' }) {
        if (!app?.id) throw new TxError('API_KEY_REQUIRED', 401, 'Las operaciones con fondos exigen api-key.');
        const parseada = txIntent.parsear(entrada);
        const huella = txIntent.huellaPeticion(entrada);

        const previa = await d.repo.buscarPorIdempotencia(app.id, parseada.idempotencyKey);
        if (previa) {
            if (previa.request_fingerprint !== huella) {
                throw new TxError('IDEMPOTENCY_KEY_REUSED', 409, 'Esa clave de idempotencia ya se usó con otra operación.');
            }
            return vista(previa, { idempotente: true });
        }

        const intent = txIntent.normalizar(parseada, {
            appId: app.id, enterpriseId: app.enterpriseId, agentId: agente?.agentId, ahora: d.ahora(), env,
        });
        const intentHash = txIntent.hashIntencion(intent);
        const e = await evaluar(intent, intentHash, { app, agente, plan });

        let estado;
        let txRequest = null;
        if (e.politica.decision === 'DENY') {
            estado = 'denied';
        } else if (e.politica.decision === 'REQUIRE_APPROVAL') {
            estado = 'awaiting_approval';
        } else if (intent.custody === 'self') {
            estado = 'ready';
            txRequest = e.simulacion?.txSinFirmar || null;
        } else {
            estado = 'approved';
        }

        const fila = {
            id: crypto.randomUUID(),
            app_id: app.id,
            agent_id: agente?.agentId || null,
            idempotency_key: intent.idempotencyKey,
            request_fingerprint: huella,
            intent,
            intent_hash: intentHash,
            rail: intent.rail,
            custody: intent.custody,
            amount_eur: e.importeEur === null ? null : Math.round(e.importeEur * 100) / 100,
            status: estado,
            decision: e.politica.decision,
            required_approvals: e.politica.requiredApprovals,
            policy: { ...e.politica, plan, proveedor: e.proveedor?.id || null, canal },
            risk: e.riesgo,
            simulation: e.simulacion,
            policy_hash: e.politica.policyHash,
            tx_request: txRequest,
            expires_at: intent.expiresAt,
        };

        let row = await d.repo.insertar(fila);
        if (!row) {
            // Carrera con la misma clave: gana la primera, esta devuelve aquélla.
            row = await d.repo.buscarPorIdempotencia(app.id, intent.idempotencyKey);
            if (!row || row.request_fingerprint !== huella) {
                throw new TxError('IDEMPOTENCY_KEY_REUSED', 409, 'Esa clave de idempotencia ya se usó con otra operación.');
            }
            return vista(row, { idempotente: true });
        }

        if (!e.destino.conocido && e.politica.decision !== 'DENY') {
            await d.repo.registrarDestino({
                appId: app.id, type: intent.destination.type, value: intent.destination.value,
                name: intent.destination.name || null, country: intent.destination.country || null,
                enfriamientoHoras: Number(env.TX_DESTINATION_COOLING_HOURS) || 24,
            });
        }

        if (e.riesgo.nivel === 'CRITICAL') {
            // Un riesgo crítico no es sólo esta operación: el cliente pasa a
            // SUSPICIOUS hasta que alguien lo revise.
            await d.killSwitch.elevar({
                scope: `tenant:${app.id}`, estado: 'SUSPICIOUS',
                motivo: `Riesgo crítico en la intención ${row.id}`, actor: 'risk-engine',
            }).catch(() => {});
        }

        await d.auditoria.registrar({
            eventType: 'intent.created', appId: app.id, agentId: agente?.agentId || null, actor: canal, intentId: row.id,
            payload: {
                rail: intent.rail, custody: intent.custody, asset: intent.asset, amount: intent.amount,
                destination: `${intent.destination.type}:${intent.destination.value}`, network: intent.network,
                decision: e.politica.decision, requiredApprovals: e.politica.requiredApprovals,
                motivos: e.politica.motivos.map((m) => m.code), riesgo: e.riesgo.nivel,
                intentHash, policyHash: e.politica.policyHash,
            },
        });

        return vista(row);
    }

    // ── Consultar ────────────────────────────────────────────────────────────

    async function obtener({ id, app }) {
        const row = await cargarPropia(id, app);
        if (!ESTADOS_TERMINALES.has(row.status) && row.status !== 'executing' && expirada(row)) {
            const caducada = await d.repo.actualizar(id, { status: 'expired' }, { siEstado: row.status });
            return vista(caducada || row);
        }
        return vista(row);
    }

    // ── Aprobar ──────────────────────────────────────────────────────────────

    async function aprobar({ id, app, firma, decision = 'APPROVE' }) {
        const row = await cargarPropia(id, app);
        if (row.status !== 'awaiting_approval') {
            throw new TxError('INTENT_NOT_AWAITING_APPROVAL', 409, `La intención está en «${row.status}».`);
        }
        if (expirada(row)) {
            await d.repo.actualizar(id, { status: 'expired' }, { siEstado: 'awaiting_approval' });
            throw new TxError('INTENT_EXPIRED', 410, 'La intención caducó: créala de nuevo.');
        }

        let direccion;
        try {
            direccion = d.aprobacion.recuperarAprobador(paraFirma(row), decision, firma);
        } catch (err) {
            throw new TxError(err.code || 'APPROVAL_SIGNATURE_INVALID', 400, err.message);
        }
        if (!(await d.aprobacion.aprobadorValido(direccion, paraFirma(row)))) {
            await d.auditoria.registrar({
                eventType: 'approval.rejected_unauthorized', appId: row.app_id, actor: direccion, intentId: id,
                payload: { decision },
            });
            throw new TxError('APPROVER_NOT_AUTHORIZED', 403, 'Esa firma no es de un aprobador autorizado para esta operación.');
        }
        if (!(await d.repo.insertarAprobacion({ intentId: id, address: direccion, decision, signature: firma }))) {
            throw new TxError('APPROVAL_DUPLICATE', 409, 'Este aprobador ya firmó esta intención.');
        }
        await d.auditoria.registrar({
            eventType: `approval.${decision.toLowerCase()}`, appId: row.app_id, actor: direccion, intentId: id,
            payload: { intentHash: row.intent_hash, policyHash: row.policy_hash },
        });

        if (decision === 'REJECT') {
            const rechazada = await d.repo.actualizar(id, { status: 'rejected' }, { siEstado: 'awaiting_approval' });
            return vista(rechazada || row);
        }

        const firmas = await d.repo.aprobaciones(id);
        const distintas = new Set(firmas.filter((f) => f.decision === 'APPROVE').map((f) => f.approver_address.toLowerCase()));
        if (distintas.size < row.required_approvals) {
            return vista(row, { aprobacionesRecibidas: distintas.size });
        }
        const cambios = row.custody === 'self'
            ? { status: 'ready', tx_request: row.simulation?.txSinFirmar || null }
            : { status: 'approved' };
        const aprobada = await d.repo.actualizar(id, cambios, { siEstado: 'awaiting_approval' });
        return vista(aprobada || row, { aprobacionesRecibidas: distintas.size });
    }

    // ── Ejecutar ─────────────────────────────────────────────────────────────

    async function ejecutar({ id, app, agente = null, plan }) {
        if (agente && !agente.canExecute) {
            throw new TxError('AGENT_CANNOT_EXECUTE', 403, 'Este agente puede preparar operaciones, no ejecutarlas.');
        }
        const row = await cargarPropia(id, app);
        if (row.custody === 'self') {
            throw new TxError('SELF_CUSTODY', 409, 'Esta operación la firma tu propia wallet: usa txSinFirmar.');
        }
        if (row.status !== 'approved') {
            throw new TxError('INTENT_NOT_APPROVED', 409, `La intención está en «${row.status}».`);
        }
        if (expirada(row)) {
            await d.repo.actualizar(id, { status: 'expired' }, { siEstado: 'approved' });
            throw new TxError('INTENT_EXPIRED', 410, 'La intención caducó: créala de nuevo.');
        }

        const re = await evaluar(row.intent, row.intent_hash, { app, agente, plan: plan || row.policy?.plan, excluirId: id });
        if (['LOCKDOWN', 'UNKNOWN'].includes(re.killSwitch.estado)) {
            throw new TxError('LOCKDOWN', 423, 'Operativa bloqueada por el kill switch.');
        }
        if (re.politica.decision === 'DENY') {
            await d.repo.actualizar(id, {
                status: 'denied', error_code: re.politica.motivos[0]?.code || 'POLICY_DENIED',
                policy: { ...row.policy, reevaluacion: re.politica },
            }, { siEstado: 'approved' });
            throw new TxError('POLICY_DENIED_AT_EXECUTION', 422, 'La política deniega ahora esta operación.', re.politica.motivos);
        }
        if (re.politica.requiredApprovals > row.required_approvals) {
            await d.repo.actualizar(id, {
                status: 'awaiting_approval', decision: re.politica.decision,
                required_approvals: re.politica.requiredApprovals, policy_hash: re.politica.policyHash,
                policy: { ...re.politica, plan: row.policy?.plan, proveedor: row.policy?.proveedor, canal: row.policy?.canal },
            }, { siEstado: 'approved' });
            throw new TxError('POLICY_CHANGED', 409, 'La política exige ahora más aprobaciones: vuelve a aprobación.');
        }

        const reclamada = await d.repo.actualizar(id, { status: 'executing' }, { siEstado: 'approved' });
        if (!reclamada) throw new TxError('INTENT_ALREADY_EXECUTING', 409, 'Otra petición ya está ejecutando esta intención.');

        await d.auditoria.registrar({ eventType: 'intent.executing', appId: row.app_id, agentId: agente?.agentId || null, intentId: id });

        if (row.rail === 'crypto_transfer') return ejecutarCripto(reclamada);
        return ejecutarFiat(reclamada, re.proveedor);
    }

    async function volverAAprobada(id, code) {
        await d.repo.actualizar(id, { status: 'approved', error_code: code }, { siEstado: 'executing' });
    }

    async function ejecutarCripto(row) {
        const intent = row.intent;
        const quorum = d.quorumPara(intent.chainId);
        if (env.NODE_ENV === 'production' && !quorum.redundante) {
            await volverAAprobada(row.id, 'RPC_NOT_REDUNDANT');
            throw new TxError('RPC_NOT_REDUNDANT', 503, 'Hacen falta al menos dos RPC independientes para firmar en producción.');
        }
        const desde = tesoreria(intent.chainId);
        if (!desde) {
            await volverAAprobada(row.id, 'TREASURY_NOT_CONFIGURED');
            throw new TxError('TREASURY_NOT_CONFIGURED', 503, 'No hay wallet de tesorería configurada para esa red.');
        }

        const tx = d.simulador.construirTransferencia(intent);
        let campos;
        try {
            await quorum.comprobarCadena();
            const [nonce, comisiones, gas] = await Promise.all([
                quorum.nonce(desde), quorum.comisiones(), quorum.estimarGas({ from: desde, to: tx.to, data: tx.data }),
            ]);
            campos = {
                chainId: intent.chainId, to: tx.to, data: tx.data, value: '0', nonce: Number(nonce),
                gasLimit: ((BigInt(gas) * 12n) / 10n).toString(),
                maxFeePerGas: comisiones.maxFeePerGas.toString(),
                maxPriorityFeePerGas: comisiones.maxPriorityFeePerGas.toString(),
            };
        } catch (err) {
            await volverAAprobada(row.id, err.code || 'RPC_ERROR');
            throw new TxError(err.code || 'RPC_ERROR', 503, `No se pudo preparar la transacción: ${err.message}`);
        }

        const firmas = (await d.repo.aprobaciones(row.id))
            .filter((f) => f.decision === 'APPROVE')
            .map((f) => ({ signature: f.signature, decision: 'APPROVE' }));

        let firmado;
        try {
            firmado = await d.firmante.solicitarFirma({
                intentId: row.id,
                intent,
                intentHash: row.intent_hash,
                policy: {
                    policyHash: row.policy_hash, policyVersion: row.policy.policyVersion,
                    decision: row.decision, requiredApprovals: row.required_approvals,
                },
                approvals: firmas,
                tx: campos,
            }, { env });
        } catch (err) {
            await volverAAprobada(row.id, err.code || 'SIGNER_ERROR');
            await d.auditoria.registrar({ eventType: 'signature.refused', appId: row.app_id, intentId: row.id, payload: { code: err.code, mensaje: err.message } });
            throw new TxError(err.code || 'SIGNER_ERROR', 502, `El firmante no firmó: ${err.message}`);
        }

        // Lo que devuelve el firmante también se comprueba: si firma otra cosa
        // (fallo o compromiso), no se difunde.
        let parsed;
        try { parsed = ethers.Transaction.from(firmado.signedTx); } catch { parsed = null; }
        const casa = parsed
            && parsed.to?.toLowerCase() === tx.to.toLowerCase()
            && parsed.data === tx.data
            && Number(parsed.chainId) === intent.chainId
            && parsed.from?.toLowerCase() === desde.toLowerCase()
            && parsed.hash === firmado.txHash;
        if (!casa) {
            await d.repo.actualizar(row.id, { status: 'failed_needs_review', error_code: 'SIGNER_OUTPUT_MISMATCH' }, { siEstado: 'executing' });
            await d.killSwitch.elevar({ scope: 'global', estado: 'SUSPICIOUS', motivo: `Salida del firmante no casa (intención ${row.id})`, actor: 'orchestrator' }).catch(() => {});
            throw new TxError('SIGNER_OUTPUT_MISMATCH', 502, 'La transacción firmada no coincide con la aprobada. No se ha difundido.');
        }
        await d.auditoria.registrar({ eventType: 'signature.obtained', appId: row.app_id, intentId: row.id, payload: { txHash: parsed.hash, from: parsed.from, nonce: campos.nonce } });

        try {
            await quorum.difundir(firmado.signedTx, parsed.hash);
        } catch (err) {
            await d.repo.actualizar(row.id, {
                status: 'failed_needs_review', tx_hash: parsed.hash, error_code: err.code || 'RPC_BROADCAST_FAILED',
                execution: { from: parsed.from, nonce: campos.nonce },
            }, { siEstado: 'executing' });
            throw new TxError(err.code || 'RPC_BROADCAST_FAILED', 502, 'Firmada pero no difundida: revisar antes de reintentar.');
        }

        const final = await d.repo.actualizar(row.id, {
            status: 'broadcast', tx_hash: parsed.hash, error_code: null,
            execution: { from: parsed.from, nonce: campos.nonce, gasLimit: campos.gasLimit },
        }, { siEstado: 'executing' });
        await d.auditoria.registrar({ eventType: 'tx.broadcast', appId: row.app_id, intentId: row.id, payload: { txHash: parsed.hash, chainId: intent.chainId } });
        return vista(final || row);
    }

    async function ejecutarFiat(row, proveedor) {
        const intent = row.intent;
        try {
            let resultado;
            if (intent.rail === 'fiat_to_crypto') {
                // Cobro entrante: la «ejecución» es entregar al pagador cómo pagar.
                // La entrega del token sale después como un crypto_transfer desde
                // tesorería, con su propia aprobación y su propia firma.
                const referencia = `BZ-${String(row.id).slice(0, 8).toUpperCase()}`;
                if (proveedor?.id === 'stripe') {
                    const { getStripePaymentLink } = require('../config/stripe-payment-links');
                    resultado = { estado: 'awaiting_payment', instruccion: { url: getStripePaymentLink('token_purchase')?.url || null, referencia } };
                } else {
                    const { buildBankTransferInstructions } = require('../config/bank-transfer-details');
                    resultado = { estado: 'awaiting_payment', instruccion: buildBankTransferInstructions(referencia) };
                }
            } else {
                const adaptador = proveedor ? d.fiat(proveedor.id, env) : null;
                if (!adaptador?.ejecutar) throw Object.assign(new Error('Proveedor sin ejecución.'), { code: 'NO_PROVIDER' });
                resultado = await adaptador.ejecutar(intent, { intentId: row.id });
            }
            const final = await d.repo.actualizar(row.id, {
                status: resultado.estado, provider_ref: resultado.referencia || null,
                execution: { proveedor: proveedor?.id || null, instruccion: resultado.instruccion || null },
                error_code: null,
            }, { siEstado: 'executing' });
            await d.auditoria.registrar({ eventType: 'fiat.dispatched', appId: row.app_id, intentId: row.id, payload: { proveedor: proveedor?.id, estado: resultado.estado, referencia: resultado.referencia } });
            return vista(final || row);
        } catch (err) {
            // Un socio que falla puede haber recibido la orden: con idempotencia
            // por intención reintentar es seguro, pero lo decide una persona.
            await d.repo.actualizar(row.id, { status: 'failed_needs_review', error_code: err.code || 'PROVIDER_ERROR' }, { siEstado: 'executing' });
            throw new TxError(err.code || 'PROVIDER_ERROR', 502, `El proveedor FIAT no aceptó la orden: ${err.message}`);
        }
    }

    return { crearIntencion, obtener, aprobar, ejecutar, vista };
}

let porDefecto = null;
const orquestador = () => { porDefecto = porDefecto || crearOrquestador(); return porDefecto; };

module.exports = { crearOrquestador, orquestador };
