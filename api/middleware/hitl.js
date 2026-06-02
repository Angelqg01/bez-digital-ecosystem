/**
 * Human-in-the-loop guard.
 * In production this can be wired to the OpenClaw confirmation queue.
 * For API safety, high-risk calls may pass through only when explicitly approved.
 */
function hitlApprove(req, res, next) {
    const required = req.body?.requiresHumanApproval || req.query?.requiresHumanApproval === 'true';
    if (!required) return next();

    const approved = req.body?.humanApproved === true || req.headers['x-human-approved'] === 'true';
    if (!approved) {
        return res.status(428).json({
            error: 'Human approval required',
            nextAction: 'request_human_approval',
        });
    }
    return next();
}

module.exports = { hitlApprove };
