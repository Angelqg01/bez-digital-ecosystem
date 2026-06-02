/**
 * Compatibility Redis facade for legacy routes.
 */
const cache = require('../cache/redis');

module.exports = {
    ...cache,
    get: cache.cacheGet,
    set: cache.cacheSet,
    del: cache.cacheDelete,
};
