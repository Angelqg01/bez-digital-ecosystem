/**
 * Adaptador Didit — firma de webhooks, traducción a nivel KYC y creación de sesión.
 * Sin cuenta externa: todo se prueba con secretos y fetch simulados.
 */
const crypto = require('crypto');
const didit = require('../../services/kyc/diditAdapter');

const SECRET = 'didit_test_secret';
const WALLET = '0x' + 'a'.repeat(40);
const NOW = 1_800_000_000; // segundos

function sign(data, secret = SECRET) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

function signedHeaders(body, secret = SECRET) {
    return { 'x-signature-v2': sign(didit.canonicalJson(body), secret) };
}

const EVENT = {
    event_id: 'evt-1',
    session_id: 'sess-123',
    status: 'Approved',
    webhook_type: 'status.updated',
    timestamp: NOW,
    vendor_data: WALLET,
    workflow_id: 'wf-level1',
    decision: { id_verifications: [{ node_id: 'n1', status: 'Approved' }] },
};

describe('canonicalJson', () => {
    it('ordena claves recursivamente y no añade espacios', () => {
        expect(didit.canonicalJson({ b: 1, a: { d: [2, { z: 1, y: null }], c: 'ñ' } }))
            .toBe('{"a":{"c":"ñ","d":[2,{"y":null,"z":1}]},"b":1}');
    });
});

describe('verifyWebhookSignature', () => {
    it('acepta X-Signature-V2 válida y timestamp del cuerpo reciente', () => {
        expect(didit.verifyWebhookSignature({
            body: EVENT, headers: signedHeaders(EVENT), secret: SECRET, nowSeconds: NOW,
        })).toBe(true);
    });

    it('rechaza una firma hecha con otro secreto', () => {
        expect(didit.verifyWebhookSignature({
            body: EVENT, headers: signedHeaders(EVENT, 'otro'), secret: SECRET, nowSeconds: NOW,
        })).toBe(false);
    });

    it('rechaza un cuerpo alterado después de firmar', () => {
        const tampered = { ...EVENT, vendor_data: '0x' + 'b'.repeat(40) };
        expect(didit.verifyWebhookSignature({
            body: tampered, headers: signedHeaders(EVENT), secret: SECRET, nowSeconds: NOW,
        })).toBe(false);
    });

    it('rechaza un timestamp del cuerpo fuera de 300 s (repetición)', () => {
        const old = { ...EVENT, timestamp: NOW - 301 };
        expect(didit.verifyWebhookSignature({
            body: old, headers: signedHeaders(old), secret: SECRET, nowSeconds: NOW,
        })).toBe(false);
    });

    it('ignora la cabecera X-Timestamp: refrescarla no sirve para reenviar un cuerpo viejo', () => {
        const old = { ...EVENT, timestamp: NOW - 3600 };
        const headers = { ...signedHeaders(old), 'x-timestamp': String(NOW) };
        expect(didit.verifyWebhookSignature({ body: old, headers, secret: SECRET, nowSeconds: NOW })).toBe(false);
    });

    it('rechaza sin secreto, sin firma o con cuerpo no objeto', () => {
        expect(didit.verifyWebhookSignature({ body: EVENT, headers: signedHeaders(EVENT), secret: '', nowSeconds: NOW })).toBe(false);
        expect(didit.verifyWebhookSignature({ body: EVENT, headers: {}, secret: SECRET, nowSeconds: NOW })).toBe(false);
        expect(didit.verifyWebhookSignature({ body: null, headers: signedHeaders(EVENT), secret: SECRET, nowSeconds: NOW })).toBe(false);
    });
});

describe('parseSessionEvent', () => {
    it('extrae la wallet de vendor_data normalizada a minúsculas', () => {
        const e = didit.parseSessionEvent({ ...EVENT, vendor_data: WALLET.toUpperCase().replace('0X', '0x') });
        expect(e.walletAddress).toBe(WALLET);
        expect(e.sessionId).toBe('sess-123');
        expect(e.status).toBe('Approved');
    });

    it('descarta vendor_data que no es una dirección', () => {
        expect(didit.parseSessionEvent({ ...EVENT, vendor_data: 'usuario-42' }).walletAddress).toBeNull();
        expect(didit.parseSessionEvent({}).walletAddress).toBeNull();
    });
});

describe('levelForEvent', () => {
    it('Approved sube a nivel 1 por defecto', () => {
        expect(didit.levelForEvent({ status: 'Approved', workflowId: 'wf-x' })).toBe(1);
    });

    it('Approved del workflow de nivel 2 concede nivel 2', () => {
        expect(didit.levelForEvent({ status: 'Approved', workflowId: 'wf-aml' }, { level2WorkflowId: 'wf-aml' })).toBe(2);
    });

    it('cualquier otro estado no cambia el nivel', () => {
        for (const status of ['Declined', 'In Review', 'In Progress', 'Abandoned', 'Expired', 'Kyc Expired']) {
            expect(didit.levelForEvent({ status, workflowId: 'wf-x' })).toBeNull();
        }
    });
});

describe('createSession', () => {
    it('llama a /v3/session/ con la clave en cabecera y la wallet como vendor_data', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ session_id: 'sess-9', url: 'https://verify.example/abc' }),
        });
        const out = await didit.createSession({
            walletAddress: WALLET.toUpperCase().replace('0X', '0x'),
            workflowId: 'wf-level1',
            callbackUrl: 'https://api.bezhas.com/pay',
            apiKey: 'k_test',
            apiBase: 'https://sandbox.example',
            fetchImpl,
        });
        expect(out).toEqual({ sessionId: 'sess-9', url: 'https://verify.example/abc' });
        const [url, opts] = fetchImpl.mock.calls[0];
        expect(url).toBe('https://sandbox.example/v3/session/');
        expect(opts.headers['x-api-key']).toBe('k_test');
        expect(JSON.parse(opts.body)).toMatchObject({ workflow_id: 'wf-level1', vendor_data: WALLET });
    });

    it('falla sin clave o si Didit responde error', async () => {
        await expect(didit.createSession({ walletAddress: WALLET, workflowId: 'w', apiKey: '' }))
            .rejects.toThrow('DIDIT_API_KEY');
        const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 403 });
        await expect(didit.createSession({ walletAddress: WALLET, workflowId: 'w', apiKey: 'k', fetchImpl }))
            .rejects.toThrow('HTTP 403');
    });
});
