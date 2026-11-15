/**
 * Contactos sincronizados sobre un Postgres REAL (migraciones 008, 009 y 021). Se salta sin base de pruebas:
 *
 *   docker run -d --name pgtest -e POSTGRES_PASSWORD=test -e POSTGRES_DB=t -p 54330:5432 postgres:16-alpine
 *   HUB_TEST_PG_URL=postgres://postgres:test@localhost:54330/t pnpm exec jest --env=node tests/integration/contacts-pg.test.js
 *
 * Hace DROP SCHEMA public CASCADE y aplica las migraciones 008, 009 y 021: usar SÓLO una base desechable.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

const URL = process.env.HUB_TEST_PG_URL;
const d = URL ? describe : describe.skip;
const sql = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'migrations', f), 'utf8');
const hash = (c) => c.repeat(64).slice(0, 64);

d('contactos sobre Postgres', () => {
    let pg; let User; let Contact; let app; let ana; let beto; let carla;
    let usuarioActual;

    beforeAll(async () => {
        process.env.POSTGRES_URL = URL;
        jest.resetModules();
        jest.doMock('../../middleware/auth.middleware', () => ({ protect: (req, _res, next) => { req.user = usuarioActual; req.log = { error: () => {} }; next(); } }));
        jest.doMock('../../services/queue.service', () => ({ addContactSyncJob: jest.fn() }));
        pg = require('../../db/pool');
        // Base desechable: se rehace el esquema con las migraciones reales (008 trae update_modified_column y bezcoin_transactions).
        await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
        await pg.query(sql('008_logistics_bridge_fiat.sql'));
        await pg.query(sql('009_core_users.sql'));
        await pg.query(sql('021_contacts.sql'));
        await pg.query(sql('021_contacts.sql')); // idempotente
        User = require('../../models/pg/User');
        Contact = require('../../models/pg/Contact');
        const mk = async (n, extra = '') => (await pg.query(`INSERT INTO users (username, email, wallet_address, email_hash, phone_hash ${extra ? ', ' + extra.split('=')[0] : ''}) VALUES ($1,$2,$3,$4,$5 ${extra ? ', $6' : ''}) RETURNING *`, [n, `${n}@x.io`, n === 'carla' ? null : `0x${n}`, hash(n[0]), hash(n[0].toUpperCase())])).rows[0];
        ana = await mk('ana'); beto = await mk('beto'); carla = await mk('carla');
        app = express();
        app.use(express.json());
        app.use('/api/contacts', require('../../routes/contacts.routes'));
    });
    afterAll(async () => { await pg.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); });

    const worker = () => require('../../workers/contactSync.worker').processContactSync;

    it('encuentra al usuario por hash de email o de teléfono', async () => {
        expect((await User.findByContactHashes({ emailHash: hash('b') })).id).toBe(beto.id);
        expect((await User.findByContactHashes({ phoneHash: hash('B') })).id).toBe(beto.id);
        expect(await User.findByContactHashes({ emailHash: hash('z') })).toBeNull();
        expect(await User.findByContactHashes({})).toBeNull();
    });

    it('el worker empareja con usuarios, no se empareja consigo mismo y es idempotente', async () => {
        await worker()({ data: { userId: ana.id, contacts: [
            { emailHash: hash('b'), encryptedData: 'cifrado-1' },   // beto
            { emailHash: hash('a') },                                  // la propia ana: se salta
            { phoneHash: hash('9') },                                  // desconocido
        ] } });
        await worker()({ data: { userId: ana.id, contacts: [{ emailHash: hash('b'), encryptedData: 'cifrado-2' }] } }); // repetido
        const { rows } = await pg.query('SELECT * FROM contacts WHERE owner_id = $1 ORDER BY created_at', [ana.id]);
        expect(rows).toHaveLength(2);
        expect(rows.find((r) => r.matched_user_id === beto.id)).toMatchObject({ status: 'is_user', encrypted_data: 'cifrado-2' });
        expect(rows.find((r) => r.phone_hash === hash('9'))).toMatchObject({ status: 'pending', matched_user_id: null });
        expect((await User.findById(ana.id)).contact_sync).toMatchObject({ hasSynced: true });
    });

    it('GET /matches devuelve sólo las coincidencias del propietario con datos públicos', async () => {
        usuarioActual = { _id: ana.id, walletAddress: ana.wallet_address };
        const r = await request(app).get('/api/contacts/matches');
        expect(r.status).toBe(200);
        expect(r.body.matches).toHaveLength(1);
        expect(r.body.matches[0].matchedUserId).toMatchObject({ _id: beto.id, username: 'beto' });
        usuarioActual = { _id: beto.id };
        expect((await request(app).get('/api/contacts/matches')).body.matches).toEqual([]);
    });

    it('la recompensa se cobra UNA vez aunque lleguen peticiones simultáneas', async () => {
        const { id } = (await pg.query("SELECT id FROM contacts WHERE owner_id = $1 AND status = 'is_user'", [ana.id])).rows[0];
        usuarioActual = { _id: ana.id, walletAddress: ana.wallet_address };
        const resp = await Promise.all(Array.from({ length: 8 }, () => request(app).post(`/api/contacts/${id}/add-friend`)));
        expect(resp.filter((r) => r.status === 200)).toHaveLength(1);
        expect(resp.filter((r) => r.status === 404)).toHaveLength(7);
        const { rows } = await pg.query("SELECT * FROM bezcoin_transactions WHERE metadata->>'contactId' = $1", [id]);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ type: 'EARN', currency: 'BEZ', status: 'completed', wallet_address: ana.wallet_address });
        expect(Number(rows[0].amount)).toBe(50);
        expect((await pg.query('SELECT status FROM contacts WHERE id = $1', [id])).rows[0].status).toBe('invited');
    });

    it('re-sincronizar un contacto ya invitado no lo reabre (no se puede cobrar dos veces)', async () => {
        await worker()({ data: { userId: ana.id, contacts: [{ emailHash: hash('b') }] } });
        const { rows } = await pg.query('SELECT status FROM contacts WHERE owner_id = $1 AND email_hash = $2', [ana.id, hash('b')]);
        expect(rows[0].status).toBe('invited');
    });

    it('no se puede reclamar el contacto de otro usuario ni un id mal formado', async () => {
        const { id } = (await pg.query('SELECT id FROM contacts WHERE owner_id = $1 LIMIT 1', [ana.id])).rows[0];
        usuarioActual = { _id: beto.id, walletAddress: beto.wallet_address };
        expect((await request(app).post(`/api/contacts/${id}/add-friend`)).status).toBe(404);
        expect((await request(app).post('/api/contacts/no-es-un-uuid/add-friend')).status).toBe(404);
    });

    it('sin wallet vinculada responde 409 y NO consume el contacto', async () => {
        await worker()({ data: { userId: carla.id, contacts: [{ emailHash: hash('a') }] } }); // carla conoce a ana
        const { id } = (await pg.query("SELECT id FROM contacts WHERE owner_id = $1 AND status = 'is_user'", [carla.id])).rows[0];
        usuarioActual = { _id: carla.id, walletAddress: null };
        const r = await request(app).post(`/api/contacts/${id}/add-friend`);
        expect(r.status).toBe(409);
        expect(r.body.code).toBe('WALLET_REQUIRED');
        expect((await pg.query('SELECT status FROM contacts WHERE id = $1', [id])).rows[0].status).toBe('is_user');
    });

    it('si falla el pago de la recompensa, el contacto vuelve a poder reclamarse', async () => {
        const { id } = (await pg.query("SELECT id FROM contacts WHERE owner_id = $1 AND status = 'is_user'", [carla.id])).rows[0];
        usuarioActual = { _id: carla.id, walletAddress: '0xcarla' };
        const BEZ = require('../../models/pg/BEZCoinTransaction');
        const orig = BEZ.create; BEZ.create = jest.fn().mockRejectedValue(new Error('libro caído'));
        const r = await request(app).post(`/api/contacts/${id}/add-friend`);
        BEZ.create = orig;
        expect(r.status).toBe(500);
        expect((await pg.query('SELECT status FROM contacts WHERE id = $1', [id])).rows[0].status).toBe('is_user');
    });

    it('la tabla rechaza un contacto sin hash y borra en cascada con el usuario', async () => {
        await expect(pg.query("INSERT INTO contacts (owner_id, encrypted_data) VALUES ($1, 'x')", [ana.id])).rejects.toThrow(/contacts_has_hash/);
        const tmp = (await pg.query("INSERT INTO users (username, email) VALUES ('tmp','tmp@x.io') RETURNING id")).rows[0].id;
        await Contact.upsert({ ownerId: tmp, emailHash: hash('t'), encryptedData: 'c', status: 'pending' });
        await pg.query('DELETE FROM users WHERE id = $1', [tmp]);
        expect((await pg.query('SELECT 1 FROM contacts WHERE owner_id = $1', [tmp])).rowCount).toBe(0);
    });
});
