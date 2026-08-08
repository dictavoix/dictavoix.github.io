/* CRUD des fiches client (Supabase, centralisé et privé par utilisateur) */
const Clients = (() => {
  function db() {
    return window.dictavoixSupabase;
  }

  async function getAll() {
    const { data, error } = await db()
      .from('clients')
      .select('*')
      .order('last_name', { ascending: true });
    if (error) {
      console.error('Clients.getAll', error);
      return [];
    }
    return data;
  }

  async function getById(id) {
    const { data, error } = await db().from('clients').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error('Clients.getById', error);
      return null;
    }
    return data;
  }

  async function create({ firstName, lastName, address, contactInfo }) {
    const { data: userData } = await db().auth.getUser();
    const { data, error } = await db()
      .from('clients')
      .insert({
        user_id: userData.user.id,
        first_name: (firstName || '').trim(),
        last_name: (lastName || '').trim(),
        address: (address || '').trim(),
        contact_info: (contactInfo || '').trim(),
      })
      .select()
      .single();
    if (error) {
      console.error('Clients.create', error);
      throw error;
    }
    return data;
  }

  async function update(id, fields) {
    const payload = { updated_at: new Date().toISOString() };
    if (fields.firstName !== undefined) payload.first_name = fields.firstName.trim();
    if (fields.lastName !== undefined) payload.last_name = fields.lastName.trim();
    if (fields.address !== undefined) payload.address = fields.address.trim();
    if (fields.contactInfo !== undefined) payload.contact_info = fields.contactInfo.trim();
    if (fields.quickNote !== undefined) payload.quick_note = fields.quickNote;
    const { data, error } = await db().from('clients').update(payload).eq('id', id).select().single();
    if (error) {
      console.error('Clients.update', error);
      throw error;
    }
    return data;
  }

  async function remove(id) {
    const { error } = await db().from('clients').delete().eq('id', id);
    if (error) {
      console.error('Clients.remove', error);
      throw error;
    }
  }

  function fullName(client) {
    const name = `${client.first_name || ''} ${client.last_name || ''}`.trim();
    return name || 'Client sans nom';
  }

  async function getReports(clientId) {
    const { data, error } = await db()
      .from('reports')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Clients.getReports', error);
      return [];
    }
    return data;
  }

  async function getNotes(clientId) {
    const { data, error } = await db()
      .from('session_notes')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Clients.getNotes', error);
      return [];
    }
    return data;
  }

  return { getAll, getById, create, update, remove, fullName, getReports, getNotes };
})();
