"use strict";

function CacheError (cache, key, parameters, startTime, originalError) {
    this.message = "Fetching from cache returned an error";
    this.type = "CacheError";
    this.cacheName = cache.name;
    this.cacheKey = key;
    this.cacheParameters = parameters;
    this.time = process.hrtime(startTime);
    this.originalError = originalError;
}

CacheError.prototype = new Error();

export { CacheError };
