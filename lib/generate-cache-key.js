var md5 = require('md5');

/**
 * Generate cache key for idempotent request
 * @param {object} req Express request object
 * @param {string} idempotencyKey Idempotency key
 * @return {string}
 */
function generateCacheKey(req, idempotencyKey) {
  const path = req.path;
  const body = JSON.stringify(req.body);
  const md5hash = md5(`${path}+${body}`);
  const cacheKey = `idem_${md5hash}_${idempotencyKey}`;
  return cacheKey;
}

module.exports = generateCacheKey;