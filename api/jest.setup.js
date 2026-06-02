// Set required environment variables before any test module loads
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_API_KEY = 'test-internal-key';
process.env.BEZ_TREASURY_PK = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.BANK_WEBHOOK_SECRET = 'bank_webhook_secret_test';
process.env.NODE_ENV = 'production';

// Polyfill performance API para Jest
if (!global.performance) {
    global.performance = {};
}

global.performance.clearMarks = global.performance.clearMarks || (() => { });
global.performance.clearMeasures = global.performance.clearMeasures || (() => { });
global.performance.mark = global.performance.mark || (() => { });
global.performance.measure = global.performance.measure || (() => { });
