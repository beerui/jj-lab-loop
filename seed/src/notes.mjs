import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE = path.join('data', 'notes.json');

export function createNotesStore({
  readFile = fs.readFileSync,
  writeFile = fs.writeFileSync,
  cwd = process.cwd(),
  dataPath = null
} = {}) {
  const file = dataPath || path.join(cwd, DEFAULT_FILE);

  const load = () => JSON.parse(readFile(file, 'utf8'));
  const save = (notes) => {
    writeFile(file, `${JSON.stringify(notes, null, 2)}\n`, 'utf8');
    return notes;
  };

  return {
    list() {
      return load();
    },
    get(id) {
      return load().find((note) => note.id === id) || null;
    },
    updateTitle(id, title) {
      const notes = load();
      const note = notes.find((item) => item.id === id);
      if (!note) throw new Error(`note not found: ${id}`);
      note.title = String(title);
      save(notes);
      return note;
    }
  };
}
