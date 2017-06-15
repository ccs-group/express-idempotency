'use strict';

var debug = require('debug')('express-idempotency');
var connect = require('connect');
var expressEnd = require('express-end');

var cache = require('./lib/cache-provider');
var generateCacheKey = require('./lib/generate-cache-key');

/**
 * Express middleware
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
var checkMw = function(req, res, next) {
  var idempotencyKey = req.get('Idempotency-Key');

  if (!idempotencyKey) {
    return next();
  }

  const cacheKey = generateCacheKey(req, idempotencyKey);
  const storedResponse = cache.get(cacheKey);

  if (!storedResponse) {
    return next();
  }

  res.status(storedResponse.statusCode);
  res.set(storedResponse.headers);
  res.set('X-Cache', 'HIT'); // indicate this was served from cache
  res.send(storedResponse.body);
}

/**
 * Express middleware to store a resposne against a supplied idempotency token
 * in the cache.
 * @param {object} req Express request
 * @param {object} res Express response
 * @param {function} next Express next callback function
 */
function storeMw(req, res, next) {
  res.once('end', () => {
    const idempotencyKey = req.get('Idempotency-Key');
    if (idempotencyKey) {
      const responseToStore = {
        statusCode: res.statusCode,
        body: res.body,
        headers: res.headers,
      };

      const cacheKey = generateCacheKey(req, idempotencyKey);
      cache.set(cacheKey, responseToStore)
      debug('stored response against idempotency key: ', idempotencyKey);
    }
  });
  return next();
}

var idempotency = function (options) {
  // chain pattern from helmet - see https://github.com/helmetjs/helmet/blob/master/index.js
  var chain = connect();
  chain.use(expressEnd);
  chain.use(checkMw);
  chain.use(storeMw);
  return chain;
}

module.exports = idempotency;
