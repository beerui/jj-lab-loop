import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyNotesLabel } from '../src/format.mjs';

test('REQ-L1-003 empty label is No notes yet', () => {
  assert.equal(emptyNotesLabel(), 'No notes yet');
});
