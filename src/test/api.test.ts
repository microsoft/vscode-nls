/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert';

import * as nls from '../../node';
import * as nlsBrowser from '../../browser';

describe('API', () => {
	it('Exports same symbol names in both browser and node entry points', () => {
		assert.deepEqual(Object.keys(nls), Object.keys(nlsBrowser));
	});
});
