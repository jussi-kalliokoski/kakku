"use strict";

require("source-map-support").install();
require("es6-promise").polyfill();
require("es6-collections");

var chai = require("chai");
var sinon = require("sinon");
var sinonChai = require("sinon-chai");

chai.use(sinonChai);
chai.should();

global.sinon = sinon;
global.chai = chai;
global.expect = chai.expect;
