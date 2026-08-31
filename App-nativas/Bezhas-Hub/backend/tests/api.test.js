const request = require('supertest');
const { app, server } = require('../server');

describe('Backend API', () => {
  afterAll((done) => {
    try { server.close(() => done()); } catch (_) { done(); }
  });

  it('GET /api/config should return JSON with abis key', async () => {
    const res = await request(app).get('/api/config').expect(200);
    expect(typeof res.body).toBe('object');
    expect(res.body).toHaveProperty('abis');
  });

  it('POST /api/config should enforce auth', async () => {
    await request(app).post('/api/config').send({ foo: 'bar' }).expect(401);
  });

  it('POST /api/chat should validate message', async () => {
    await request(app).post('/api/chat').send({}).expect(400);
  });
});
