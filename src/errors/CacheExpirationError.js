"use strict";

function CacheExpirationError (cache, key, parameters, startTime, result) {
    this.message = "Cache expired";
    this.type = "CacheExpirationError";
    this.cacheName = cache.name;
    this.cacheKey = key;
    this.cacheParameters = parameters;
    this.time = process.hrtime(startTime);
    this.result = result;
}

CacheExpirationError.prototype = new Error();

export { CacheExpirationError };
