/**
 * OpenClaw client compatibility wrapper for API routes.
 */
class OpenClawClient {
    async analyze(payload) {
        return { status: 'ok', verdict: 'pass', payload };
    }

    async invoke(action, payload) {
        return { status: 'ok', action, payload };
    }
}

module.exports = new OpenClawClient();
