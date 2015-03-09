"use strict";

function defaultValue (value : any) {
    return {
        to (otherValue : any) {
            return value != null ? value : otherValue;
        }
    };
}

export { defaultValue };
