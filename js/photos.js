/* Photos jointes aux comptes-rendus (Supabase Storage, bucket privé par utilisateur) */
const Photos = (() => {
  const BUCKET = 'report-photos';

  function db() {
    return window.dictavoixSupabase;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function fileToDataUrl(file) {
    return blobToDataUrl(file);
  }

  async function upload(file) {
    const { data: userData } = await db().auth.getUser();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${userData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await db().storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (error) {
      console.error('Photos.upload', error);
      throw error;
    }
    return path;
  }

  async function remove(path) {
    if (!path) return;
    const { error } = await db().storage.from(BUCKET).remove([path]);
    if (error) console.error('Photos.remove', error);
  }

  async function downloadAsDataUrl(path) {
    if (!path) return null;
    const { data, error } = await db().storage.from(BUCKET).download(path);
    if (error) {
      console.error('Photos.downloadAsDataUrl', error);
      return null;
    }
    return blobToDataUrl(data);
  }

  return { upload, remove, downloadAsDataUrl, fileToDataUrl };
})();
