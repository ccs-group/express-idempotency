const debug = require("debug")("express-idempotency:check");

module.exports = function (options) {
  return function (req, res, next) {
    const idempotencyKey = req.get(options.requestHeaderName);

    if (!idempotencyKey) {
      return next();
    }

    const cacheKey = options.generateCacheKey(req, idempotencyKey);
    debug(
      `Generated cache key "${cacheKey}" for request with idempotency key "${idempotencyKey}"`
    );

    const storedResponse = options.cache.get(cacheKey);
    debug(
      `Cache lookup for cache key "${cacheKey}" (idempotency key "${idempotencyKey}") returned: `,
      storedResponse
    );

    if (!storedResponse) {
      return next();
    }

    res.status(storedResponse.statusCode);
    res.set(storedResponse.headers);
    res.set(options.responseHeaderName, "HIT"); // indicate this was served from cache
    res.send(storedResponse.body);
    debug(
      `Sent response for "${cacheKey}" (idempotency key "${idempotencyKey}")`
    );
  };
};
