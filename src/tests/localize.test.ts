/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as assert from 'assert';
import * as path from 'path';

import * as nls from '../main';

describe('Localize', () => {
	it('Simple call', () => {
		let localize = nls.config({ locale: 'de-DE', cache: true })();
		let message = 'Hello World';
		assert.strictEqual(localize('key', message), message);
	});
	
	it('With args', () => {
		let localize = nls.config({ locale: 'de-DE', cache: true })();
		let message = '{0} {1}';
		assert.strictEqual(localize('key', message, 'Hello', 'World'), 'Hello World');
	});
	
	it('External Data German flat', () => {
		let localize:any = nls.config({ locale: 'de-DE', cache: true })(path.join(__dirname, '..', '..' , 'src', 'tests', 'data'));
		assert.strictEqual(localize(0, null), 'Guten Tag Welt');
	});
	
	it('External Data German structured', () => {
		let localize:any = nls.config({ locale: 'de-DE', cache: true })(path.join(__dirname, '..', '..' , 'src', 'tests', 'dataStructured'));
		assert.strictEqual(localize(0, null), 'Guten Tag Welt');
		assert.strictEqual(localize(1, null), 'Auf Wiedersehen Welt');
	});
	
	it('Default data file', () => {
		let localize:any = nls.config({ locale: 'zh-tw', cache: true })(path.join(__dirname, '..', '..' , 'src', 'tests', 'data'));
		assert.strictEqual(localize(0, null), 'Hello World');
	});
});