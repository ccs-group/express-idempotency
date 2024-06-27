const debug = require("debug")("express-idempotency:check");

module.exports = function (options) {
  return function (req, res, next) {
    const idempotencyKey = req.get(options.requestHeaderName);

    if (!idempotencyKey) {
      return next();
    }

    const cacheKey = options.generateCacheKey(req, idempotencyKey);
    debug("generated cacheKey for request: ", { idempotencyKey, cacheKey });

    const storedResponse = options.cache.get(cacheKey);
    debug(
      `stored response for cacheKey ${cacheKey} (idempotency key ${idempotencyKey}): `,
      storedResponse
    );

    if (!storedResponse) {
      return next();
    }

    res.status(storedResponse.statusCode);
    res.set(storedResponse.headers);
    res.set(options.responseHeaderName, "HIT"); // indicate this was served from cache
    res.send(storedResponse.body);
  };
};
