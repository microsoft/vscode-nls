"use strict";
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.loadMessageBundle = exports.BundleFormat = exports.MessageFormat = void 0;
var ral_1 = require("../common/ral");
var common_1 = require("../common/common");
var common_2 = require("../common/common");
Object.defineProperty(exports, "MessageFormat", { enumerable: true, get: function () { return common_2.MessageFormat; } });
Object.defineProperty(exports, "BundleFormat", { enumerable: true, get: function () { return common_2.BundleFormat; } });
var nlsData;
try {
    // Requiring this file will be intercepted by VS Code and will contain actual NLS data.
    // @ts-ignore
    nlsData = require('vscode-nls-web-data');
}
catch (e) {
    console.error('Loading vscode-nls-web-data failed. Are you running this outside of VS Code? If so, you may need to intercept the import call with your bundled NLS data.');
    nlsData = {};
}
var options;
function loadMessageBundle(file) {
    if (!file) {
        // No file. We are in dev mode. Return the default
        // localize function.
        return common_1.localize;
    }
    // Remove extension since we load json files.
    if (file.endsWith('.js') || file.endsWith('.ts')) {
        file = file.substring(0, file.length - 3);
    }
    if (file.startsWith('/')) {
        file = file.substring(1);
    }
    if (nlsData && nlsData[file]) {
        return createScopedLocalizeFunction(nlsData[file]);
    }
    return function (key, message) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        if (typeof key === 'number') {
            throw new Error('Externalized strings were not present in the environment.');
        }
        else {
            return common_1.localize.apply(void 0, __spreadArray([key, message], args, false));
        }
    };
}
exports.loadMessageBundle = loadMessageBundle;
// This API doesn't really do anything in practice because the message bundle _has_ to be loaded
// ahead of time via 'vscode-nls-web-data'.
function config(opts) {
    var _a;
    (0, common_1.setPseudo)(((_a = options === null || options === void 0 ? void 0 : options.locale) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'pseudo');
    return loadMessageBundle;
}
exports.config = config;
function createScopedLocalizeFunction(messages) {
    return function (key, message) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        if ((0, common_1.isNumber)(key)) {
            if (key >= messages.length) {
                console.error("Broken localize call found. Index out of bounds. Stacktrace is\n: ".concat(new Error('').stack));
                return;
            }
            return (0, common_1.format)(messages[key], args);
        }
        else {
            if ((0, common_1.isString)(message)) {
                console.warn("Message ".concat(message, " didn't get externalized correctly."));
                return (0, common_1.format)(message, args);
            }
            else {
                console.error("Broken localize call found. Stacktrace is\n: ".concat(new Error('').stack));
            }
        }
    };
}
ral_1.default.install(Object.freeze({
    loadMessageBundle: loadMessageBundle,
    config: config
}));
//# sourceMappingURL=main.js.map