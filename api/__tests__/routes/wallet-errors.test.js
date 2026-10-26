const express = require('express');
const request = require('supertest');

// El router se monta suelto: sin auth real ni cadena. Lo que se prueba es cómo traduce los errores del servicio.
jest.mock('../../middleware/security', () => ({
    authenticateToken: (req, _res, next) => { req.user = { address: '0x' + '1'.repeat(40) }; next(); },
}));
jest.mock('../../services/walletService', () => ({
    getWalletPortfolio: jest.fn(),
    getSecurityStatus: jest.fn(),
}));

const walletService = require('../../services/walletService');
const walletRouter = require('../../routes/wallet');

const app = express().use('/api/wallet', walletRouter);

describe('Routes: /api/wallet, errores del servicio', () => {
    it('contrato sin desplegar en la cadena = 503 con código propio, no 500', async () => {
        walletService.getWalletPortfolio.mockRejectedValue(
            Object.assign(new Error('Contract BEZCoinV2 not deployed on chain default'), { code: 'CONTRACT_NOT_DEPLOYED', status: 503 }),
        );
        const res = await request(app).get('/api/wallet/portfolio');
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('CONTRACT_NOT_DEPLOYED');
        expect(res.body.details).toMatch(/BEZCoinV2/);
    });

    it('cualquier otro fallo sigue siendo 500', async () => {
        walletService.getSecurityStatus.mockRejectedValue(new Error('boom'));
        const res = await request(app).get('/api/wallet/security/status');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to fetch security status');
        expect(res.body.code).toBeUndefined();
    });
});
