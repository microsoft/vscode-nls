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

	it('External Data German flat', () => {
		let localize:any = nls.config({ locale: 'de-DE', messageFormat: nls.MessageFormat.file })(path.join(root, 'data'));
		assert.strictEqual(localize(0, null), 'Guten Tag Welt');
	});

	it('External Data German flat with extension', () => {
		let localize:any = nls.config({ locale: 'de-DE', messageFormat: nls.MessageFormat.file })(path.join(root, 'data.js'));
		assert.strictEqual(localize(0, null), 'Guten Tag Welt');
	});

	it('External Data German flat with extension separate load', () => {
		nls.config({ locale: 'de-DE', messageFormat: nls.MessageFormat.file });
		let localize:any = nls.loadMessageBundle(path.join(root, 'data.js'));
		assert.strictEqual(localize(0, null), 'Guten Tag Welt');
	});

	it('External Data German structured', () => {
		let localize:any = nls.config({ locale: 'de-DE', messageFormat: nls.MessageFormat.file })(path.join(root, 'dataStructured'));
		assert.strictEqual(localize(0, null), 'Guten Tag Welt');
		assert.strictEqual(localize(1, null), 'Auf Wiedersehen Welt');
	});

	it ('External Bundle', () => {
		let localize:any = nls.config({ locale: 'de-DE', messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })(path.join(root, 'localize.test.js'));
		assert.strictEqual(localize(0, null), 'Guten Tag Welt');
	});

	it('Default data file', () => {
		let localize:any = nls.config({ locale: 'zh-tw', messageFormat: nls.MessageFormat.file })(path.join(root, 'data'));
		assert.strictEqual(localize(0, null), 'Hello World');
	});
});