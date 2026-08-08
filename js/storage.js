/* Wrapper localStorage : lecture/écriture JSON sécurisées */
const Storage = (() => {
  const KEYS = {
    PROFILE: 'dictavoix_profile',
    DRAFT: 'dictavoix_draft',
  };

  function get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.error(`Storage.get(${key}) a échoué`, err);
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Storage.set(${key}) a échoué`, err);
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error(`Storage.remove(${key}) a échoué`, err);
    }
  }

  // --- Profil praticien ---
  function getProfile() {
    return get(KEYS.PROFILE, { name: '', logo: '', contact: '' });
  }
  function setProfile(profile) {
    return set(KEYS.PROFILE, profile);
  }

  // --- Brouillon compte-rendu ---
  function getDraft() {
    return get(KEYS.DRAFT, null);
  }
  function setDraft(draft) {
    return set(KEYS.DRAFT, draft);
  }
  function clearDraft() {
    remove(KEYS.DRAFT);
  }

  return {
    KEYS,
    get,
    set,
    remove,
    getProfile,
    setProfile,
    getDraft,
    setDraft,
    clearDraft,
  };
})();
