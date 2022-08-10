/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as fs from 'fs';

import RAL from '../common/ral';

import {
	format, localize, setPseudo, BundleFormat, Options, TranslationConfig, LocalizeFunc,
	NlsBundle, MetaDataFile, I18nBundle, LoadFunc, InjectedContext,
} from '../common/common';

export { BundleFormat, Options, LocalizeInfo, LocalizeFunc, LoadFunc, KeyInfo } from '../common/common';

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
	dirNameHint: string;
	languagePackId?: string;
	translationsConfigFile?: string;
	translationsConfig?: TranslationConfig
	cacheRoot?: string;
}

const resolvedBundleMap = new Map<InjectedContext, NlsBundle | null>();

let options: InternalOptions;

function initializeSettings() {
	options = {
		locale: undefined,
		language: undefined,
		languagePackSupport: false,
		cacheLanguageResolution: true,
		// TODO: Should this be something else?
		dirNameHint: __dirname
	};
	if (typeof process.env.VSCODE_NLS_CONFIG === 'string') {
		try {
			let vscodeOptions = JSON.parse(process.env.VSCODE_NLS_CONFIG) as VSCodeNlsConfig;
			let language: string | undefined;
			if (vscodeOptions.availableLanguages) {
				let value = vscodeOptions.availableLanguages['*'];
				if (typeof value === 'string') {
					language = value;
				}
			}
			if (typeof vscodeOptions.locale === 'string') {
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
			if (typeof vscodeOptions._cacheRoot === 'string') {
				options.cacheRoot = vscodeOptions._cacheRoot;
			}
			if (typeof vscodeOptions._languagePackId === 'string') {
				options.languagePackId = vscodeOptions._languagePackId;
			}
			if (typeof vscodeOptions._translationsConfigFile === 'string') {
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
}
initializeSettings();

function supportsLanguagePack(): boolean {
	return options.languagePackSupport === true
		&& options.cacheRoot !== undefined
		&& options.languagePackId !== undefined
		&& options.translationsConfigFile !== undefined
		&& options.translationsConfig !== undefined;
}

function createScopedLocalizeFunction(messages: string[]): LocalizeFunc {
	return function (key: any, message: string, ...args: any[]): string {
		if (typeof key === 'number') {
			if (key >= messages.length) {
				console.error(`Broken localize call found. Index out of bounds. Stacktrace is\n: ${(<any>new Error('')).stack}`);
				return 'Failed to find string';
			}
			return format(messages[key], args);
		} else {
			if (typeof message === 'string') {
				console.warn(`Message ${message} didn't get externalized correctly.`);
				return format(message, args);
			} else {
				console.error(`Broken localize call found. Stacktrace is\n: ${(<any>new Error('')).stack}`);
			}
		}
		return 'Failed to find string';
	};
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

function createDefaultNlsBundle(folder: string): NlsBundle {
	let metaData: MetaDataFile = readJsonFileSync(path.join(folder, 'nls.metadata.json'));
	let result: NlsBundle = Object.create(null);
	for (let module in metaData) {
		let entry = metaData[module];
		result[module] = entry.messages;
	}
	return result;
}

function createNLSBundle(context: InjectedContext, bundleDir: string): NlsBundle | undefined {
	let languagePackLocation = options.translationsConfig![context.id!];
	if (!languagePackLocation) {
		return undefined;
	}
	let languagePack: I18nBundle = readJsonFileSync(languagePackLocation).contents;
	let metaData: MetaDataFile = readJsonFileSync(path.join(bundleDir, 'nls.metadata.json'));
	let result: NlsBundle = Object.create(null);
	for (let module in metaData) {
		let entry = metaData[module];
		let translations = languagePack[module];
		if (translations) {
			let resultMessages: string[] = [];
			for (let i = 0; i < entry.keys.length; i++) {
				let messageKey = entry.keys[i];
				let key = typeof messageKey  === 'string' ? messageKey : messageKey.key;
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

function loadNlsBundleOrCreateFromI18n(context: InjectedContext, bundleDir: string): NlsBundle | undefined {
	let result: NlsBundle | undefined;

	let bundle = path.join(options.cacheRoot!, `${context.id}-${context.metadataHash}.json`);
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

	result = createNLSBundle(context, bundleDir);
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

function loadNlsBundle(context: InjectedContext, bundleDir: string): NlsBundle | undefined {
	let result: NlsBundle | undefined;

	// Core decided to use a language pack. Do the same in the extension
	if (supportsLanguagePack() && context.id && context.metadataHash) {
		try {
			result = loadNlsBundleOrCreateFromI18n(context, bundleDir);
		} catch (err) {
			console.log(`Load or create bundle failed `, err);
		}
	}
	if (!result) {
		// No language pack found, but core is running in language pack mode
		// Don't try to use old in the box bundles since the might be stale
		// Fall right back to the default bundle.
		if (options.languagePackSupport) {
			return loadDefaultNlsBundle(bundleDir);
		}
		let candidate = findInTheBoxBundle(bundleDir);
		if (candidate) {
			try {
				return readJsonFileSync(candidate);
			} catch (err) {
				console.log(`Loading in the box message bundle failed.`, err);
			}
		}
		result = loadDefaultNlsBundle(bundleDir);
	}
	return result;
}

function tryFindBundleDir(): string | undefined {
	let dirname = options.dirNameHint;
	while (true) {
		const result = path.join(dirname, 'nls.metadata.json');
		if (fs.existsSync(result)) {
			return dirname;
		}
		let parent = path.dirname(dirname);
		if (parent === dirname) {
			return undefined;
		} else {
			dirname = parent;
		}
	}
}

export function loadMessageBundle(context?: InjectedContext): LocalizeFunc {
	if (!context || !context.bundleKey) {
		// No file. We are in dev mode. Return the default
		// localize function.
		return localize;
	}
	const module = context.bundleKey;

	let bundle: NlsBundle | null | undefined = resolvedBundleMap.get(context);
	const bundleDir = tryFindBundleDir();
	if (bundleDir && bundle === undefined) {
		try {
			bundle = loadNlsBundle(context, bundleDir);
			resolvedBundleMap.set(context, bundle ?? null);
		} catch (err) {
			console.error('Failed to load nls bundle', err);
			resolvedBundleMap.set(context, null);
			bundle = null;
		}
	}
	if (bundle) {
		let messages = bundle[module];
		if (messages === undefined) {
			console.error(`Messages for file ${module} not found. See console for details.`);
			return function (): string {
				return 'Messages not found.';
			};
		}
		return createScopedLocalizeFunction(messages);
	}

	console.error(`Failed to load message bundle for file ${module}`);
	return function (): string {
		return 'Failed to load message bundle. See console for details.';
	};
}

export function config(opts?: Options): LoadFunc {
	if (opts) {
		if (typeof opts.locale === 'string') {
			options.locale = opts.locale.toLowerCase();
			options.language = options.locale;
		}
		if (opts.bundleFormat === BundleFormat.standalone && options.languagePackSupport === true) {
			options.languagePackSupport = false;
		}
		if (opts.dirNameHint) {
			options.dirNameHint = opts.dirNameHint;
		}
	}
	setPseudo(options.locale === 'pseudo');
	return loadMessageBundle;
}

RAL.install(Object.freeze<RAL>({
	loadMessageBundle: loadMessageBundle,
	config: config
}));
