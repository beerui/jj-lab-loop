import { createNotesStore } from './notes.mjs';
import { emptyNotesLabel, formatNoteTitle } from './format.mjs';

const store = createNotesStore();
const [cmd, id, ...rest] = process.argv.slice(2);

if (cmd === 'list') {
  const notes = store.list();
  process.stdout.write(notes.length ? `${notes.map((n) => n.title).join('\n')}\n` : `${emptyNotesLabel()}\n`);
} else if (cmd === 'get') {
  const note = store.get(id);
  process.stdout.write(note ? `${formatNoteTitle(note.title)}\n` : 'missing\n');
} else if (cmd === 'set-title') {
  const note = store.updateTitle(id, rest.join(' '));
  process.stdout.write(`${note.title}\n`);
} else {
  process.stderr.write('usage: node src/cli.mjs list|get <id>|set-title <id> <title>\n');
  process.exitCode = 1;
}
