/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import RAL from '../common/ral';

import { setPseudo, localize, Options, LocalizeInfo } from '../common/common';

export { MessageFormat, BundleFormat, Options, LocalizeInfo, LocalizeFunc, LoadFunc, KeyInfo } from '../common/common';

export function loadMessageBundle(_file?: string) {
	return function (key: string | number | LocalizeInfo, message: string, ...args: any[]): string {
		if (typeof key === 'number') {
			throw new Error(`Browser implementation does currently not support externalized strings.`);
		} else {
			return localize(key, message, ...args);
		}
	};
}

export function config(options?: Options) {
	setPseudo(options?.locale?.toLowerCase() === 'pseudo');
	return loadMessageBundle;
}

RAL.install(Object.freeze<RAL>({
	loadMessageBundle: loadMessageBundle,
	config: config
}));