'use strict';

describe('discordNotifier: no avisa desde entornos de test', () => {
    const entorno = { ...process.env };
    afterEach(() => { process.env = { ...entorno }; jest.resetModules(); });

    test('NODE_ENV=test fijado DESPUÉS de cargar el módulo también silencia', async () => {
        delete process.env.JEST_WORKER_ID;
        process.env.NODE_ENV = 'development';
        process.env.DISCORD_WEBHOOK_URL = 'https://discord.invalid/hook';
        jest.resetModules();
        const axios = require('axios');
        const post = jest.spyOn(axios, 'post').mockResolvedValue({ status: 204 });
        const { notifyStripeWebhookError } = require('../middleware/discordNotifier');

        process.env.NODE_ENV = 'test';
        await notifyStripeWebhookError('checkout.session.completed', 'boom');
        expect(post).not.toHaveBeenCalled();
    });
});
