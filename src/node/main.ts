/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as fs from 'fs';

import RAL from '../common/ral';

import {
	format, localize, isDefined, setPseudo, isPseudo, MessageFormat, BundleFormat, Options, TranslationConfig, LanguageBundle, LocalizeFunc,
	NlsBundle, MetaDataFile, MetadataHeader, I18nBundle, SingleFileJsonFormat, LoadFunc
} from '../common/common';

export { MessageFormat, BundleFormat, Options, LocalizeInfo, LocalizeFunc, LoadFunc, KeyInfo } from '../common/common';

const toString = Object.prototype.toString;

function isNumber(value: any): value is number {
	return toString.call(value) === '[object Number]';
}

function isString(value: any): value is string {
	return toString.call(value) === '[object String]';
}

function isBoolean(value: any): value is boolean {
	return value === true || value === false;
}

function readJsonFileSync<T = any>(filename: string): T {
	return JSON.parse(fs.readFileSync(filename, 'utf8')) as T;
}

interface VSCodeNlsConfig {
	locale: string;
	availableLanguages: {
		[pack: string]: string;
	};
	_languagePackSupport?: boolean;
	_languagePackId?: string;
	_translationsConfigFile?: string;
	_cacheRoot?: string;
	_corruptedFile: string;
}

interface InternalOptions {
	locale: string | undefined;
	language: string | undefined;
	languagePackSupport: boolean;
	cacheLanguageResolution: boolean;
	messageFormat: MessageFormat;
	languagePackId?: string;
	translationsConfigFile?: string;
	translationsConfig?: TranslationConfig
	cacheRoot?: string;
}

let resolvedBundles: {
	[Key: string]: LanguageBundle | null;
};

let options: InternalOptions;

function initializeSettings() {
	options = { locale: undefined, language: undefined, languagePackSupport: false, cacheLanguageResolution: true, messageFormat: MessageFormat.bundle };
	if (isString(process.env.VSCODE_NLS_CONFIG)) {
		try {
			let vscodeOptions = JSON.parse(process.env.VSCODE_NLS_CONFIG) as VSCodeNlsConfig;
			let language: string | undefined;
			if (vscodeOptions.availableLanguages) {
				let value = vscodeOptions.availableLanguages['*'];
				if (isString(value)) {
					language = value;
				}
			}
			if (isString(vscodeOptions.locale)) {
				options.locale = vscodeOptions.locale.toLowerCase();
			}
			if (language === undefined) {
				options.language = options.locale;
			} else if (language !== 'en') {
				options.language = language;
			}

			if (isBoolean(vscodeOptions._languagePackSupport)) {
				options.languagePackSupport = vscodeOptions._languagePackSupport;
			}
			if (isString(vscodeOptions._cacheRoot)) {
				options.cacheRoot = vscodeOptions._cacheRoot;
			}
			if (isString(vscodeOptions._languagePackId)) {
				options.languagePackId = vscodeOptions._languagePackId;
			}
			if (isString(vscodeOptions._translationsConfigFile)) {
				options.translationsConfigFile = vscodeOptions._translationsConfigFile;
				try {
					options.translationsConfig = readJsonFileSync(options.translationsConfigFile);
				} catch (error) {
					// We can't read the translation config file. Mark the cache as corrupted.
					if (vscodeOptions._corruptedFile) {
						const dirname = path.dirname(vscodeOptions._corruptedFile);
						fs.exists(dirname, (exists) => {
							if (exists) {
								fs.writeFile(vscodeOptions._corruptedFile, 'corrupted', 'utf8', (err) => {
									console.error(err);
								});
							}
						});
					}
				}
			}
		} catch {
			// Do nothing.
		}
	}
	setPseudo(options.locale === 'pseudo');
	resolvedBundles = Object.create(null);
}
initializeSettings();

