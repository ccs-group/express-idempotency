'use strict';

var expect = require('chai').expect;
var httpMocks = require('node-mocks-http');
var expressEnd = require('express-end');
var util = require('util');

var middleware = require('../index.js')();
var generateCacheKey = require('../lib/generate-cache-key');
var cache = require('../lib/cache-provider');

describe('# Express Idempotency', function() {  
  describe('request handler creation', function() {
    var mw;

    beforeEach(function() {
      mw = middleware;
    });

    it('should return a function()', function() {
      expect(mw).to.be.a('Function');
    });

    it('should accept three arguments', function() {
      expect(mw.length).to.equal(3);
    });
  });

  describe('middleware', function() {
    var req, res;
    context('with idempotency-key header in request', function() {
      before(function(done) {
        req = httpMocks.createRequest({
          method: 'POST',
          url: '/test/path',
          headers: {
            'Idempotency-Key': 'just-a-dummy-key-1',
          },
        });
        
        res = httpMocks.createResponse({
          eventEmitter: require('events').EventEmitter
        });
        
        done();
      });

      it('stores a response to the cache', function(done) {
        middleware(req, res, function next(error) {
          if (error) {
            throw new Error('Expected not to receive an error');
          }

          // end the res
          res.once('end', function() {
            var idempotencyKey = req.get('Idempotency-Key');
            var cacheKey = generateCacheKey(req, idempotencyKey);
            var storedResponse = cache.get(cacheKey);
            if (!storedResponse) {
              throw new Error('Response was not stored in cache');
            }

            expect(storedResponse).to.have.property('statusCode');
            expect(storedResponse).to.have.property('body');
            expect(storedResponse).to.have.property('headers');

            done();
          });

          // set a dummy response status and body
          res.statusCode = 200;
          res.body = { id: 1234, description: 'Just a dummy!' };
          res.send();
        });
      });

      context('with stored response in the cache', function() {
        var responseToStore = {
          statusCode: 403,
          body: { exampleProp: 'hey there!' },
          headers: { 'x-dummy-header': 'hip hop hoop' },
        };

        before(function(done) {
          var idempotencyKey = 'just-a-dummy-key-2';
          req = httpMocks.createRequest({
            method: 'POST',
            url: '/test/path',
            headers: {
              'Idempotency-Key': idempotencyKey,
            },
          });
          
          res = httpMocks.createResponse({
            eventEmitter: require('events').EventEmitter
          });

          const cacheKey = generateCacheKey(req, idempotencyKey);
          cache.set(cacheKey, responseToStore);
          done();
        });

        it('returns a stored response from the cache', function(done) {
          res.once('end', function() {
            var idempotencyKey = req.get('Idempotency-Key');
            var cacheKey = generateCacheKey(req, idempotencyKey);
            var storedResponse = cache.get(cacheKey);
            if (!storedResponse) {
              throw new Error('Response was not stored in cache');
            }

            var expectedHeaders = responseToStore.headers;
            expectedHeaders['X-Cache'] = 'HIT'; // expect a cache header

            expect(res._getStatusCode()).to.equal(responseToStore.statusCode);
            expect(res._getData()).to.deep.equal(responseToStore.body);
            // headers are case-insensitive, but the comparison is not
            expect(Object.keys(res._getHeaders()).reduce((acc, key) => {
              acc[key.toLowerCase()] = res._getHeaders()[key];
              return acc;
            }, {})).to.deep.equal(Object.keys(expectedHeaders).reduce((acc, key) => {
              acc[key.toLowerCase()] = expectedHeaders[key];
              return acc;
            }, {}));

            done();
          });

          middleware(req, res, function next(error) {
            if (error) {
              console.log('err: ', error);
              throw new Error('Expected not to receive an error');
            }
          });
        });
      });
    });

    context('without idempotency-key header in request', function() {
      beforeEach(function(done) {
        req = httpMocks.createRequest({
          method: 'POST',
          url: '/test/path',
          headers: {},
        });
        res = httpMocks.createResponse({
          eventEmitter: require('events').EventEmitter
        });
        
        done();
      });

      it('does not store a response to the cache', function(done) {
        res.once('end', function() {
          var idempotencyKey = req.get('Idempotency-Key');
          var cacheKey = generateCacheKey(req, idempotencyKey);
          var storedResponse = cache.get(cacheKey);
          if (storedResponse) {
            throw new Error('A response was erroneously stored in cache');
          }
          done();
        });

        middleware(req, res, function next(error) {
          if (error) {
            throw new Error('Expected not to receive an error');
          }

          // set a dummy response status and body
          res.status(200);
          res.send({ id: 1234, description: 'Just a dummy!' });
        });
      });
    });
  });
});