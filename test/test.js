"use strict";

const expect = require("chai").expect;
const httpMocks = require("node-mocks-http");
const { LRUCache } = require("lru-cache");

const cache = new LRUCache({
  max: 500,
  ttl: 2 * 24 * 60 * 60 * 1000, // 48 hours (expressed in milliseconds)
});

const middleware = require("../index.js")({
  cache,
});
const generateCacheKey = require("../lib/generate-cache-key");

describe("# Express Idempotency", function () {
  describe("request handler creation", function () {
    let mw;

    beforeEach(function () {
      mw = middleware;
    });

    it("should return a function()", function () {
      expect(mw).to.be.a("Function");
    });

    it("should accept three arguments", function () {
      expect(mw.length).to.equal(3);
    });
  });

  describe("middleware", function () {
    let req, res;
    context("with idempotency-key header in request", function () {
      before(function (done) {
        req = httpMocks.createRequest({
          method: "POST",
          url: "/test/path",
          headers: {
            "Idempotency-Key": "just-a-dummy-key-1",
          },
        });

        res = httpMocks.createResponse({
          eventEmitter: require("events").EventEmitter,
        });

        return done();
      });

      it("stores a response to the cache", function (done) {
        middleware(req, res, function next(error) {
          if (error) {
            throw new Error("Expected not to receive an error");
          }

          // end the res
          res.once("end", function () {
            const idempotencyKey = req.get("Idempotency-Key");
            const cacheKey = generateCacheKey(req, idempotencyKey);

            const storedResponse = cache.get(cacheKey);
            if (!storedResponse) {
              throw new Error("Response was not stored in cache");
            }

            expect(storedResponse).to.have.property("statusCode");
            expect(storedResponse).to.have.property("body");
            expect(storedResponse).to.have.property("headers");

            return done();
          });

          // set a dummy response status and body
          res.statusCode = 200;
          res.body = { id: 1234, description: "Just a dummy!" };
          res.send();
        });
      });

      context("with stored response in the cache", function () {
        const responseToStore = {
          statusCode: 403,
          body: { exampleProp: "hey there!" },
          headers: { "x-dummy-header": "hip hop hoop" },
        };

        before(function (done) {
          const idempotencyKey = "just-a-dummy-key-2";
          req = httpMocks.createRequest({
            method: "POST",
            url: "/test/path",
            headers: {
              "Idempotency-Key": idempotencyKey,
            },
          });

          res = httpMocks.createResponse({
            eventEmitter: require("events").EventEmitter,
          });

          const cacheKey = generateCacheKey(req, idempotencyKey);
          cache.set(cacheKey, responseToStore);
          return done();
        });

        it("returns a stored response from the cache", function (done) {
          res.once("end", function () {
            const idempotencyKey = req.get("Idempotency-Key");
            const cacheKey = generateCacheKey(req, idempotencyKey);
            const storedResponse = cache.get(cacheKey);
            if (!storedResponse) {
              throw new Error("Response was not stored in cache");
            }

            const expectedHeaders = responseToStore.headers;
            expectedHeaders["X-Cache"] = "HIT"; // expect a cache header

            expect(res._getStatusCode()).to.equal(responseToStore.statusCode);
            expect(res._getData()).to.deep.equal(responseToStore.body);
            // headers are case-insensitive, but the comparison is not
            expect(
              Object.keys(res._getHeaders()).reduce((acc, key) => {
                acc[key.toLowerCase()] = res._getHeaders()[key];
                return acc;
              }, {})
            ).to.deep.equal(
              Object.keys(expectedHeaders).reduce((acc, key) => {
                acc[key.toLowerCase()] = expectedHeaders[key];
                return acc;
              }, {})
            );

            return done();
          });

          middleware(req, res, function next(error) {
            if (error) {
              console.log("err: ", error);
              throw new Error("Expected not to receive an error");
            }
          });
        });
      });
    });

    context("without idempotency-key header in request", function () {
      beforeEach(function (done) {
        req = httpMocks.createRequest({
          method: "POST",
          url: "/test/path",
          headers: {},
        });
        res = httpMocks.createResponse({
          eventEmitter: require("events").EventEmitter,
        });

        return done();
      });

      it("does not store a response to the cache", function (done) {
        res.once("end", function () {
          const idempotencyKey = req.get("Idempotency-Key");
          const cacheKey = generateCacheKey(req, idempotencyKey);
          const storedResponse = cache.get(cacheKey);
          if (storedResponse) {
            throw new Error("A response was erroneously stored in cache");
          }
          return done();
        });

        middleware(req, res, function next(error) {
          if (error) {
            throw new Error("Expected not to receive an error");
          }

          // set a dummy response status and body
          res.status(200);
          res.send({ id: 1234, description: "Just a dummy!" });
        });
      });
    });
  });
});
