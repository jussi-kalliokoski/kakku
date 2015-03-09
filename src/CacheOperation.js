"use strict";

import { CacheExpirationError } from "./errors/CacheExpirationError";
import { CacheMissError } from "./errors/CacheMissError";
import { CacheError } from "./errors/CacheError";
import { byType } from "./utils/byType";
import { after } from "./utils/after";
import { noop } from "./utils/noop";

function CacheOperation (cache, key, parameters, { useAfterStale }) {
    let startTime = process.hrtime();

    function emitHit (result, stale) {
        cache.emit("hit", {
            cacheName: cache.name,
            cacheKey: key,
            cacheParameters: parameters,
            stale: Boolean(stale),
            ttl: result.ttl,
            source: result.source,
            time: result.time,
        });

        return result;
    }

    function emitCacheError (error) {
        var cacheError = new CacheError(cache, key, parameters, startTime, error);
        cache.emit("error", cacheError);
        return handleMiss(cacheError);
    }

    function replenish () {
        return cache.fetch(key, parameters);
    }

    function handleMiss (error) {
        cache.emit("miss", error);
        return replenish();
    }

    function handleStale (error) {
        if ( !useAfterStale ) {
            return handleMiss(error);
        }

        replenish();
        return emitHit(error.result, true);
    }

    function handleResult (result) {
        if ( result == null ) {
            throw new CacheMissError(cache, key, parameters, startTime);
        }

        result = {
            source: result.source,
            ttl: result.ttl,
            data: result.data,
            time: process.hrtime(startTime),
        };

        if ( result.ttl <= 0 ) {
            throw new CacheExpirationError(cache, key, parameters, startTime, result);
        }

        return emitHit(result, false);
    }

    return cache.read(key, parameters)
        .then(handleResult)
        .catch(byType({
            CacheExpirationError: handleStale,
            CacheMissError: handleMiss,
            default: emitCacheError,
        }));
}

export { CacheOperation };
