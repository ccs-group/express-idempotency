const debug = require("debug")("express-idempotency:store");

module.exports = function (options) {
  return function (req, res, next) {
    res.once("end", () => {
      const idempotencyKey = req.get(options.requestHeaderName);
      if (idempotencyKey) {
        const responseToStore = {
          statusCode: res.statusCode,
          body: res.body,
          headers: res.headers,
        };

        const cacheKey = options.generateCacheKey(req, idempotencyKey);
        options.cache.set(cacheKey, responseToStore);
        debug(
          `Storing response against cache key "${cacheKey}" for request with idempotency key "${idempotencyKey}"`
        );
        debug(`Cache info for key ${cacheKey}: `, options.cache.info(cacheKey));
      }
    });
    return next();
  };
};
