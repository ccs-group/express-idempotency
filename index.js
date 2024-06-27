"use strict";

const connect = require("connect");
const expressEnd = require("express-end");
const { LRUCache } = require("lru-cache");

const checkMw = require("./lib/check-middleware");
const storeMw = require("./lib/store-middleware");
const generateCacheKey = require("./lib/generate-cache-key");

// helper function to merge options - https://www.30secondsofcode.org/js/s/default-values-for-object-properties/
const defaults = (obj, ...defs) =>
  Object.assign({}, obj, ...defs.reverse(), obj);

// define default options
const DEFAULT_OPTIONS = {
  requestHeaderName: "Idempotency-Key",
  responseHeaderName: "X-Cache",
  generateCacheKey: generateCacheKey,
  lruCacheOptions: {
    max: 500, // 500 items in cache
    ttl: 2 * 24 * 60 * 60 * 1000, // 48 hours (expressed in milliseconds)
  },
};

const mw = function (options = {}) {
  const opts = defaults(options, DEFAULT_OPTIONS);

  if (!options.cache) {
    opts.cache = new LRUCache(opts.lruCacheOptions);
  }

  // chain pattern from helmet - see https://github.com/helmetjs/helmet/blob/master/index.js
  const chain = connect();
  chain.use(expressEnd);
  chain.use(checkMw(opts));
  chain.use(storeMw(opts));
  return chain;
};

module.exports = mw;
