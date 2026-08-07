/* Contrôle d'accès via Supabase Auth (comptes individuels, invitation par email) */
(() => {
  const lockScreen = document.getElementById('lock-screen');
  const appRoot = document.getElementById('app');
  const btnLogout = document.getElementById('btn-logout');

  const formLogin = document.getElementById('form-login');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginRemember = document.getElementById('login-remember');
  const lockStatus = document.getElementById('lock-status');

  const formSetPassword = document.getElementById('form-set-password');
  const setpwPassword = document.getElementById('setpw-password');
  const setpwPasswordConfirm = document.getElementById('setpw-password-confirm');
  const setpwStatus = document.getElementById('setpw-status');

  const REMEMBER_KEY = 'dictavoix_remember_me';

  function setStatus(el, message, tone) {
    el.textContent = message || '';
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  function showApp() {
    appRoot.hidden = false;
    lockScreen.hidden = true;
    btnLogout.hidden = false;
  }

  function showLoginForm() {
    appRoot.hidden = true;
    lockScreen.hidden = false;
    btnLogout.hidden = true;
    formSetPassword.hidden = true;
    formLogin.hidden = false;
  }

  function showSetPasswordForm() {
    appRoot.hidden = true;
    lockScreen.hidden = false;
    btnLogout.hidden = true;
    formLogin.hidden = true;
    formSetPassword.hidden = false;
  }

  const config = window.DICTAVOIX_SUPABASE;
  if (!config || !window.supabase) {
    showLoginForm();
    setStatus(lockStatus, 'Connexion indisponible : configuration Supabase manquante.', 'error');
    return;
  }

  /* Stockage de session : persistant (localStorage) si "Rester connecté" est coché,
     sinon limité à l'onglet en cours (sessionStorage). */
  function rememberIsOn() {
    return localStorage.getItem(REMEMBER_KEY) !== 'off';
  }

  const dynamicStorage = {
    getItem: (key) => (rememberIsOn() ? window.localStorage : window.sessionStorage).getItem(key),
    setItem: (key, value) => (rememberIsOn() ? window.localStorage : window.sessionStorage).setItem(key, value),
    removeItem: (key) => (rememberIsOn() ? window.localStorage : window.sessionStorage).removeItem(key),
  };

  const supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: {
      storage: dynamicStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  window.dictavoixSupabase = supabaseClient;

  /* Bouton afficher/masquer sur tous les champs mot de passe */
  document.querySelectorAll('.btn-toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const isHidden = target.type === 'password';
      target.type = isHidden ? 'text' : 'password';
      btn.setAttribute('aria-label', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      btn.classList.toggle('is-visible', isHidden);
    });
  });

  const hash = window.location.hash || '';
  const isRecoveryOrInvite = /type=(invite|recovery)/.test(hash);

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus(lockStatus, 'Connexion en cours…');
    localStorage.setItem(REMEMBER_KEY, loginRemember.checked ? 'on' : 'off');
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: loginEmail.value.trim(),
      password: loginPassword.value,
    });
    if (error) {
      setStatus(lockStatus, "Email ou mot de passe incorrect.", 'error');
      return;
    }
    setStatus(lockStatus, '');
    showApp();
  });

  formSetPassword.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (setpwPassword.value !== setpwPasswordConfirm.value) {
      setStatus(setpwStatus, 'Les deux mots de passe ne correspondent pas.', 'error');
      return;
    }
    if (setpwPassword.value.length < 8) {
      setStatus(setpwStatus, 'Le mot de passe doit contenir au moins 8 caractères.', 'error');
      return;
    }
    setStatus(setpwStatus, 'Activation du compte…');
    localStorage.setItem(REMEMBER_KEY, 'on');
    const { error } = await supabaseClient.auth.updateUser({ password: setpwPassword.value });
    if (error) {
      setStatus(setpwStatus, "Impossible d'activer le compte : " + error.message, 'error');
      return;
    }
    setStatus(setpwStatus, '');
    history.replaceState(null, '', window.location.pathname);
    showApp();
  });

  btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      showSetPasswordForm();
      return;
    }
    if (event === 'SIGNED_OUT') {
      showLoginForm();
      return;
    }
    if (session) {
      if (isRecoveryOrInvite) {
        showSetPasswordForm();
      } else {
        showApp();
      }
    }
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) {
      if (isRecoveryOrInvite) {
        showSetPasswordForm();
      } else {
        showApp();
      }
    } else {
      showLoginForm();
    }
  });
})();
