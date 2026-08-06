/* Contrôle d'accès via Netlify Identity (invite-only) */
(() => {
  const lockScreen = document.getElementById('lock-screen');
  const appRoot = document.getElementById('app');
  const btnLogin = document.getElementById('btn-lock-login');
  const btnLogout = document.getElementById('btn-logout');
  const lockStatus = document.getElementById('lock-status');

  function setStatus(message, tone) {
    lockStatus.textContent = message || '';
    if (tone) lockStatus.dataset.tone = tone;
    else delete lockStatus.dataset.tone;
  }

  function showApp() {
    appRoot.hidden = false;
    lockScreen.hidden = true;
    btnLogout.hidden = false;
  }

  function showLock() {
    appRoot.hidden = true;
    lockScreen.hidden = false;
    btnLogout.hidden = true;
  }

  const identity = window.netlifyIdentity;

  if (!identity) {
    showLock();
    setStatus(
      "Connexion indisponible : ouvrez cette page depuis son adresse Netlify déployée, avec Identity activé.",
      'error'
    );
    return;
  }

  identity.on('init', (user) => {
    if (user) showApp();
    else showLock();
  });

  identity.on('login', () => {
    showApp();
    setStatus('');
    identity.close();
  });

  identity.on('logout', () => {
    showLock();
    setStatus('');
  });

  identity.on('error', (err) => {
    console.error('Netlify Identity', err);
    setStatus('Erreur de connexion. Réessayez.', 'error');
  });

  btnLogin.addEventListener('click', () => identity.open('login'));
  btnLogout.addEventListener('click', () => identity.logout());

  identity.init();
})();
