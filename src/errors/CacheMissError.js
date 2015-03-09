"use strict";

function CacheMissError (cache, key, parameters, startTime) {
    this.message = "Cache missed";
    this.type = "CacheMissError";
    this.cacheName = cache.name;
    this.cacheKey = key;
    this.cacheParameters = parameters;
    this.time = process.hrtime(startTime);
}

CacheMissError.prototype = new Error();

export { CacheMissError };
