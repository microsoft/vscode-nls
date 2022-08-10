/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as assert from 'assert';
import * as path from 'path';

import * as nls from '../main';

let root = path.join(__dirname, '..', '..' , '..', 'src', 'node', 'test');

describe('Localize', () => {
	it('Simple call', () => {
		let localize = nls.config({ locale: 'de-DE' })();
		let message = 'Hello World';
		assert.strictEqual(localize('key', message), message);
	});

	it('Simple call with separate load', () => {
		nls.config({ locale: 'de-DE' });
		let localize = nls.loadMessageBundle();
		let message = 'Hello World';
		assert.strictEqual(localize('key', message), message);
	});

	it('With args', () => {
		let localize = nls.config({ locale: 'de-DE' })();
		let message = '{0} {1}';
		assert.strictEqual(localize('key', message, 'Hello', 'World'), 'Hello World');
	});

	it('Pseudo', () => {
		let localize = nls.config({ locale: 'pseudo' })();
		let message = 'Hello World';
		assert.strictEqual(localize('key', message), '\uFF3BHeelloo Woorld\uFF3D');
	});

	it('Pseudo with args', () => {
		let localize = nls.config({ locale: 'pseudo' })();
		let message = 'Hello {0} World';
		assert.strictEqual(localize('key', message, 'bright'), '\uFF3BHeelloo bright Woorld\uFF3D');
	});

	it ('Resolves exact language', () => {
		let localize:any = nls.config({
			locale: 'de-CH',
			bundleFormat: nls.BundleFormat.standalone,
			dirNameHint: root
		})({
			relativeFilePath: 'localize.test'
		});
		assert.strictEqual(localize(0, null), 'Guten Tag Welt');
	});

	it ('Resolves root language', () => {
		let localize:any = nls.config({
			locale: 'de-DE',
			bundleFormat: nls.BundleFormat.standalone,
			dirNameHint: root
		})({
			relativeFilePath: 'localize.test'
		});
		assert.strictEqual(localize(0, null), 'Guten Tag Welt');
	});

	it ('Falls back to English', () => {
		let localize:any = nls.config({
			locale: 'zh-CN',
			bundleFormat: nls.BundleFormat.standalone,
			dirNameHint: root
		})({
			relativeFilePath: 'localize.test'
		});
		assert.strictEqual(localize(0, null), 'good day world');
	});

	it ('language pack fallback', () => {
		let localize:any = nls.config({
			locale: 'pt-BR',
			bundleFormat: nls.BundleFormat.languagePack,
			dirNameHint: root,
		})({
			relativeFilePath: 'localize.test'
		});
		assert.strictEqual(localize(0, null), 'good day world');
	});
});
