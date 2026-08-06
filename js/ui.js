/* Composants UI réutilisables : toasts + modale de confirmation */
const UI = (() => {
  const toastContainer = document.getElementById('toast-container');

  function toast(message, type = 'info', duration = 3200) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.dataset.type = type;
    el.textContent = message;
    toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 0.2s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    }, duration);
  }

  // Modale de confirmation générique, basée sur une Promise<boolean>
  const confirmOverlay = document.getElementById('modal-confirm');
  const confirmMessageEl = document.getElementById('modal-confirm-title');
  const confirmOkBtn = document.getElementById('btn-confirm-ok');
  const confirmCancelBtn = document.getElementById('btn-confirm-cancel');

  let pendingResolve = null;

  function settle(result) {
    confirmOverlay.hidden = true;
    if (pendingResolve) {
      pendingResolve(result);
      pendingResolve = null;
    }
  }

  confirmOkBtn.addEventListener('click', () => settle(true));
  confirmCancelBtn.addEventListener('click', () => settle(false));
  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) settle(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !confirmOverlay.hidden) settle(false);
  });

  function confirm(message, { okLabel = 'Confirmer', cancelLabel = 'Annuler' } = {}) {
    confirmMessageEl.textContent = message;
    confirmOkBtn.textContent = okLabel;
    confirmCancelBtn.textContent = cancelLabel;
    confirmOverlay.hidden = false;
    return new Promise((resolve) => {
      pendingResolve = resolve;
    });
  }

  // Utilitaires génériques de modale (ouverture/fermeture par overlay)
  function openModal(overlayEl) {
    overlayEl.hidden = false;
  }
  function closeModal(overlayEl) {
    overlayEl.hidden = true;
  }

  return { toast, confirm, openModal, closeModal };
})();
