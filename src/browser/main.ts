/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import RAL from '../common/ral';

// Requiring this file will be intercepted by VS Code and will contain actual NLS data.
import * as nlsData from './vscode-nls-web-data';

import { setPseudo, localize, Options, LocalizeInfo, isString, MessageFormat, isNumber, format, LocalizeFunc } from '../common/common';
export { MessageFormat, BundleFormat, Options, LocalizeInfo, LocalizeFunc, LoadFunc, KeyInfo } from '../common/common';

interface InternalOptions {
	locale: string | undefined;
	language: string | undefined;
	languagePackSupport: boolean;
	cacheLanguageResolution: boolean;
	messageFormat: MessageFormat;
	languagePackId?: string;
	cacheRoot?: string;
}

let options: InternalOptions;

export function loadMessageBundle(file?: string) {
	if (!file) {
		// No file. We are in dev mode. Return the default
		// localize function.
		return localize;
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
	return function (key: string | number | LocalizeInfo, message: string, ...args: any[]): string {
		if (typeof key === 'number') {
			throw new Error('Externalized strings were not present in the environment.');
		} else {
			return localize(key, message, ...args);
		}
	};
}

// This API doesn't really do anything in practice because the message bundle _has_ to be loaded
// ahead of time via 'vscode-nls-web-data'.
export function config(opts?: Options) {
	setPseudo(options?.locale?.toLowerCase() === 'pseudo');
	return loadMessageBundle;
}

function createScopedLocalizeFunction(messages: string[]): LocalizeFunc {
	return function (key: any, message: string, ...args: any[]): string {
		if (isNumber(key)) {
			if (key >= messages.length) {
				console.error(`Broken localize call found. Index out of bounds. Stacktrace is\n: ${(<any>new Error('')).stack}`);
				return;
			}
			return format(messages[key], args);
		} else {
			if (isString(message)) {
				console.warn(`Message ${message} didn't get externalized correctly.`);
				return format(message, args);
			} else {
				console.error(`Broken localize call found. Stacktrace is\n: ${(<any>new Error('')).stack}`);
			}
		}
	};
}

RAL.install(Object.freeze<RAL>({
	loadMessageBundle: loadMessageBundle,
	config: config
}));