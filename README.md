# kakku

[![Build Status](https://travis-ci.org/jussi-kalliokoski/kakku.svg)](https://travis-ci.org/jussi-kalliokoski/kakku)
[![Coverage Status](https://img.shields.io/coveralls/jussi-kalliokoski/kakku.svg)](https://coveralls.io/r/jussi-kalliokoski/kakku)

A backend-agnostic cache layer designed with high performance and hit ratios in mind.

## Features

* Promise-based interface.
* Optional collapsing for concurrent gets of the same item to avoid excessive reads / recalculations.
* Optional usage of stale caches with refreshing on the background.

## Immutability / Caveats

It's worth noting that for performance reasons, Kakku assumes you don't mutate the data coming from the cache. In many cases multiple gets can return the same object, and thus modifying it will modify it for all the recipients. In development, it may be worth freezing the results you get from your caches just to be sure you don't touch them.

## API

### `Kakku`

A class for managing caches.

#### Options

* `hashAlgorithm` An function to use for creating hashes / cache keys out of the parameter objects. Required. The function is provided with the object to hash and should return the hash.
* `store` The storing backend to use. See the [Stores](#stores) section for a list of supported stores.
* `prefix` The prefix to use for the cache keys. Defaults to `kakku`.
* `collapseGets` If true, all get operations with the same parameters to the same cache are collapsed to one active operation. This helps reduce the number of reads and recalculations. Defaults to `false`.
* `collapseFetches` If true, all refreshes with the same parameters to the same cache are collapsed to one active operation. This helps reduce the number of writes and recalculations. Defaults to `false`.
* `useAfterStale` If true, results from the cache will be used after stale and the caches will be refreshed in the background. This helps provide more stable response times. Defaults to `false`.

#### Methods

##### `register(options)`

Registers a new cache by name.

###### Options

* `name` The name of the cache.
* `store` Allows overwriting the default store of the Kakku instance on a per-cache basis.
* `collapseGets` Allows overwriting the default get mode of the Kakku instance on a per-cache basis.
* `collapseFetches` Allows overwriting the default fetch mode of the Kakku instance on a per-cache basis.
* `useAfterStale` Allows overwriting the default stale cache behavior of the Kakku instance on a per-cache basis.
* `implementation` The method to call to calculate the value of the cache. Is given the cache parameters and should return a promise of an object with the following keys:
  - `data` The result of the calculation.
  - `ttl` The [TTL](http://en.wikipedia.org/wiki/Time_to_live) of the result, in milliseconds.

##### `get(key, parameters)`

Gets an item from the cache.

##### Arguments

* `name` The name of the cache to get the item from.
* `parameters` The parameters to get with. Used for the cache key and fed to the implementation.

##### Returns

A promise of an object with the following keys:

* `data` The result of the calculation.
* `ttl` The [TTL](http://en.wikipedia.org/wiki/Time_to_live) of the result, in milliseconds.

### Events

All events have the following properties:

* `cacheName` The name of the cache.
* `cacheKey` The key used for the operation.
* `cacheParameters` The parameters used for the operation.

#### `error`

Fired when the Store implementation returns an error (this should never happen unless your Store is broken).

##### Properties

* `originalError` The original error given by the Store implementation.
* `time` The time the failed operation took. In high-resolution time.

#### `hit`

Fired when there is a cache hit.

##### Properties

* `ttl` The remainining TTL of the result, in milliseconds.
* `stale` A boolean indicating whether the result was stale.
* `time` The time getting the item from cache took. In high-resolution time.
* `source` The name of the Store that provided the result.

#### `miss`

Fired when there is a cache miss.

##### Properties

* `time` The time getting a miss from cache took. In high-resolution time.

#### Operations

All of the following operations are monitored:

* `get` When a new get is issued and not collapsed into an existing one.
* `collapsed_get` When a new get is issued and collapsed into an existing one.
* `fetch` When a new calculation is needed and not collapsed into an existing one.
* `collapsed_fetch` When a new calculation is needed and collapsed into an existing one.
* `write` When writing to the store.
* `read` When reading from the store.

Emitting the following events:

##### `{{operation name}}_started`

Emitted when the operation has started.

##### `{{operation name}}_finished`

Emitted when the operation has finished, regardless of success.

##### `{{operation name}}_success`

Emitted when the operation has finished successfully.

##### `{{operation name}}_error`

Emitted when the operation has finished with an error.

##### Properties

The events have the following properties:

* `cacheName` The name of the cache.
* `cacheKey` The key used for the operation.
* `cacheParameters` The parameters used for the operation.
* `time` The time the operation took. In high-resolution time. Not availabled on the `{{operation name}}_started`

#####

## Stores

There are currently three officially supported store implementations for Kakku:

* [kakku-lru-cache-store](https://github.com/jussi-kalliokoski/kakku-lru-cache-store) is a [lru-cache](https://github.com/isaacs/node-lru-cache)-backed in-memory Store for Kakku.
* [kakku-redis-store](https://github.com/jussi-kalliokoski/kakku-redis-store) is a [redis](https://github.com/mranney/node_redis)-backed Store for Kakku.
* [kakku-multi-store](https://github.com/jussi-kalliokoski/kakku-multi-store) is a Store that allows you to use multiple Stores for fallbacks and performance.

## Other recommended modules

* [object-hash](https://www.npmjs.com/package/object-hash) is the recommended `hashAlgorithm`.
* [es6-promise](https://github.com/jakearchibald/es6-promise) if you're on node.js <0.12.x you'll need a polyfill for ES6 Promises. On iojs and node.js 0.12.x and later these are supported natively.
* [es6-collections](https://github.com/WebReflection/es6-collections) if you're on node.js <0.12.x you'll need a polyfill for ES6 Maps. On iojs and node.js 0.12.x and later these are supported natively.

## Examples / Patterns

### Basic usage with Redis and object-hash

```javascript
var hash = require("object-hash");
var Redis = require("redis");
var Kakku = require("kakku").Kakku;
var RedisStore = require("kakku-redis-store").RedisStore;

var redisClient = redis.createClient();

var kakku = new Kakku({
    prefix: "cache",
    hashAlgorithm: hash,
    store: new RedisStore({ client: redisClient }),
});

kakku.register({
    name: "foo",
    implementation: function (parameters) {
        return Promise.resolve({
            data: {
                x: parameters.y + 1,
            },
            ttl: 1000 * 60 * 30, // half an hour
        });
    },
});

kakku.get("foo", { y: 1000 }).then(function (result) {
    console.log(result.data.x) // 1001
}).then(function (error) {
    // whoops something bad happened
});
```

### Passing in parameters that aren't cacheable

Sometimes you need to pass in values that should be ignored by the caching, but are required to get the data, for example a user-specific access token. For this you can easily create a custom hashing algorithm, for example using [lodash](https://lodash.com/) and [object-hash](https://www.npmjs.com/package/object-hash).

```javascript
var hash = require("object-hash");
var _ = require("lodash");

function hashAlgorithm (object) {
    return hash(_.omit(object, [
        "accessToken",
        "foo",
        // etc.
    ]));
}

var kakku = new Kakku({
    hashAlgorithm: hashAlgorithm,
    ...
});
```

### Using multiple Stores

With [kakku-multi-store](https://github.com/jussi-kalliokoski/kakku-multi-store) you can use multiple backing Stores, for example if you want to use an in-memory LRU Store for fast access and Redis for shared, bigger working set. The MultiStore returns the result of the first underlying store not to return an error or empty.

```javascript
...

var kakku = new Kakku({
    ...
    store: new MultiStore({ stores: [
        LruCacheStore({ client: LRU({ max: 500 }) }),
        RedisStore({ client: redisClient }),
    ] }),
});
```

## Development

Development is pretty straightforward, it's all JS and the standard node stuff works:

To install dependencies:

```bash
$ npm install
```

To run the tests:

```bash
$ npm test
```

Then just make your awesome feature and a PR for it. Don't forget to file an issue first, or start with an empty PR so others can see what you're doing and discuss it so there's a a minimal amount of wasted effort.
