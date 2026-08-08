/* Photos jointes aux comptes-rendus (Supabase Storage, bucket privé par utilisateur).
   Toute image, quelle que soit sa source (appareil photo, pellicule, fichier importé)
   ou son format d'origine (JPEG, PNG, HEIC...), est reconvertie en JPEG au moment de
   la sélection : cela garantit un rendu homogène et évite que des formats non pris
   en charge par la génération de PDF (ex. HEIC) disparaissent silencieusement. */
const Photos = (() => {
  const BUCKET = 'report-photos';

  function db() {
    return window.dictavoixSupabase;
  }

  function normalizeToJpegDataUrl(file, quality = 0.9) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Ce format d'image n'est pas pris en charge par ce navigateur."));
      };
      img.src = objectUrl;
    });
  }

  function dataUrlToBlob(dataUrl) {
    const [header, base64] = dataUrl.split(',');
    const mime = (/data:(.*?);base64/.exec(header) || [])[1] || 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function uploadDataUrl(dataUrl) {
    const { data: userData } = await db().auth.getUser();
    const blob = dataUrlToBlob(dataUrl);
    const path = `${userData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await db().storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
    if (error) {
      console.error('Photos.uploadDataUrl', error);
      throw error;
    }
    return path;
  }

  async function remove(path) {
    if (!path) return;
    const { error } = await db().storage.from(BUCKET).remove([path]);
    if (error) console.error('Photos.remove', error);
  }

  async function removeMany(paths) {
    const list = (paths || []).filter(Boolean);
    if (!list.length) return;
    const { error } = await db().storage.from(BUCKET).remove(list);
    if (error) console.error('Photos.removeMany', error);
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

  async function downloadManyAsDataUrl(paths) {
    const list = paths || [];
    if (!list.length) return [];
    const results = await Promise.all(list.map((path) => downloadAsDataUrl(path)));
    return results.filter(Boolean);
  }

  return { normalizeToJpegDataUrl, uploadDataUrl, remove, removeMany, downloadAsDataUrl, downloadManyAsDataUrl };
})();
