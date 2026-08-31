export function emptyNotesLabel() {
  return 'No notes yet';
}

export function formatNoteTitle(title) {
  return String(title || '').trim();
}
