/**
 * Registros de validación de contenido sobre un Postgres REAL (migraciones 008, 009 y 026). Se salta sin base de pruebas:
 *
 *   docker run -d --name pgtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=t -p 54330:5432 postgres:16-alpine
 *   HUB_TEST_PG_URL=postgres://postgres:test@localhost:54330/t pnpm exec jest --env=node tests/integration/validation-pg.test.js
 *
 * Hace DROP SCHEMA public CASCADE: usar SÓLO una base desechable.
 */
const fs = require('fs');
const path = require('path');

const URL = process.env.HUB_TEST_PG_URL;
const d = URL ? describe : describe.skip;
const sql = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', f), 'utf8');

const HASH = (n) => `0x${n.toString(16).padStart(64, '0')}`;
const AUTOR = '0x2222222222222222222222222222222222222222';

d('validaciones de contenido sobre Postgres', () => {
    let pg; let Validation; let queueValidation;

    beforeAll(async () => {
        process.env.POSTGRES_URL = URL;
        delete process.env.QUEUE_ENABLED; // cola apagada: camino directo, sin Redis
        jest.resetModules();
        jest.doMock('../../websocket-server', () => ({}));
        pg = require('../../db/pool');
        await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        await pg.query(sql('008_logistics_bridge_fiat.sql'));
        await pg.query(sql('009_core_users.sql'));
        await pg.query(sql('026_validation_records.sql'));
        await pg.query(sql('026_validation_records.sql')); // idempotente
        Validation = require('../../models/pg/Validation');
        ({ queueValidation } = require('../../services/validation-queue.service'));
    });
    afterAll(async () => { await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); });

    it('persiste en Postgres (no en memoria) y devuelve el registro con los mismos nombres que usaba el modelo de Mongo', async () => {
        const v = await Validation.create({ contentHash: HASH(1), authorAddress: AUTOR, transactionHash: HASH(900), blockNumber: 123, paymentMethod: 'fiat',
            paymentSessionId: 'cs_1', paymentAmount: 4.99, paymentCurrency: 'EUR', status: 'confirmed', validationType: 'post', gasUsed: '21000', confirmedAt: new Date().toISOString() });
        expect(v).toMatchObject({ contentHash: HASH(1), authorAddress: AUTOR, blockNumber: 123, paymentMethod: 'fiat', paymentAmount: 4.99, status: 'confirmed', gasUsed: '21000' });
        expect(v._id).toBe(v.id);
        expect((await pg.query('SELECT COUNT(*)::int AS n FROM validation_records')).rows[0].n).toBe(1);
        expect(await Validation.findById(v.id)).toMatchObject({ paymentSessionId: 'cs_1' });
    });

    it('una misma sesión de pago o transacción en cadena se registra UNA vez, también con reintentos simultáneos', async () => {
        const datos = { contentHash: HASH(2), authorAddress: AUTOR, transactionHash: HASH(901), paymentMethod: 'fiat', paymentSessionId: 'cs_2', status: 'confirmed' };
        const r = await Promise.all(Array.from({ length: 6 }, () => Validation.create(datos)));
        expect(new Set(r.map((x) => x.id)).size).toBe(1);
        expect(r.filter((x) => x.duplicate)).toHaveLength(5);
        // misma transacción con otra sesión (mayúsculas distintas): tampoco duplica
        const otra = await Validation.create({ ...datos, paymentSessionId: 'cs_distinta', transactionHash: HASH(901).toUpperCase().replace('0X', '0x') });
        expect(otra.duplicate).toBe(true);
        expect(await Validation.countDocuments({ paymentSessionId: 'cs_2' })).toBe(1);
    });

    it('valida los datos: sin hash o autor falla, el tipo desconocido se guarda como content y los metadatos deben ser un objeto', async () => {
        await expect(Validation.create({ authorAddress: AUTOR })).rejects.toThrow(/obligatorios/);
        const v = await Validation.create({ contentHash: HASH(3), authorAddress: AUTOR, contentType: 'holograma', metadata: ['no', 'objeto'], status: 'inventado', paymentMethod: 'oro' });
        expect(v).toMatchObject({ validationType: 'content', metadata: {}, status: 'pending', paymentMethod: 'crypto' });
        expect((await Validation.create({ contentHash: HASH(4), authorAddress: AUTOR, contentType: 'reel', contentUri: 'ipfs://x' }))).toMatchObject({ validationType: 'reel', contentUri: 'ipfs://x' });
    });

    it('find/findOne/count sólo admiten filtros conocidos (sin inyección de operadores de Mongo) y paginan', async () => {
        expect((await Validation.findByAuthor(AUTOR, { limit: 2 })).length).toBe(2);
        expect((await Validation.findByStatus('confirmed')).every((x) => x.status === 'confirmed')).toBe(true);
        expect(await Validation.findOne({ contentHash: HASH(2) })).toMatchObject({ paymentSessionId: 'cs_2' });
        expect(await Validation.findOne({ contentHash: HASH(777) })).toBeNull();
        await expect(Validation.find({ metadata: { $ne: null } })).rejects.toThrow(/Filtro no permitido/);
        await expect(Validation.findOne({ $where: 'sleep(1000)' })).rejects.toThrow(/Filtro no permitido/);
        const asc = await Validation.find({}, { sort: { createdAt: 1 }, limit: 100 });
        expect(asc[0].createdAt <= asc[asc.length - 1].createdAt).toBe(true);
        expect((await Validation.find({}, { skip: 1, limit: 1 })).length).toBe(1);
    });

    it('updateStatus confirma con los datos de la transacción y un registro confirmado no se degrada', async () => {
        const v = await Validation.create({ contentHash: HASH(5), authorAddress: AUTOR, status: 'pending' });
        const c = await Validation.updateStatus(v.id, 'confirmed', { transactionHash: HASH(902), blockNumber: 77, gasUsed: '50000' });
        expect(c).toMatchObject({ status: 'confirmed', transactionHash: HASH(902), blockNumber: 77 });
        expect(c.confirmedAt).toBeTruthy();
        expect(await Validation.updateStatus(v.id, 'failed', { errorMessage: 'reintento tardío' })).toBeNull(); // no baja de confirmed
        expect((await Validation.findById(v.id)).status).toBe('confirmed');
        const f = await Validation.create({ contentHash: HASH(6), authorAddress: AUTOR });
        expect(await Validation.updateStatus(f.id, 'failed', { errorMessage: 'sin fondos' })).toMatchObject({ status: 'failed', errorMessage: 'sin fondos' });
        expect(await Validation.updateStatus('no-es-uuid', 'confirmed')).toBeNull();
        expect(await Validation.updateStatus(f.id, 'raro')).toBeNull();
    });

    it('la base impone estados y métodos válidos aunque se escriba directamente', async () => {
        await expect(pg.query("INSERT INTO validation_records (content_hash, author_address, status) VALUES ('0x1','0xa','raro')")).rejects.toThrow(/status/);
        await expect(pg.query("INSERT INTO validation_records (content_hash, author_address, payment_method) VALUES ('0x1','0xa','oro')")).rejects.toThrow(/payment_method/);
    });

    it('queueValidation con la cola apagada guarda el registro pendiente en Postgres (y ya conserva contentType y contentUri)', async () => {
        const r = await queueValidation({ contentHash: HASH(7), authorAddress: AUTOR, contentType: 'article', contentUri: 'https://x.test/a' });
        expect(r.skipped).toBe(true);
        expect(r.validation).toMatchObject({ status: 'pending', validatedBy: 'backend-direct', validationType: 'article', contentUri: 'https://x.test/a' });
        expect(r.validation.metadata).toMatchObject({ processedDirectly: true, queueDisabled: true });
        expect(await Validation.findOne({ contentHash: HASH(7) })).toMatchObject({ validationType: 'article' });
    });

    it('si Postgres falla ya NO se disfraza de éxito: queueValidation devuelve el error (antes caía a memoria y perdía el registro)', async () => {
        const original = pg.query;
        pg.query = () => Promise.reject(new Error('base caída'));
        const r = await queueValidation({ contentHash: HASH(8), authorAddress: AUTOR, contentType: 'post' });
        pg.query = original;
        expect(r).toMatchObject({ skipped: true, error: expect.stringMatching(/base caída/) });
        expect(await Validation.findOne({ contentHash: HASH(8) })).toBeNull();
    });
});