function supportsLanguagePack(): boolean {
	return options.languagePackSupport === true && options.cacheRoot !== undefined && options.languagePackId !== undefined && options.translationsConfigFile !== undefined
		&& options.translationsConfig !== undefined;
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


function resolveLanguage(file: string): string {
	let resolvedLanguage: string;
	if (options.cacheLanguageResolution && resolvedLanguage) {
		resolvedLanguage = resolvedLanguage;
	} else {
		if (isPseudo || !options.language) {
			resolvedLanguage = '.nls.json';
		} else {
			let locale = options.language;
			while (locale) {
				var candidate = '.nls.' + locale + '.json';
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
		if (options.cacheLanguageResolution) {
			resolvedLanguage = resolvedLanguage;
		}
	}
	return file + resolvedLanguage;
}

function findInTheBoxBundle(root: string): string | undefined {
	let language = options.language;
	while (language) {
		let candidate = path.join(root, `nls.bundle.${language}.json`);
		if (fs.existsSync(candidate)) {
			return candidate;
		} else {
			let index = language.lastIndexOf('-');
			if (index > 0) {
				language = language.substring(0, index);
			} else {
				language = undefined;
			}
		}
	}
	// Test if we can reslove the default bundle.
	if (language === undefined) {
		let candidate = path.join(root, 'nls.bundle.json');
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}
	return undefined;
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
				fs.mkdirSync(directory);
			}
		} else {
			throw err;
		}
	}
}

function createDefaultNlsBundle(folder: string): NlsBundle {
	let metaData: MetaDataFile = readJsonFileSync(path.join(folder, 'nls.metadata.json'));
	let result: NlsBundle = Object.create(null);
	for (let module in metaData) {
		let entry = metaData[module];
		result[module] = entry.messages;
	}
	return result;
}

