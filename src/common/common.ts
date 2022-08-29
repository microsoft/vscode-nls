/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import RAL from './ral';

export enum MessageFormat {
	file = 'file',
	bundle = 'bundle',
	both = 'both'
}

export enum BundleFormat {
	// the nls.bundle format
	standalone = 'standalone',
	languagePack = 'languagePack'
}

export interface Options {
	locale?: string;
	cacheLanguageResolution?: boolean;
	messageFormat?: MessageFormat;
	bundleFormat?: BundleFormat;
}

export interface LocalizeInfo {
	key: string;
	comment: string[];
}

namespace LocalizeInfo {
	export function is(value: any): value is LocalizeInfo {
		let candidate = value as LocalizeInfo;
		return candidate && isDefined(candidate.key) && isDefined(candidate.comment);
	}
}

export interface LocalizeFunc {
	(info: LocalizeInfo, message: string, ...args: (string | number | boolean | undefined | null)[]): string;
	(key: string, message: string, ...args: (string | number | boolean | undefined | null)[]): string;
}

export interface LoadFunc {
	(file?: string): LocalizeFunc;
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

export interface MetadataHeader {
	id: string;
	type: string;
	hash: string;
	outDir: string;
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

export interface LanguageBundle {
	header: MetadataHeader;
	nlsBundle: NlsBundle;
}

export function isDefined(value: any): boolean {
	return typeof value !== 'undefined';
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

export function loadMessageBundle(file?: string): LocalizeFunc {
	return RAL().loadMessageBundle(file);
}

export function config(opts?: Options): LoadFunc {
	return RAL().config(opts);
}