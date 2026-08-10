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

  const btnForgotPassword = document.getElementById('btn-forgot-password');

  const formSetPassword = document.getElementById('form-set-password');
  const setpwPassword = document.getElementById('setpw-password');
  const setpwPasswordConfirm = document.getElementById('setpw-password-confirm');
  const setpwStatus = document.getElementById('setpw-status');

  const screenBiometricPrompt = document.getElementById('screen-biometric-prompt');
  const btnEnableBiometric = document.getElementById('btn-enable-biometric');
  const btnSkipBiometric = document.getElementById('btn-skip-biometric');

  const screenBiometricLock = document.getElementById('screen-biometric-lock');
  const btnUnlockBiometric = document.getElementById('btn-unlock-biometric');
  const btnUsePasswordInstead = document.getElementById('btn-use-password-instead');
  const biometricStatus = document.getElementById('biometric-status');

  const screenCgv = document.getElementById('screen-cgv');
  const cgvBox = document.getElementById('cgv-box');
  const cgvAccept = document.getElementById('cgv-accept');
  const btnAcceptCgv = document.getElementById('btn-accept-cgv');
  const btnRefuseCgv = document.getElementById('btn-refuse-cgv');
  const cgvStatus = document.getElementById('cgv-status');

  /* Version des conditions générales en vigueur. À changer à chaque modification
     de fond du texte dans le <template id="tpl-cgv"> de index.html : l'acceptation
     est alors redemandée à tout le monde à la connexion suivante, et une nouvelle
     ligne est enregistrée dans la table cgv_acceptances. */
  const CGV_VERSION = '2026-08-10';

  const REMEMBER_KEY = 'dictavoix_remember_me';
  const BIOMETRIC_CRED_KEY = 'dictavoix_biometric_credential_id';
  const BIOMETRIC_SKIPPED_KEY = 'dictavoix_biometric_skipped';
  const BIOMETRIC_TRUST_UNTIL_KEY = 'dictavoix_biometric_trust_until';
  const BIOMETRIC_TRUST_WINDOW_MS = 5 * 60 * 1000;
  let justLoggedIn = false;

  function setStatus(el, message, tone) {
    el.textContent = message || '';
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  /* Après un déverrouillage (Face ID ou mot de passe), on reste "de confiance"
     quelques minutes : ça évite de redemander Face ID quand l'appli est juste
     mise en arrière-plan brièvement (ex: partage/téléchargement d'un PDF qui
     ouvre la feuille de partage iOS puis revient tout de suite dans l'appli). */
  function isBiometricTrustActive() {
    const until = Number(localStorage.getItem(BIOMETRIC_TRUST_UNTIL_KEY) || 0);
    return Date.now() < until;
  }

  /* Affiche l'écran de verrouillage en ne laissant visible que `visible`. */
  function showLockPanel(visible) {
    appRoot.hidden = true;
    lockScreen.hidden = false;
    btnLogout.hidden = true;
    [formLogin, formSetPassword, screenBiometricPrompt, screenBiometricLock, screenCgv].forEach((panel) => {
      panel.hidden = panel !== visible;
    });
  }

  function enterApp() {
    localStorage.setItem(BIOMETRIC_TRUST_UNTIL_KEY, String(Date.now() + BIOMETRIC_TRUST_WINDOW_MS));
    appRoot.hidden = false;
    lockScreen.hidden = true;
    btnLogout.hidden = false;
  }

  /* Aucun accès à l'application tant que la version en vigueur des conditions
     générales n'a pas été acceptée : le passage par cet écran est obligatoire
     pour tout le monde, y compris les comptes créés avant sa mise en place. */
  async function showApp() {
    if (await hasAcceptedCurrentCgv()) {
      enterApp();
      return;
    }
    showCgvScreen();
  }

  function showLoginForm() { showLockPanel(formLogin); }
  function showSetPasswordForm() { showLockPanel(formSetPassword); }
  function showBiometricPrompt() { showLockPanel(screenBiometricPrompt); }
  function showBiometricLock() { showLockPanel(screenBiometricLock); }

  function showCgvScreen() {
    cgvAccept.checked = false;
    btnAcceptCgv.disabled = true;
    setStatus(cgvStatus, '');
    showLockPanel(screenCgv);
  }

  /* ---------- Déverrouillage rapide par Face ID / empreinte (WebAuthn) ----------
     Verrou local en plus de la session Supabase : n'importe qui avec le téléphone
     déverrouillé ne peut pas ouvrir l'appli sans repasser par Face ID/empreinte. */
  function randomBytes(len) {
    return crypto.getRandomValues(new Uint8Array(len));
  }

  function bufToBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }

  function base64ToBuf(b64) {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  async function isBiometricAvailable() {
    return !!(
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  }

  function hasBiometricEnrolled() {
    return !!localStorage.getItem(BIOMETRIC_CRED_KEY);
  }

  async function enrollBiometric(email) {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: 'Dictavoix' },
        user: {
          id: randomBytes(16),
          name: email || 'utilisateur',
          displayName: email || 'Utilisateur Dictavoix',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
      },
    });
    localStorage.setItem(BIOMETRIC_CRED_KEY, bufToBase64(credential.rawId));
  }

  async function verifyBiometric() {
    const credId = localStorage.getItem(BIOMETRIC_CRED_KEY);
    if (!credId) return false;
    try {
      await navigator.credentials.get({
        publicKey: {
          challenge: randomBytes(32),
          allowCredentials: [{ id: base64ToBuf(credId), type: 'public-key' }],
          userVerification: 'required',
          timeout: 60000,
        },
      });
      return true;
    } catch (err) {
      console.error('Vérification biométrique refusée', err);
      return false;
    }
  }

  async function afterFreshLogin() {
    if (!hasBiometricEnrolled() && localStorage.getItem(BIOMETRIC_SKIPPED_KEY) !== '1' && (await isBiometricAvailable())) {
      showBiometricPrompt();
    } else {
      showApp();
    }
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

  /* ---------- Conditions générales ----------
     Le texte vit dans un <template> unique de index.html : on le recopie à la
     fois dans l'écran de consentement et dans la fenêtre "Mentions légales",
     pour qu'il n'existe jamais deux versions divergentes du même texte. */
  const cgvTemplate = document.getElementById('tpl-cgv');
  const legalCgvSlot = document.getElementById('legal-cgv-slot');
  if (cgvTemplate) {
    if (cgvBox) cgvBox.appendChild(cgvTemplate.content.cloneNode(true));
    if (legalCgvSlot) legalCgvSlot.appendChild(cgvTemplate.content.cloneNode(true));
  }

  /* La preuve de l'accord vit dans la base ; la trace locale ci-dessous n'est
     qu'un pense-bête d'affichage, pour ne pas réafficher les conditions à
     quelqu'un qui les a déjà acceptées mais dont l'appareil est hors réseau. */
  const CGV_LOCAL_KEY = 'dictavoix_cgv_accepted_version';

  async function hasAcceptedCurrentCgv() {
    const { data, error } = await supabaseClient
      .from('cgv_acceptances')
      .select('id')
      .eq('version', CGV_VERSION)
      .limit(1);
    if (error) {
      console.error('Vérification des conditions générales impossible', error);
      return localStorage.getItem(CGV_LOCAL_KEY) === CGV_VERSION;
    }
    const accepted = Array.isArray(data) && data.length > 0;
    if (accepted) localStorage.setItem(CGV_LOCAL_KEY, CGV_VERSION);
    return accepted;
  }

  async function recordCgvAcceptance() {
    const { data } = await supabaseClient.auth.getUser();
    const user = data && data.user;
    if (!user) return { error: new Error('Session expirée, reconnectez-vous.') };
    return supabaseClient.from('cgv_acceptances').insert({
      user_id: user.id,
      version: CGV_VERSION,
      user_email: user.email || '',
      user_agent: navigator.userAgent || '',
    });
  }

  cgvAccept.addEventListener('change', () => {
    btnAcceptCgv.disabled = !cgvAccept.checked;
  });

  btnAcceptCgv.addEventListener('click', async () => {
    if (!cgvAccept.checked) return;
    btnAcceptCgv.disabled = true;
    setStatus(cgvStatus, 'Enregistrement de votre acceptation…');
    const { error } = await recordCgvAcceptance();
    /* 23505 = doublon sur (user_id, version) : l'acceptation existe déjà,
       par exemple si le premier envoi a abouti malgré une erreur réseau. */
    if (error && error.code !== '23505') {
      btnAcceptCgv.disabled = false;
      setStatus(cgvStatus, "Impossible d'enregistrer votre acceptation : " + error.message, 'error');
      return;
    }
    localStorage.setItem(CGV_LOCAL_KEY, CGV_VERSION);
    setStatus(cgvStatus, '');
    enterApp();
  });

  btnRefuseCgv.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
  });

  const hash = window.location.hash || '';
  const isRecoveryOrInvite = /type=(invite|recovery)/.test(hash);

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus(lockStatus, 'Connexion en cours…');
    localStorage.setItem(REMEMBER_KEY, loginRemember.checked ? 'on' : 'off');
    justLoggedIn = true;
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: loginEmail.value.trim(),
      password: loginPassword.value,
    });
    if (error) {
      justLoggedIn = false;
      setStatus(lockStatus, "Email ou mot de passe incorrect.", 'error');
      return;
    }
    setStatus(lockStatus, '');
    await afterFreshLogin();
  });

  btnEnableBiometric.addEventListener('click', async () => {
    try {
      const { data } = await supabaseClient.auth.getUser();
      await enrollBiometric(data && data.user && data.user.email);
    } catch (err) {
      console.error("Impossible d'activer Face ID/empreinte", err);
    }
    showApp();
  });

  btnSkipBiometric.addEventListener('click', () => {
    localStorage.setItem(BIOMETRIC_SKIPPED_KEY, '1');
    showApp();
  });

  btnUnlockBiometric.addEventListener('click', async () => {
    setStatus(biometricStatus, 'Vérification…');
    const ok = await verifyBiometric();
    if (ok) {
      setStatus(biometricStatus, '');
      showApp();
    } else {
      setStatus(biometricStatus, 'Échec de la vérification. Réessayez ou utilisez votre mot de passe.', 'error');
    }
  });

  btnUsePasswordInstead.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
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

  btnForgotPassword.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    if (!email) {
      setStatus(lockStatus, "Entrez d'abord votre email ci-dessus, puis cliquez sur ce lien.", 'error');
      return;
    }
    setStatus(lockStatus, 'Envoi en cours…');
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) {
      setStatus(lockStatus, "Impossible d'envoyer l'email : " + error.message, 'error');
      return;
    }
    setStatus(lockStatus, 'Email envoyé : suivez le lien reçu pour créer un nouveau mot de passe.');
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
      } else if (justLoggedIn) {
        /* Géré par le formulaire de connexion lui-même (afterFreshLogin). */
      } else if (hasBiometricEnrolled() && !isBiometricTrustActive()) {
        showBiometricLock();
      } else {
        showApp();
      }
    }
  });

  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) {
      if (isRecoveryOrInvite) {
        showSetPasswordForm();
      } else if (hasBiometricEnrolled() && !isBiometricTrustActive()) {
        showBiometricLock();
      } else {
        showApp();
      }
    } else {
      showLoginForm();
    }
  });
})();
