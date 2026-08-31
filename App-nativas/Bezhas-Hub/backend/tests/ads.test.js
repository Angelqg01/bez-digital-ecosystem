// backend/tests/ads.test.js
const request = require('supertest');
const app = require('../server');

describe('Ads Module', () => {
    it('should return a relevant ad for context', async () => {
        const res = await request(app)
            .post('/api/ads/request-ad')
            .send({ context: ['DeFi'] });
        expect(res.statusCode).toBe(200);
        expect(res.body.ad).toBeDefined();
        expect(res.body.ad.text).toMatch(/DeFi|NFT/);
    });

    it('should verify ad event', async () => {
        const adRes = await request(app)
            .post('/api/ads/request-ad')
            .send({ context: ['NFT'] });
        const eventId = adRes.body.eventId;
        const verifyRes = await request(app)
            .post('/api/ads/verify-event')
            .send({ eventId, type: 'impression', userId: 'user1' });
        expect(verifyRes.statusCode).toBe(200);
        expect(verifyRes.body.valid).toBe(true);
    });
});
