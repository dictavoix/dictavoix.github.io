/* CRUD des notes de séance (localStorage via Storage) */
const Notes = (() => {
  function uid() {
    return `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function generateTitle(content) {
    if (!content) return 'Note sans titre';
    const firstLine = content.trim().split('\n')[0];
    const words = firstLine.split(/\s+/).slice(0, 8).join(' ');
    if (!words) return 'Note sans titre';
    return words.length < firstLine.length ? `${words}…` : words;
  }

  function getAll() {
    return Storage.getNotes().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function getById(id) {
    return Storage.getNotes().find((n) => n.id === id) || null;
  }

  function create({ title, content }) {
    const notes = Storage.getNotes();
    const now = Date.now();
    const note = {
      id: uid(),
      title: title && title.trim() ? title.trim() : generateTitle(content),
      content: content || '',
      createdAt: now,
      updatedAt: now,
    };
    notes.push(note);
    Storage.setNotes(notes);
    return note;
  }

  function update(id, { title, content }) {
    const notes = Storage.getNotes();
    const idx = notes.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    notes[idx] = {
      ...notes[idx],
      title: title && title.trim() ? title.trim() : generateTitle(content),
      content: content || '',
      updatedAt: Date.now(),
    };
    Storage.setNotes(notes);
    return notes[idx];
  }

  function remove(id) {
    const notes = Storage.getNotes().filter((n) => n.id !== id);
    Storage.setNotes(notes);
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // --- Rendu de la liste dans le DOM ---
  function renderList({ onEdit, onDelete, onTransfer }) {
    const listEl = document.getElementById('notes-list');
    const emptyEl = document.getElementById('notes-empty');
    const notes = getAll();

    listEl.innerHTML = '';

    if (notes.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    notes.forEach((note) => {
      const li = document.createElement('li');
      li.className = 'list-card';
      li.innerHTML = `
        <h3 class="list-card__title"></h3>
        <p class="list-card__excerpt"></p>
        <span class="list-card__meta"></span>
        <div class="list-card__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-action="transfer">Transférer</button>
          <button type="button" class="btn btn--ghost btn--sm" data-action="edit">Modifier</button>
          <button type="button" class="btn btn--danger btn--sm" data-action="delete">Supprimer</button>
        </div>
      `;
      li.querySelector('.list-card__title').textContent = note.title;
      li.querySelector('.list-card__excerpt').textContent = note.content;
      li.querySelector('.list-card__meta').textContent = `Modifiée le ${formatDate(note.updatedAt)}`;

      li.querySelector('[data-action="edit"]').addEventListener('click', () => onEdit(note));
      li.querySelector('[data-action="delete"]').addEventListener('click', () => onDelete(note));
      li.querySelector('[data-action="transfer"]').addEventListener('click', () => onTransfer(note));

      listEl.appendChild(li);
    });
  }

  return { generateTitle, getAll, getById, create, update, remove, renderList };
})();
