/**
 * Aegis anomaly guard placeholder.
 * Keeps routes bootable while allowing future risk scoring integration.
 */
function buildAegisMiddleware(checkType = 'generic') {
    return (req, _res, next) => {
        req.aegis = {
            checked: true,
            checkType,
            risk: 'unknown',
            mode: 'passive',
        };
        next();
    };
}

function aegisCheck(arg, res, next) {
    if (typeof arg === 'string') return buildAegisMiddleware(arg);
    return buildAegisMiddleware()(arg, res, next);
}

module.exports = { aegisCheck };
