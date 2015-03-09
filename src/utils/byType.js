"use strict";

function byType (handlersByType) {
    return function handleErrorByType (error) {
        if ( error.type in handlersByType ) {
            return handlersByType[error.type](error);
        }

        return handlersByType.default(error);
    };
}

export { byType };
