/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import * as fs from 'fs';

export interface Options {
	locale?: string;
	cacheLanguageResolution?: boolean;
}

export interface LocalizeInfo {
	key: string;
	comment: string[];
}

export interface LocalizeFunc {
	(info: LocalizeInfo, message: string, ...args: any[]): string;
	(key: string, message: string, ...args: any[]): string;
}

export interface LoadFunc {
	(file?: string): LocalizeFunc;
}

let _options: Options = { locale: 'en-US', cacheLanguageResolution: true };
let _isPseudo: boolean = false;
let _resolvedLanguage: string = null;

const toString = Object.prototype.toString;

function isDefined(value: any): boolean {
	return typeof value !== 'undefined';
}

function isNumber(value: any): value is number {
	return toString.call(value) === '[object Number]';
}

function isString(value: any): value is string {
	return toString.call(value) === '[object String]';
}

function isBoolean(value: any): value is boolean {
	return value === true || value === false;
}

function format(message: string, args: any[]): string {
	let result:string;

	if (_isPseudo) {
		// FF3B and FF3D is the Unicode zenkaku representation for [ and ]
		message = '\uFF3B' + message.replace(/[aouei]/g, '$&$&') + '\uFF3D';
	}

	if (args.length === 0) {
		result = message;
	} else {
		result = message.replace(/\{(\d+)\}/g, (match, rest) => {
			let index = rest[0];
			return typeof args[index] !== 'undefined' ? args[index] : match;
		});
	}
	return result;
}


function createScopedLocalizeFunction(messages: string[]): LocalizeFunc {
	return function(key: any, message: string, ...args: any[]): string {
		if (isNumber(key)) {
			return format(messages[key], args);
		} else {
			if (isString(message)) {
				console.warn(`Message ${message} didn't get externalized correctly.`);
				return format(message, args);
			} else {
				console.error(`Broken localize call found. Stacktrace is\n: ${(<any>new Error('')).stack}`);
			}
		}
	}
}

function localize(key: string | LocalizeInfo, message: string, ...args: any[]): string {
	return format(message, args);
}

function resolveLanguage(file: string): string {
	let ext = path.extname(file);
	if (ext) {
		file = file.substr(0, file.length - ext.length);
	}
	let resolvedLanguage: string;
	if (_options.cacheLanguageResolution && _resolvedLanguage) {
		resolvedLanguage = _resolvedLanguage;
	} else {
		if (_isPseudo || !_options.locale) {
			resolvedLanguage = '.nls.json';
		} else {
			let locale = _options.locale;
			while (locale) {
				var candidate = '.nls.' + locale + '.json' ;
				if (fs.existsSync(file + candidate)) {
					resolvedLanguage = candidate;
					break;
				} else {
					var index = locale.lastIndexOf('-');
					if (index > 0) {
						locale = locale.substring(0, index);
					} else {
						resolvedLanguage = '.nls.json';
						locale = null;
					}
				}
			}
		}
		if (_options.cacheLanguageResolution) {
			_resolvedLanguage = resolvedLanguage;
		}
	}
	return file + resolvedLanguage;
}

type JsonFormat = string[] | { messages: string[]; keys: string[]; };

export function loadMessageBundle(file?: string): LocalizeFunc {
	if (!file) {
		return localize;
	} else {
		let resolvedFile = resolveLanguage(file);
		try {
			let json: JsonFormat = require(resolvedFile);
			if (Array.isArray(json)) {
				return createScopedLocalizeFunction(json);
			} else {
				if (isDefined(json.messages) && isDefined(json.keys)) {
					return createScopedLocalizeFunction(json.messages);
				} else {
					console.error(`String bundle '${file}' uses an unsupported format.`);
					return localize;
				}
			}
		} catch (e) {
			console.error(`Can't load string bundle for ${file}`);
			return localize;
		}
	}
}

export function config(options: Options): LoadFunc {
	if (isString(options.locale)) {
		_options.locale = options.locale;
		_resolvedLanguage = null;
	}
	if (isBoolean(options.cacheLanguageResolution)) {
		_options.cacheLanguageResolution = options.cacheLanguageResolution;
	}
	_isPseudo = _options.locale === 'pseudo';
	return loadMessageBundle;
}