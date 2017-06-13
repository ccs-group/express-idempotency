# Express Idempotency

Express Middleware to allow requests to be made idempotent if client passes an idempotency key header.

## Usage

```javascript
var idempotency = require('express-idempotency');
app.use(idempotency());
```

Requests with a `Idempotency-key` header will be cached, repeat requests will be returned from a cache.

## TODO

- Write tests
- Allow different header to be set
- Allow options to be passed to LRU cache
