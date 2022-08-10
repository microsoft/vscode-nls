/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import RAL from './ral';

export enum BundleFormat {
	// the nls.bundle format
	standalone = 'standalone',
	languagePack = 'languagePack'
}

export interface Options {
	locale?: string;
	cacheLanguageResolution?: boolean;
	bundleFormat?: BundleFormat;
	dirNameHint?: string;
}

export interface InjectedContext {
	id?: string;
	metadataHash?: string;
	bundleKey: string;
}

export interface LocalizeInfo {
	key: string;
	comment: string[];
}

namespace LocalizeInfo {
	export function is(value: any): value is LocalizeInfo {
		let candidate = value as LocalizeInfo;
		return !!(candidate && candidate.key && candidate.comment);
	}
}

export interface LocalizeFunc {
	(info: LocalizeInfo, message: string, ...args: (string | number | boolean | undefined | null)[]): string;
	(key: string, message: string, ...args: (string | number | boolean | undefined | null)[]): string;
}

export interface LoadFunc {
	(context?: InjectedContext): LocalizeFunc;
}

export type SingleFileJsonFormat = string[] | { messages: string[]; keys: string[]; };

export interface NlsBundle {
	[key: string]: string[];
}

export type KeyInfo = string | LocalizeInfo;

export interface MetaDataEntry {
	messages: string[];
	keys: KeyInfo[];
}

export interface MetaDataFile {
	[key: string]: MetaDataEntry;
}

export interface TranslationConfig {
	[extension: string]: string;
}

export interface I18nBundle {
	version: string,
	contents: {
		[module: string]: {
			[messageKey: string]: string;
		};
	}
}

export let isPseudo = false;

export function setPseudo(pseudo: boolean) {
	isPseudo = pseudo;
}

export function format(message: string, args: any[]): string {
	let result: string;
	if (isPseudo) {
		// FF3B and FF3D is the Unicode zenkaku representation for [ and ]
		message = '\uFF3B' + message.replace(/[aouei]/g, '$&$&') + '\uFF3D';
	}
	if (args.length === 0) {
		result = message;
	}
	else {
		result = message.replace(/\{(\d+)\}/g, (match, rest) => {
			let index = rest[0];
			let arg = args[index];
			let replacement = match;
			if (typeof arg === 'string') {
				replacement = arg;
			}
			else if (typeof arg === 'number' || typeof arg === 'boolean' || arg === void 0 || arg === null) {
				replacement = String(arg);
			}
			return replacement;
		});
	}
	return result;
}

export function localize(_key: string | LocalizeInfo, message: string, ...args: any[]): string {
	return format(message, args);
}

export function loadMessageBundle(context?: InjectedContext): LocalizeFunc {
	return RAL().loadMessageBundle(context);
}

export function config(opts?: Options): LoadFunc {
	return RAL().config(opts);
}
