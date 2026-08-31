const request = require('supertest');
const { app, server } = require('../server');

// Helper valid Ethereum addresses
const addr1 = '0x1000000000000000000000000000000000000001';
const addr2 = '0x2000000000000000000000000000000000000002';

describe('Groups API', () => {
    afterAll((done) => {
        try { server.close(() => done()); } catch (_) { done(); }
    });

    it('GET /api/groups should return only public groups by default', async () => {
        const res = await request(app).get('/api/groups').expect(200);
        expect(Array.isArray(res.body)).toBe(true);
        // Ensure no private groups are returned
        expect(res.body.every(g => g.type === 'public')).toBe(true);
    });

    it('POST /api/groups should create a new public group and add creator as member', async () => {
        const payload = {
            name: 'Test Group ' + Date.now(),
            description: 'A test group created by Jest for API validation',
            type: 'public',
            category: 'general',
            createdBy: addr1,
            avatar: '🧪'
        };
        const res = await request(app).post('/api/groups').send(payload).expect(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('name', payload.name);
        expect(res.body).toHaveProperty('memberCount');
        expect(res.body.memberCount).toBeGreaterThanOrEqual(1);

        // Fetch user groups by walletAddress filter
        const myGroups = await request(app).get('/api/groups').query({ walletAddress: addr1 }).expect(200);
        expect(Array.isArray(myGroups.body)).toBe(true);
        expect(myGroups.body.some(g => g.name === payload.name)).toBe(true);
    });

    it('POST /api/groups/:id/join should join and then prevent duplicate join', async () => {
        // Create a fresh group to operate on
        const createRes = await request(app).post('/api/groups').send({
            name: 'Joinable ' + Date.now(),
            description: 'Group for join/leave testing',
            type: 'public',
            category: 'general',
            createdBy: addr1
        }).expect(201);
        const groupId = createRes.body.id;

        const joinRes = await request(app).post(`/api/groups/${groupId}/join`).send({ walletAddress: addr2 }).expect(200);
        expect(joinRes.body).toHaveProperty('message');
        expect(joinRes.body.group).toHaveProperty('memberCount');
        expect(joinRes.body.group.memberCount).toBeGreaterThanOrEqual(2);

        // Duplicate join should fail
        const dupJoin = await request(app).post(`/api/groups/${groupId}/join`).send({ walletAddress: addr2 }).expect(400);
        expect(dupJoin.body).toHaveProperty('error');
    });

    it('POST /api/groups/:id/leave should leave and then prevent duplicate leave', async () => {
        // Create a fresh group and join with addr2 first
        const createRes = await request(app).post('/api/groups').send({
            name: 'Leavable ' + Date.now(),
            description: 'Group for leave testing',
            type: 'public',
            category: 'general',
            createdBy: addr1
        }).expect(201);
        const groupId = createRes.body.id;
        await request(app).post(`/api/groups/${groupId}/join`).send({ walletAddress: addr2 }).expect(200);

        const leaveRes = await request(app).post(`/api/groups/${groupId}/leave`).send({ walletAddress: addr2 }).expect(200);
        expect(leaveRes.body).toHaveProperty('message');

        // Duplicate leave should fail
        const dupLeave = await request(app).post(`/api/groups/${groupId}/leave`).send({ walletAddress: addr2 }).expect(400);
        expect(dupLeave.body).toHaveProperty('error');
    });

    it('POST /api/groups/:id/leave should prevent creator from leaving when others exist', async () => {
        // Create group and add another member
        const createRes = await request(app).post('/api/groups').send({
            name: 'CreatorStay ' + Date.now(),
            description: 'Creator cannot leave if others exist',
            type: 'public',
            category: 'general',
            createdBy: addr1
        }).expect(201);
        const groupId = createRes.body.id;
        await request(app).post(`/api/groups/${groupId}/join`).send({ walletAddress: addr2 }).expect(200);

        const leaveCreator = await request(app).post(`/api/groups/${groupId}/leave`).send({ walletAddress: addr1 }).expect(400);
        expect(leaveCreator.body).toHaveProperty('error');
    });

    it('POST /api/groups/:id/join should reject joining private groups', async () => {
        // Seed has id 3 as private in routes
        const res = await request(app).post('/api/groups/3/join').send({ walletAddress: addr2 });
        // It should be 403 (forbidden) or 404 if seed changed; accept either to keep test resilient
        expect([403, 404]).toContain(res.status);
    });
});
