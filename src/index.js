"use strict";

import { EventEmitter } from "events";
import { Cache } from "./Cache";
import { defaultValue } from "./utils/defaultValue";

const DEFAULT_PREFIX = "kakku";
const DEFAULT_USE_AFTER_STALE = false;
const DEFAULT_COLLAPSE_FETCHES = false;
const DEFAULT_COLLAPSE_GETS = false;

class Kakku extends EventEmitter {
    constructor ({ hashAlgorithm, store, prefix, useAfterStale, collapseFetches, collapseGets }) {
        if ( typeof hashAlgorithm !== "function" ) {
            throw new Error("`hashAlgorithm` is a required option");
        }

        if ( !store ) {
            throw new Error("`store` is a required option");
        }

        EventEmitter.call(this);
        this.prefix = defaultValue(prefix).to(DEFAULT_PREFIX);
        this.useAfterStale = defaultValue(useAfterStale).to(DEFAULT_USE_AFTER_STALE);
        this.collapseFetches = defaultValue(collapseFetches).to(DEFAULT_COLLAPSE_FETCHES);
        this.collapseGets = defaultValue(collapseGets).to(DEFAULT_COLLAPSE_GETS);
        this.hashAlgorithm = hashAlgorithm;
        this.store = store;
        this.caches = new Map();
    }

    register ({
        name,
        implementation,
        useAfterStale,
        collapseFetches,
        collapseGets,
        store,
    }) {
        const cache = new Cache({
            prefix: this.prefix,
            name: name,
            implementation: implementation,
            useAfterStale: defaultValue(useAfterStale).to(this.useAfterStale),
            collapseFetches: defaultValue(collapseFetches).to(this.collapseFetches),
            collapseGets: defaultValue(collapseGets).to(this.collapseGets),
            store: defaultValue(store).to(this.store),
            onEvent: (eventName, event) => { this.emit(eventName, event); },
        });

        this.caches.set(name, cache);
    }

    get (cacheName : string, parameters : object) {
        const cache = this.caches.get(cacheName);
        const key = this.hashAlgorithm(parameters);
        return cache.get(key, parameters);
    }
}

export { Kakku };
