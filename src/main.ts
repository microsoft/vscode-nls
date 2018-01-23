/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import * as fs from 'fs';
import { createSocket } from 'dgram';

export interface Options {
	locale?: string;
	cacheLanguageResolution?: boolean;
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
	(info: LocalizeInfo, message: string, ...args: any[]): string;
	(key: string, message: string, ...args: any[]): string;
}

export interface LoadFunc {
	(file?: string): LocalizeFunc;
}

export enum ExtensionKind {
	prePackaged = 1,
	marketPlace = 2
}

interface LanguageBundle {
	[key: string]: string[];
}

type SingleFileJsonFormat = string[] | { messages: string[]; keys: string[]; };

export type KeyInfo = string | LocalizeInfo;

interface MetaDataEntry {
	messages: string[];
	keys: KeyInfo[];
}

interface MetaDataFile {
	type: string;
	name: string;
	rootPath: string;
	content: {
		[key: string]: MetaDataEntry;
	}
}

interface LanguagePack {
	[module: string]: {
		[key: string]: string;
	};
}

interface InternalOptions {
	locale?: string;
	cacheLanguageResolution?: boolean;
	_languagePackLocation?: string;
	_cacheRoot?: string;
	_resolvedLanguagePackCoreLocation?: string;
	_resolvedLanguagePackExtensionLocation?: string;
}

let _options: InternalOptions;
let _isPseudo: boolean;
let _extensionKind: ExtensionKind;
let _root: string;
let _outDir: string;
let _outPath: string;

let _resolvedLanguage: string;


// If undefined we never tried to load. If null we tried to load (the bundle exists on disk)
// but the actual load failed.
let _resolvedBundle: LanguageBundle | undefined | null;

let _resolvedCacheLocation: string;

function initializeSettings() {
	_options = { locale: undefined, cacheLanguageResolution: true };
	_isPseudo = false;
	_extensionKind = undefined;
	_root = undefined;
	_outDir = undefined;
	_outPath = undefined;
	_resolvedLanguage = undefined;
	_resolvedBundle = undefined;
	_resolvedCacheLocation = undefined;
}
initializeSettings();

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
	}
}

function localize(key: string | LocalizeInfo, message: string, ...args: any[]): string {
	return format(message, args);
}

