/* CRUD des notes de séance (Supabase, centralisé et privé par utilisateur) */
const Notes = (() => {
  function db() {
    return window.dictavoixSupabase;
  }

  function generateTitle(content) {
    if (!content) return 'Note sans titre';
    const firstLine = content.trim().split('\n')[0];
    const words = firstLine.split(/\s+/).slice(0, 8).join(' ');
    if (!words) return 'Note sans titre';
    return words.length < firstLine.length ? `${words}…` : words;
  }

  /* Seules les notes pas encore rangées dans un dossier client apparaissent ici. */
  async function getAll() {
    const { data, error } = await db()
      .from('session_notes')
      .select('*')
      .is('client_id', null)
      .order('updated_at', { ascending: false });
    if (error) {
      console.error('Notes.getAll', error);
      return [];
    }
    return data;
  }

  async function getById(id) {
    const { data, error } = await db().from('session_notes').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error('Notes.getById', error);
      return null;
    }
    return data;
  }

  async function create({ title, content }) {
    const { data: userData } = await db().auth.getUser();
    const { data, error } = await db()
      .from('session_notes')
      .insert({
        user_id: userData.user.id,
        title: title && title.trim() ? title.trim() : generateTitle(content),
        content: content || '',
      })
      .select()
      .single();
    if (error) {
      console.error('Notes.create', error);
      throw error;
    }
    return data;
  }

  async function update(id, { title, content }) {
    const { data, error } = await db()
      .from('session_notes')
      .update({
        title: title && title.trim() ? title.trim() : generateTitle(content),
        content: content || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('Notes.update', error);
      throw error;
    }
    return data;
  }

  async function remove(id) {
    const { error } = await db().from('session_notes').delete().eq('id', id);
    if (error) console.error('Notes.remove', error);
  }

  /* Range la note dans un dossier client : elle disparaît de la liste générale
     et apparaît désormais dans l'historique de ce client. */
  async function moveToClient(id, clientId) {
    const { error } = await db().from('session_notes').update({ client_id: clientId }).eq('id', id);
    if (error) {
      console.error('Notes.moveToClient', error);
      throw error;
    }
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
  function renderList(notes, { onEdit, onDelete, onTransfer, onFileToClient }) {
    const listEl = document.getElementById('notes-list');
    const emptyEl = document.getElementById('notes-empty');

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
          <button type="button" class="btn btn--ghost btn--sm" data-action="file">Dossier client</button>
          <button type="button" class="btn btn--ghost btn--sm" data-action="edit">Modifier</button>
          <button type="button" class="btn btn--danger btn--sm" data-action="delete">Supprimer</button>
        </div>
      `;
      li.querySelector('.list-card__title').textContent = note.title;
      li.querySelector('.list-card__excerpt').textContent = note.content;
      li.querySelector('.list-card__meta').textContent = `Modifiée le ${formatDate(note.updated_at)}`;

      li.querySelector('[data-action="edit"]').addEventListener('click', () => onEdit(note));
      li.querySelector('[data-action="delete"]').addEventListener('click', () => onDelete(note));
      li.querySelector('[data-action="transfer"]').addEventListener('click', () => onTransfer(note));
      li.querySelector('[data-action="file"]').addEventListener('click', () => onFileToClient(note));

      listEl.appendChild(li);
    });
  }

  return { generateTitle, getAll, getById, create, update, remove, moveToClient, formatDate, renderList };
})();
