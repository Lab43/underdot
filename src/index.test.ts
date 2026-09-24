import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as index from './index.ts';

test('the module has no exports yet', () => {
  assert.deepEqual(Object.keys(index), []);
});