function createNLSBundle(header: MetadataHeader, metaDataPath: string): NlsBundle | undefined {
	let languagePackLocation = options.translationsConfig[header.id];
	if (!languagePackLocation) {
		return undefined;
	}
	let languagePack: I18nBundle = readJsonFileSync(languagePackLocation).contents;
	let metaData: MetaDataFile = readJsonFileSync(path.join(metaDataPath, 'nls.metadata.json'));
	let result: NlsBundle = Object.create(null);
	for (let module in metaData) {
		let entry = metaData[module];
		let translations = languagePack[`${header.outDir}/${module}`];
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

function touch(file: string) {
	let d = new Date();
	fs.utimes(file, d, d, () => {
		// Do nothing. Ignore
	});
}

function cacheBundle(key: string, bundle: LanguageBundle | null): LanguageBundle | null {
	resolvedBundles[key] = bundle;
	return bundle;
}

function loadNlsBundleOrCreateFromI18n(header: MetadataHeader, bundlePath: string): NlsBundle | undefined {
	let result: NlsBundle;

	let bundle = path.join(options.cacheRoot, `${header.id}-${header.hash}.json`);
	let useMemoryOnly: boolean = false;
	let writeBundle: boolean = false;
	try {
		result = JSON.parse(fs.readFileSync(bundle, { encoding: 'utf8', flag: 'r' }));
		touch(bundle);
		return result;
	} catch (err) {
		if (err.code === 'ENOENT') {
			writeBundle = true;
		} else if (err instanceof SyntaxError) {
			// We have a syntax error. So no valid JSON. Use
			console.log(`Syntax error parsing message bundle: ${err.message}.`);
			fs.unlink(bundle, (err) => {
				if (err) {
					console.error(`Deleting corrupted bundle ${bundle} failed.`);
				}
			});
			useMemoryOnly = true;
		} else {
			throw err;
		}
	}

	result = createNLSBundle(header, bundlePath);
	if (!result || useMemoryOnly) {
		return result;
	}

	if (writeBundle) {
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

function loadDefaultNlsBundle(bundlePath: string): NlsBundle | undefined {
	try {
		return createDefaultNlsBundle(bundlePath);
	} catch (err) {
		console.log(`Generating default bundle from meta data failed.`, err);
		return undefined;
	}
}

function loadNlsBundle(header: MetadataHeader, bundlePath: string): NlsBundle | undefined {
	let result: NlsBundle;

	// Core decided to use a language pack. Do the same in the extension
	if (supportsLanguagePack()) {
		try {
			result = loadNlsBundleOrCreateFromI18n(header, bundlePath);
		} catch (err) {
			console.log(`Load or create bundle failed `, err);
		}
	}
	if (!result) {
		// No language pack found, but core is running in language pack mode
		// Don't try to use old in the box bundles since the might be stale
		// Fall right back to the default bundle.
		if (options.languagePackSupport) {
			return loadDefaultNlsBundle(bundlePath);
		}
		let candidate = findInTheBoxBundle(bundlePath);
		if (candidate) {
			try {
				return readJsonFileSync(candidate);
			} catch (err) {
				console.log(`Loading in the box message bundle failed.`, err);
			}
		}
		result = loadDefaultNlsBundle(bundlePath);
	}
	return result;
}

function tryFindMetaDataHeaderFile(file: string): string {
	let result: string;
	let dirname = path.dirname(file);
	while (true) {
		result = path.join(dirname, 'nls.metadata.header.json');
		if (fs.existsSync(result)) {
			break;
		}
		let parent = path.dirname(dirname);
		if (parent === dirname) {
			result = undefined;
			break;
		} else {
			dirname = parent;
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

	if (options.messageFormat === MessageFormat.both || options.messageFormat === MessageFormat.bundle) {
		let headerFile = tryFindMetaDataHeaderFile(file);
		if (headerFile) {
			let bundlePath = path.dirname(headerFile);
			let bundle: LanguageBundle = resolvedBundles[bundlePath];
			if (bundle === undefined) {
				try {
					let header: MetadataHeader = JSON.parse(fs.readFileSync(headerFile, 'utf8'));
					try {
						let nlsBundle = loadNlsBundle(header, bundlePath);
						bundle = cacheBundle(bundlePath, nlsBundle ? { header, nlsBundle } : null);
					} catch (err) {
						console.error('Failed to load nls bundle', err);
						bundle = cacheBundle(bundlePath, null);
					}
				} catch (err) {
					console.error('Failed to read header file', err);
					bundle = cacheBundle(bundlePath, null);
				}
			}
			if (bundle) {
				let module = file.substr(bundlePath.length + 1).replace(/\\/g, '/');
				let messages = bundle.nlsBundle[module];
				if (messages === undefined) {
					console.error(`Messages for file ${file} not found. See console for details.`);
					return function (): string {
						return 'Messages not found.';
					};
				}
				return createScopedLocalizeFunction(messages);
			}
		}
	}
	if (options.messageFormat === MessageFormat.both || options.messageFormat === MessageFormat.file) {
		// Try to load a single file bundle
		try {
			let json: SingleFileJsonFormat = readJsonFileSync(resolveLanguage(file));
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
			if (err.code !== 'ENOENT') {
				console.error('Failed to load single file bundle', err);
			}
		}
	}
	console.error(`Failed to load message bundle for file ${file}`);
	return function (): string {
		return 'Failed to load message bundle. See console for details.';
	};
}

export function config(opts?: Options): LoadFunc {
	if (opts) {
		if (isString(opts.locale)) {
			options.locale = opts.locale.toLowerCase();
			options.language = options.locale;
			resolvedBundles = Object.create(null);
		}
		if (opts.messageFormat !== undefined) {
			options.messageFormat = opts.messageFormat;
		}
		if (opts.bundleFormat === BundleFormat.standalone && options.languagePackSupport === true) {
			options.languagePackSupport = false;
		}
	}
	setPseudo(options.locale === 'pseudo');
	return loadMessageBundle;
}

RAL.install(Object.freeze<RAL>({
	loadMessageBundle: loadMessageBundle,
	config: config
}));