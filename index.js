'use strict';

var debug = require('debug')('express-idempotency');
var md5 = require('md5');
var LRU = require('lru-cache');
var connect = require('connect');
var expressEnd = require('express-end');

var CACHE_MAX_AGE = 2 * 24 * 60 * 60 * 1000; // 48 hours

var lruOptions = {
  max: 500,
  length: function (n, key) { return n * 2 + key.length },
  maxAge: CACHE_MAX_AGE
};

var cache = LRU(lruOptions);

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
      };
      const cacheKey = generateCacheKey(req, idempotencyKey);
      cache.set(cacheKey, responseToStore)
      debug('stored response against idempotency key: ', idempotencyKey);
    }
  });
  return next();
}

var idempotency = function (options) {
  var chain = connect();
  chain.use(expressEnd());
  chain.use(checkMw());
  chain.use(storeMw());
  return chain;
}

module.exports = idempotency;
