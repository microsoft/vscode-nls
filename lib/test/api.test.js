"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var nls = require("../../node");
var nlsBrowser = require("../../browser");
describe('API', function () {
    it('Exports same symbol names in both browser and node entry points', function () {
        assert.deepEqual(Object.keys(nls), Object.keys(nlsBrowser));
    });
});
//# sourceMappingURL=api.test.js.map