function tryResolveBundle(root: string): string | undefined {
	let locale = _options.locale;
	while (locale) {
		let candidate = path.join(root, `nls.bundle.${locale}.json`);
		if (fs.existsSync(candidate)) {
			return candidate;
		} else {
			let index = locale.lastIndexOf('-');
			if (index > 0) {
				locale = locale.substring(0, index);
			} else {
				locale = undefined;
			}
		}
	}
	// Test if we can reslove the default bundle.
	if (locale === undefined) {
		let candidate = path.join(root, 'nls.bundle.json');
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

function resolveLanguage(file: string): string {
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

function mkdir(directory: string) {
	try {
		fs.mkdirSync(directory);
	} catch (err) {
		if (err.code === 'EEXIST') {
			return;
		} else if (err.code === 'ENOENT') {
			let parent = path.dirname(directory);
			if (parent !== directory) {
				mkdir(parent);
				fs.mkdir(directory);
			}
		} else {
			throw err;
		}
	}
}

function supportsLanguagePack(): boolean {
	if (!_root || !_outDir || !_options._languagePackLocation
		|| (_extensionKind === ExtensionKind.prePackaged && !_options._resolvedLanguagePackExtensionLocation)
		|| (_extensionKind === ExtensionKind.marketPlace && !_options._cacheRoot))
	{
		return false;
	}

	return fs.existsSync(path.join(_outPath, 'nls.metadata.json'));
}

function loadDefaultBundle(): LanguageBundle {
	let metaData: MetaDataFile = require(path.join(_outPath, 'nls.metadata.json'));
	let result: LanguageBundle = Object.create(null);
	for (let module in metaData.content) {
		let entry = metaData.content[module];
		result[module] = entry.messages;
	}
	return result;
}

function createLanguageBundle(extensionName: string): LanguageBundle {
	let languagePack: LanguagePack = require(path.join(_options._languagePackLocation, 'extensions', `${extensionName}.i18n.json`)).contents;
	let metaData: MetaDataFile = require(path.join(_outPath, 'nls.metadata.json'));
	let result: LanguageBundle = Object.create(null);
	for (let module in metaData.content) {
		let entry = metaData.content[module];
		let translations = languagePack[`${_outDir}/${module}`];
		if (translations) {
			let resultMessages: string[] = [];
			for (let i = 0; i < entry.keys.length; i++) {
				let messageKey = entry.keys[i];
				let key = isString(messageKey) ? messageKey : messageKey.key;
				let translatedMessage = translations[key];
				if (translatedMessage === undefined) {
					translatedMessage = entry.messages[i];
				}
				resultMessages.push(translatedMessage);
			}
			result[module] = resultMessages;
		} else {
			result[module] = entry.messages;
		}
	}
	return result;
}

function loadPrepackagedLanguagePackBundle(): LanguageBundle {
	let extensionName = require(path.join(_root, 'package.json')).name;
	let root = path.join(_options._resolvedLanguagePackExtensionLocation);
	let bundle = path.join(root, `${extensionName}.nls.json`);
	let useMemoryOnly: boolean = false;
	let noEntry: boolean = false;
	try {
		return JSON.parse(fs.readFileSync(bundle, { encoding: 'utf8', flag: 'r' }));
	} catch (err) {
		if (err.code === 'ENOENT') {
			noEntry = true;
		} else if (err instanceof SyntaxError) {
			// We have a syntax error. So no valid JSON. Use
			console.error(`Syntax error parsing message bundle: ${err.message}`);
			useMemoryOnly = true;
		} else {
			throw err;
		}
	}
	let result: LanguageBundle = createLanguageBundle(extensionName);
	if (useMemoryOnly) {
		return result;
	}

	if (noEntry) {
		mkdir(root);
		try {
			fs.writeFileSync(bundle, JSON.stringify(result), { encoding: 'utf8', flag: 'wx' });
		} catch (err) {
			if (err.code === 'EEXIST') {
				return result;
			}
			throw err;
		}
	}

	return result;
}

function loadMarketPlaceLanguagePackBundle(): LanguageBundle {
	let packageJson = require(path.join(_root, 'package.json'))
	let extensionName = packageJson.name;
	let extensionVersion = packageJson.version;
	let extensionPublisher = packageJson.publisher;
	if (!extensionName || !extensionVersion || !extensionPublisher) {
		return undefined;
	}

	let root = path.join(_options._cacheRoot, `${extensionName}.${extensionPublisher}-${extensionVersion}`);
	let useMemoryOnly: boolean = false;
	let noEntry: boolean = false;
	// We already have a cached bundle. Use it.
	let bundle = tryResolveBundle(root);
	let result: LanguageBundle;
	if (bundle) {
		try {
			result = JSON.parse(fs.readFileSync(bundle, { encoding: 'utf8', flag: 'r' }));
			try {
				// Touch last used.
				fs.writeFileSync(path.join(root, 'lastUsed.touch'), '', { encoding: 'utf8', flag: 'w' });
			} catch (err) {
				// Ignore error.
			}
			return result;
		} catch (err) {
			if (err.code === 'ENOENT') {
				noEntry = true;
			} else if (err instanceof SyntaxError) {
				// We have a syntax error. So no valid JSON. Use
				console.error(`Syntax error parsing message bundle.`, err);
				useMemoryOnly = true;
			} else {
				throw err;
			}
		}
	}
	result = createLanguageBundle(extensionName);
	if (useMemoryOnly) {
		return result;
	}

	if (noEntry) {
		mkdir(root);
		try {
			fs.writeFileSync(bundle, JSON.stringify(result), { encoding: 'utf8', flag: 'wx' });
		} catch (err) {
			if (err.code === 'EEXIST') {
				return result;
			}
			throw err;
		}
	}

	return result;
}

export function loadMessageBundle(file?: string): LocalizeFunc {
	if (!file) {
		// No file. We are in dev mode. Return the default
		// localize function.
		return localize;
	} 
	// Remove extension since we load json files.
	let ext = path.extname(file);
	if (ext) {
		file = file.substr(0, file.length - ext.length);
	}

	// We have a single resolved bundle.
	if (_resolvedBundle !== undefined) {
		// We failed resolve the bundle including generating one from meta data.
		// We return a special localize function that always errors
		if (_resolvedBundle === null) {
			return function(): string {
				return 'Failed to load message bundle. See console for details.';
			};
		}
		if (!file.startsWith(_outPath)) {
			console.error(`Mismatch between out path(${_outPath}) and file location(${file})`);
			return function(): string {
				return 'Location mismatch. See console for details.';
			}
		}
		let module = file.substr(_outPath.length + 1).replace(/\\/g, '/');
		let messages = _resolvedBundle[module];
		if (messages === undefined) {
			console.error(`Messages for file ${file} not found. See console for details.`);
			return function(): string {
				return 'Messages not found';
			}
		}
		return createScopedLocalizeFunction(messages);
	}

	// Try to load a single file bundle
	try {
		let json: SingleFileJsonFormat = require(resolveLanguage(file));
		if (Array.isArray(json)) {
			return createScopedLocalizeFunction(json);
		} else {
			if (isDefined(json.messages) && isDefined(json.keys)) {
				return createScopedLocalizeFunction(json.messages);
			} else {
				console.error(`String bundle '${file}' uses an unsupported format.`);
				return function () {
					return 'File bundle has unsupported format. See console for details';
				};
			}
		}
	} catch (err) {
		console.error(`Can't load string bundle for ${file}`, err);
		return function(): string {
			return 'Failed to load file bundle. See console for details.';
		};
	}
}

export function config(): LoadFunc;
export function config(opt: Options): LoadFunc;
export function config(opt: string): LoadFunc;
export function config(opt: Options, root: string, outDir: string): LoadFunc;
export function config(opt: string, root: string, outDir: string): LoadFunc;
export function config(opt: string, kind: ExtensionKind.prePackaged, root: string, outDir?: string): LoadFunc;
export function config(opt: string, kind: ExtensionKind.marketPlace, root: string, outDir: string): LoadFunc;
export function config(opt?: Options | string, rootOrKind?: ExtensionKind | string, outDirOrRoot?: string, outDir?: string): LoadFunc {
	initializeSettings();
	let options: Options;
	if (isString(opt)) {
		try {
			options = JSON.parse(opt);
		} catch (e) {
			console.error(`Error parsing nls options: ${opt}`);
		}
	} else {
		options = opt;
	}

	let kind: ExtensionKind;
	let root: string;
	if (isString(rootOrKind)) {
		kind = undefined;
		root = rootOrKind;
		outDir = outDirOrRoot;
	} else {
		kind = rootOrKind;
		root = outDirOrRoot;
	}

	if (options) {
		if (isString(options.locale)) {
			_options.locale = options.locale.toLowerCase();
			_resolvedLanguage = undefined;
			_resolvedCacheLocation = undefined;
		}
		let asInternal = options as InternalOptions;
		if (isString(asInternal._cacheRoot)) {
			_options._cacheRoot = asInternal._cacheRoot;
		}
		if (isString(asInternal._languagePackLocation)) {
			_options._languagePackLocation = asInternal._languagePackLocation;
		}
		if (isString(asInternal._resolvedLanguagePackCoreLocation)) {
			_options._resolvedLanguagePackCoreLocation = asInternal._resolvedLanguagePackCoreLocation;
		}
		if (isString(asInternal._resolvedLanguagePackExtensionLocation)) {
			_options._resolvedLanguagePackExtensionLocation = asInternal._resolvedLanguagePackExtensionLocation;
		}
		if (isBoolean(options.cacheLanguageResolution)) {
			_options.cacheLanguageResolution = options.cacheLanguageResolution;
		}
	}

	let packageJsonExists = false;
	if (kind === ExtensionKind.prePackaged && isString(root) && root.length > 0 && !outDir) {
		let parent = path.dirname(root);
		let basename = path.basename(root);
		if (fs.existsSync(path.join(parent, 'package.json'))) {
			packageJsonExists = true;
			root = parent;
			outDir = basename;
		}
	}

	if (root && path.isAbsolute(root)) {
		_root = root;
		_outDir = outDir;
		if (_outDir) {
			_outPath = path.join(_root, _outDir);		
		}
	}

	if (kind && _root && _outDir && (packageJsonExists || fs.existsSync(path.join(root, 'package.json')))) {
		_extensionKind = kind;
	}
	_isPseudo = _options.locale === 'pseudo';

	// We have a root and a outDir. So we can try to load a bundle if it exists.
	if (_root && _outDir) {
		// We are using a language pack.
		if (supportsLanguagePack()) {
			try {
				if (kind === ExtensionKind.prePackaged) {
					_resolvedBundle = loadPrepackagedLanguagePackBundle();
				} else {
					_resolvedBundle = loadMarketPlaceLanguagePackBundle();
				}
				return loadMessageBundle;
			} catch (err) {
				console.error(`Loading the message bundle from language pack failed with exception`, err);
			}
		}
		let candidate = tryResolveBundle(path.join(_root, _outDir));
		if (candidate) {
			try {
				_resolvedBundle = require(candidate);
				return loadMessageBundle;
			} catch (err) {
				console.error(`Loading in the box message bundle failed.`, err);
			}
		}
		try {
			_resolvedBundle = loadDefaultBundle();
			return loadMessageBundle;
		} catch (err) {
			console.error(`Generating default bundle from meta data failed.`, err);
			_resolvedBundle = null;
		}
	}
	return loadMessageBundle;
}