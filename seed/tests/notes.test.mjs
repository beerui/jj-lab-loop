import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createNotesStore } from '../src/notes.mjs';

function withTempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-gym-notes-'));
  const dataPath = path.join(dir, 'notes.json');
  fs.writeFileSync(dataPath, `${JSON.stringify([{ id: 'n1', title: 'First note' }], null, 2)}\n`);
  const files = new Map([[dataPath, fs.readFileSync(dataPath, 'utf8')]]);
  const store = createNotesStore({
    dataPath,
    readFile: (file) => files.get(file),
    writeFile: (file, body) => { files.set(file, body); }
  });
  return { store, files, dataPath };
}

test('REQ-L1-001 get(id) returns the title written by updateTitle', () => {
  const { store } = withTempStore();
  store.updateTitle('n1', 'Saved title');
  assert.equal(store.get('n1').title, 'Saved title');
});

test('REQ-L1-002 list() title matches get(id)', () => {
  const { store } = withTempStore();
  store.updateTitle('n1', 'Listed title');
  const listed = store.list().find((note) => note.id === 'n1');
  assert.equal(listed.title, store.get('n1').title);
});
