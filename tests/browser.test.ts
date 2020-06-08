/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert';

import * as nls from '../node/main-node';
import * as nlsBrowser from '../browser/main-browser';

describe('library', () => {
	it('exports same symbol names in both entry points', () => {
		assert.deepEqual(Object.keys(nls), Object.keys(nlsBrowser));
	});
});
