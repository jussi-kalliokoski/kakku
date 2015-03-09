"use strict";

import { CacheOperation } from "./CacheOperation";
import { CacheError } from "./errors/CacheError";
import { after } from "./utils/after";

class Cache {
    constructor ({ name, implementation, store, prefix, useAfterStale, collapseGets, collapseFetches, onEvent }) {
        this.name = name;
        this.implementation = implementation;
        this.store = store;
        this.prefix = prefix;
        this.useAfterStale = useAfterStale;
        this.onEvent = onEvent;
        this.collapsedOperations = {
            get: collapseGets,
            fetch: collapseFetches,
        };
        this.operationQueues = {
            get: new Map(),
            fetch: new Map(),
        };
    }

    measure (operationName, operation, key, parameters) {
        var startTime = process.hrtime();

        this.emit(`${operationName}_started`, {
            cacheName: this.name,
            cacheKey: key,
            cacheParameters: parameters,
        });

        var emitFinish = (type) => {
            return () => {
                this.emit(`${operationName}_${type}`, {
                    cacheName: this.name,
                    cacheKey: key,
                    cacheParameters: parameters,
                    time: process.hrtime(startTime),
                });
            };
        }

        operation.then(emitFinish("success"));
        operation.catch(emitFinish("error"));
        after(operation, emitFinish("finished"));
    }

    prefixKey (key) {
        return this.prefix + ":" + this.name + ":" + key;
    }

    write (key, parameters, value) {
        var operation = this.store.set(this.prefixKey(key), value);
        this.measure("write", operation, key, parameters);
        var startTime = process.hrtime();
        operation.catch((error) => {
            this.emit("error", new CacheError(this, key, parameters, startTime, error));
        });
        return operation;
    }

    read (key, parameters) {
        var operation = this.store.get(this.prefixKey(key));
        this.measure("read", operation, key, parameters);
        return operation;
    }

    queue (operationName, key, parameters, run) {
        if ( !this.collapsedOperations[operationName] ) {
            let job = run();
            this.measure(operationName, job, key, parameters);
            return job;
        }

        const queue = this.operationQueues[operationName];
        let job = queue.get(key);

        if ( !job ) {
            job = run();
            queue.set(key, job);

            after(job, () => {
                queue.delete(key);
            });

            this.measure(operationName, job, key, parameters);

            return job;
        }

        this.measure("collapsed_" + operationName, job, key, parameters);

        return job;
    }

    fetch (key, parameters) {
        return this.queue("fetch", key, parameters, () => {
            var operation = this.implementation(parameters);
            operation.then( (value) => this.write(key, parameters, value) );
            return operation;
        });
    }

    get (key : string, parameters : object) {
        return this.queue("get", key, parameters, () => {
            return new CacheOperation(this, key, parameters, {
                useAfterStale: this.useAfterStale,
            });
        });
    }

    emit (eventName, event) {
        this.onEvent(eventName, event);
    }
}

export { Cache };
