"use strict";

function after (promise, callback) {
    promise.then(function (result) {
        callback();
        return result;
    });

    promise.catch(function (error) {
        callback();
        return Promise.reject(error);
    });
}

export { after };
