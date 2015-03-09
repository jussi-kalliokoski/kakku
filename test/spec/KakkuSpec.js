"use strict";

var { Kakku } = require("../..");

describe("Kakku", function () {
    const DEFAULT_PREFIX = "prefix";
    const DEFAULT_SETUP = { prefix: DEFAULT_PREFIX };
    const DEFAULT_PARAMS = { id: "foobar", bar: "qoo" };
    const DEFAULT_CACHE_NAME = "cache_name";
    const DEFAULT_KEY = "prefix:cache_name:foobar";
    const DEFAULT_VALUE = { meow: "dog" };
    const MOCK_STORE_NAME = "MockStore";
    var mockStore;
    var implementation;
    var kakku;
    var result;
    var eventHandlers;
    var ttl;

    function wait () {
        // this makes sure all resolved async operations are flushed
        beforeEach(function () {
            return Promise.resolve();
        });
    }

    function mockHashAlgorithm (object) {
        return object.id;
    }

    function MockStore (data) {
        function handleError (delegate) {
            var wrapper = sinon.spy(function () {
                return new Promise( (resolve, reject) => {
                    const error = wrapper.nextError;
                    wrapper.nextError = null;
                    if ( error ) { return resolve(Promise.reject(error)); }
                    resolve(delegate.apply(this, arguments));
                });
            });

            wrapper.nextError = null;

            return wrapper;
        }

        return {
            data: new Map(data),

            get: handleError(function (key) {
                if ( !this.data.has(key) ) { return Promise.resolve(null); }
                var value = JSON.parse(this.data.get(key));
                return Promise.resolve({
                    source: MOCK_STORE_NAME,
                    data: value.data,
                    ttl: value.ttl,
                });
            }),

            set: handleError(function (key, value) {
                this.data.set(key, JSON.stringify(value));
                return Promise.resolve();
            }),
        };
    }

    function defaultImplementation () {
        if ( implementation.nextError ) {
            return Promise.reject(implementation.nextError);
        }

        return Promise.resolve({
            data: DEFAULT_VALUE,
            ttl: 1000,
        });
    }

    function setupEventHandlers () {
        eventHandlers = new Map();
        void [
            "miss",
            "hit",
            "error",
            "get_started",
            "get_error",
            "get_success",
            "get_finished",
            "collapsed_get_started",
            "collapsed_get_error",
            "collapsed_get_success",
            "collapsed_get_finished",
            "write_started",
            "write_error",
            "write_success",
            "write_finished",
            "read_started",
            "read_error",
            "read_success",
            "read_finished",
            "fetch_started",
            "fetch_error",
            "fetch_success",
            "fetch_finished",
            "collapsed_fetch_started",
            "collapsed_fetch_error",
            "collapsed_fetch_success",
            "collapsed_fetch_finished",
        ].forEach(function (eventName) {
            var spy = sinon.spy();
            eventHandlers.set(eventName, spy);
            kakku.on(eventName, spy);
        });
    }

    function setupKakku (options=DEFAULT_SETUP) {
        beforeEach(function () {
            kakku = new Kakku({
                collapseFetches: options.collapseFetches,
                collapseGets: options.collapseGets,
                useAfterStale: options.useAfterStale,
                prefix: options.prefix,
                store: mockStore,
                hashAlgorithm: mockHashAlgorithm,
            });

            kakku.setMaxListeners(999);
            setupEventHandlers();
        });
    }

    function createEmptyData () {
        return [];
    }

    function setupStore (dataFactory=createEmptyData) {
        beforeEach(function () {
            mockStore = new MockStore(dataFactory());
        });
    }

    function setupDefaultCache () {
        beforeEach(function () {
            implementation = sinon.spy(defaultImplementation);
            kakku.register({
                name: DEFAULT_CACHE_NAME,
                implementation: implementation,
            });
        });
    }

    function fetchDefaultFromCache () {
        beforeEach(function () {
            return kakku.get(DEFAULT_CACHE_NAME, DEFAULT_PARAMS).then(function (data) {
                result = data;
            });
        });
    }

    function fetchDefaultFromCacheMultipleTimes (times) {
        beforeEach(function () {
            return Promise.all(Array.apply(null, Array(times)).map(function () {
                return kakku.get(DEFAULT_CACHE_NAME, DEFAULT_PARAMS);
            })).then(function (data) {
                result = data;
            });
        });
    }

    function fetchDefaultFromCacheExpectingAnError () {
        beforeEach(function () {
            return kakku.get(DEFAULT_CACHE_NAME, DEFAULT_PARAMS).then(function (data) {
                expect(data).to.not.exist;
            }).catch(function (error) {
                error.message.should.equal("testing");
            });
        });
    }

    function throwErrorOn (operationName) {
        beforeEach(function () {
            mockStore[operationName].nextError = new Error("testing");
        });
    }

    function throwErrorOnFetch () {
        beforeEach(function () {
            implementation.nextError = new Error("testing");
        });
    }

    function createBasicData (dataTtl=1000) {
        return function () {
            ttl = dataTtl;
            return [[DEFAULT_KEY, JSON.stringify({
                data: { cat: "foo" },
                ttl: dataTtl,
            })]];
        };
    }

    function itShouldCalculateTheValue (times="Once") {
        it("should calculate the value", function () {
            implementation.should.have.been["called" + times];
            implementation.should.have.been.calledWith(DEFAULT_PARAMS);
        });
    }

    function itShouldNotCalculateTheValue () {
        it("should not calculate the value", function () {
            implementation.should.not.have.been.called;
        });
    }

    function itShouldPopulateTheCache (times="Once") {
        it("should populate the cache", function () {
            var value = mockStore.data.get(DEFAULT_KEY);
            expect(value).to.exist;
            var deserialized = JSON.parse(value);
            deserialized.data.should.deep.equal(DEFAULT_VALUE);
            deserialized.ttl.should.equal(1000);
            mockStore.set.should.have.been["called" + times];
        });
    }

    function itShouldNotPopulateTheCache () {
        it("should not populate the cache", function () {
            mockStore.set.should.not.have.been.called;
        });
    }

    function itShouldReturnTheCachedValue () {
        it("should return the cached value", function () {
            result.data.cat.should.equal("foo");
        });
    }

    function itShouldReturnTheCalculatedValue () {
        it("should return the cached value", function () {
            if ( Array.isArray(result) ) {
                result.forEach(function (result) {
                    result.data.meow.should.equal("dog");
                });
            } else {
                result.data.meow.should.equal("dog");
            }
        });
    }

    function createEmitChecker (eventName) {
        var spy;
        beforeEach(function () {
            spy = sinon.spy();
            kakku.on(eventName, spy);
        });

        return function () {
            return spy;
        };
    }

    function noop () {}

    function itShouldEmit (eventName, validator=noop) {
        it("should emit `" + eventName + "`", function () {
            var spy = eventHandlers.get(eventName);
            spy.should.have.been.called;
            validator(spy);
        });
    }

    function itShouldNotEmit (eventName) {
        it("should not emit `" + eventName + "`", function () {
            eventHandlers.get(eventName).should.not.have.been.called;
        });
    }

    function validateTimeMeasurement (time) {
        time.length.should.equal(2);
        time[0].should.be.at.least(0);
        time[1].should.be.at.least(0);
    }

    function validateEvent (event) {
        event.cacheName.should.equal(DEFAULT_CACHE_NAME);
        event.cacheKey.should.equal("foobar");
        event.cacheParameters.should.equal(DEFAULT_PARAMS);
    }

    function itShouldMeasure (operationName, resultType, times="Once") {
        var startedEvent = operationName + "_started";
        var finishedEvent = operationName + "_finished";
        var successEvent = operationName + "_success";
        var errorEvent = operationName + "_error";

        it("should measure `" + operationName + "` (emitting a `started` event)", function () {
            eventHandlers.get(startedEvent).should.have.been["called" + times];
            var event = eventHandlers.get(startedEvent).args[0][0];
            validateEvent(event);
        });

        it("should measure `" + operationName + "` (emitting a `finished` event)", function () {
            eventHandlers.get(finishedEvent).should.have.been["called" + times];
            var event = eventHandlers.get(finishedEvent).args[0][0];
            validateEvent(event);
            validateTimeMeasurement(event.time);
        });

        if ( resultType === "success" ) {
            it("should measure `" + operationName + "` (emitting a `success` event)", function () {
                eventHandlers.get(successEvent).should.have.been["called" + times];
                var event = eventHandlers.get(successEvent).args[0][0];
                validateEvent(event);
                validateTimeMeasurement(event.time);
            });

            it("should measure `" + operationName + "` (not emitting an `error` event)", function () {
                eventHandlers.get(errorEvent).should.not.have.been.called;
            });
        } else {
            it("should measure `" + operationName + "` (not emitting a `success` event)", function () {
                eventHandlers.get(successEvent).should.not.have.been.called;
            });

            it("should measure `" + operationName + "` (emitting an `error` event)", function () {
                eventHandlers.get(errorEvent).should.have.been["called" + times];
                var event = eventHandlers.get(errorEvent).args[0][0];
                validateEvent(event);
                validateTimeMeasurement(event.time);
            });
        }
    }

    function itShouldNotMeasure (operationName) {
        var startedEvent = operationName + "_started";
        var finishedEvent = operationName + "_finished";
        var successEvent = operationName + "_success";
        var errorEvent = operationName + "_error";

        it("should measure `" + operationName + "`", function () {
            eventHandlers.get(startedEvent).should.not.have.been.called;
            eventHandlers.get(finishedEvent).should.not.have.been.called;
            eventHandlers.get(successEvent).should.not.have.been.called;
            eventHandlers.get(errorEvent).should.not.have.been.called;
        });
    }

    function itShouldEmitMiss (times="Once") {
        itShouldEmit("miss", function (spy) {
            spy.should.have.been["called" + times];
            var event = spy.args[0][0];
            validateEvent(event);
            validateTimeMeasurement(event.time);
        });
    }

    function itShouldEmitHit (options={}) {
        var stale = "stale" in options ? options.stale : false;
        var times = "times" in options ? options.times : "Once";
        itShouldEmit("hit", function (spy) {
            spy.should.have.been["called" + times];
            var event = spy.args[0][0];
            validateEvent(event);
            validateTimeMeasurement(event.time);
            event.stale.should.equal(stale);
            event.ttl.should.equal(ttl);
        });
    }

    function itShouldEmitError (times="Once") {
        itShouldEmit("error", function (spy) {
            spy.should.have.been["called" + times];
            var error = spy.args[0][0];
            error.type.should.equal("CacheError");
            error.originalError.message.should.equal("testing");
            validateEvent(error);
            validateTimeMeasurement(error.time);
        });
    }


    describe("when initialized without a hash algorithm", function () {
        var error;

        beforeEach(function () {
            try {
                new Kakku({ store: new MockStore() });
            } catch (err) {
                error = err;
            }
        });

        it("should throw an error", function () {
            error.should.be.an.instanceOf(Error);
        });
    });

    describe("when initialized without a store", function () {
        var error;

        beforeEach(function () {
            try {
                new Kakku({ hashAlgorithm: defaultHashAlgorithm });
            } catch (err) {
                error = err;
            }
        });

        it("should throw an error", function () {
            error.should.be.an.instanceOf(Error);
        });
    });

    describe("when the cache is empty", function () {
        setupStore();
        setupKakku();
        setupDefaultCache();
        fetchDefaultFromCache();
        wait();

        itShouldReturnTheCalculatedValue();
        itShouldCalculateTheValue();
        itShouldPopulateTheCache();
        itShouldMeasure("fetch", "success");
        itShouldMeasure("get", "success");
        itShouldMeasure("write", "success");
        itShouldMeasure("read", "success");
        itShouldEmitMiss();
        itShouldNotEmit("hit");
        itShouldNotEmit("error");
    });

    describe("when the cache errors out on read", function () {
        setupStore();
        setupKakku();
        setupDefaultCache();
        throwErrorOn("get");
        fetchDefaultFromCache();
        wait();

        itShouldReturnTheCalculatedValue();
        itShouldCalculateTheValue();
        itShouldPopulateTheCache();
        itShouldMeasure("fetch", "success");
        itShouldMeasure("get", "success");
        itShouldMeasure("write", "success");
        itShouldMeasure("read", "error");
        itShouldEmitMiss();
        itShouldEmitError();
        itShouldNotEmit("hit");
    });

    describe("when the cache is fresh", function () {
        setupStore(createBasicData());
        setupKakku();
        setupDefaultCache();
        fetchDefaultFromCache();
        wait();

        itShouldReturnTheCachedValue();
        itShouldNotCalculateTheValue();
        itShouldNotPopulateTheCache();
        itShouldMeasure("get", "success");
        itShouldMeasure("read", "success");
        itShouldNotMeasure("fetch");
        itShouldNotMeasure("write");
        itShouldEmitHit();
        itShouldNotEmit("miss");
        itShouldNotEmit("error");
    });

    describe("when the cache is stale and `useAfterStale` is true", function () {
        setupStore(createBasicData(-1));
        setupKakku({ prefix: DEFAULT_PREFIX, useAfterStale: true });
        setupDefaultCache();
        fetchDefaultFromCache();
        wait();

        itShouldReturnTheCachedValue();
        itShouldCalculateTheValue();
        itShouldPopulateTheCache();
        itShouldMeasure("fetch", "success");
        itShouldMeasure("get", "success");
        itShouldMeasure("write", "success");
        itShouldMeasure("read", "success");
        itShouldEmitHit({ stale: true });
        itShouldNotEmit("miss");
        itShouldNotEmit("error");
    });

    describe("when the cache is stale and `useAfterStale` is false", function () {
        setupStore(createBasicData(-1));
        setupKakku({ prefix: DEFAULT_PREFIX, useAfterStale: false });
        setupDefaultCache();
        fetchDefaultFromCache();
        wait();

        itShouldReturnTheCalculatedValue();
        itShouldCalculateTheValue();
        itShouldPopulateTheCache();
        itShouldMeasure("fetch", "success");
        itShouldMeasure("get", "success");
        itShouldMeasure("write", "success");
        itShouldMeasure("read", "success");
        itShouldEmitMiss();
        itShouldNotEmit("hit");
        itShouldNotEmit("error");
    });

    describe("when writing to cache errors out", function () {
        setupStore();
        setupKakku();
        setupDefaultCache();
        throwErrorOn("set");
        fetchDefaultFromCache();
        wait();

        itShouldReturnTheCalculatedValue();
        itShouldCalculateTheValue();
        itShouldMeasure("fetch", "success");
        itShouldMeasure("get", "success");
        itShouldMeasure("read", "success");
        itShouldMeasure("write", "error");
        itShouldEmitMiss();
        itShouldEmitError();
        itShouldNotEmit("hit");
    });

    describe("when fetching errors out", function () {
        setupStore();
        setupKakku();
        setupDefaultCache();
        throwErrorOnFetch();
        fetchDefaultFromCacheExpectingAnError();
        wait();

        itShouldNotPopulateTheCache();
        itShouldMeasure("fetch", "error");
        itShouldMeasure("get", "error");
        itShouldMeasure("read", "success");
        itShouldNotMeasure("write");
        itShouldEmitMiss();
        itShouldNotEmit("error");
        itShouldNotEmit("hit");
    });

    describe("when fetching is not collapsed and two gets are issued simultaneously", function () {
        setupStore();
        setupKakku({ prefix: DEFAULT_PREFIX, collapseFetches: false });
        setupDefaultCache();
        fetchDefaultFromCacheMultipleTimes(2);
        wait();

        itShouldCalculateTheValue("Twice");
        itShouldPopulateTheCache("Twice");
        itShouldMeasure("fetch", "success", "Twice");
        itShouldMeasure("get", "success", "Twice");
        itShouldMeasure("write", "success", "Twice");
        itShouldMeasure("read", "success", "Twice");
        itShouldNotMeasure("collapsed_fetch");
        itShouldEmitMiss("Twice");
        itShouldNotEmit("hit");
        itShouldNotEmit("error");
    });

    describe("when fetching is collapsed and two gets are issued simultaneously", function () {
        setupStore();
        setupKakku({ prefix: DEFAULT_PREFIX, collapseFetches: true });
        setupDefaultCache();
        fetchDefaultFromCacheMultipleTimes(2);
        wait();

        itShouldCalculateTheValue();
        itShouldPopulateTheCache();
        itShouldMeasure("fetch", "success");
        itShouldMeasure("collapsed_fetch", "success");
        itShouldMeasure("write", "success");
        itShouldMeasure("get", "success", "Twice");
        itShouldMeasure("read", "success", "Twice");
        itShouldEmitMiss("Twice");
        itShouldNotEmit("hit");
        itShouldNotEmit("error");
    });

    describe("when getting is not collapsed and two gets are issued simultaneously", function () {
        setupStore();
        setupKakku({ prefix: DEFAULT_PREFIX, collapseGets: false });
        setupDefaultCache();
        fetchDefaultFromCacheMultipleTimes(2);
        wait();

        itShouldCalculateTheValue("Twice");
        itShouldPopulateTheCache("Twice");
        itShouldMeasure("fetch", "success", "Twice");
        itShouldMeasure("get", "success", "Twice");
        itShouldMeasure("write", "success", "Twice");
        itShouldMeasure("read", "success", "Twice");
        itShouldNotMeasure("collapsed_get");
        itShouldEmitMiss("Twice");
        itShouldNotEmit("hit");
        itShouldNotEmit("error");
    });

    describe("when getting is collapsed and two gets are issued simultaneously", function () {
        setupStore();
        setupKakku({ prefix: DEFAULT_PREFIX, collapseGets: true });
        setupDefaultCache();
        fetchDefaultFromCacheMultipleTimes(2);
        wait();

        itShouldCalculateTheValue();
        itShouldPopulateTheCache();
        itShouldMeasure("fetch", "success");
        itShouldMeasure("write", "success");
        itShouldMeasure("get", "success");
        itShouldMeasure("read", "success");
        itShouldMeasure("collapsed_get", "success");
        itShouldEmitMiss();
        itShouldNotEmit("hit");
        itShouldNotEmit("error");
    });
});
