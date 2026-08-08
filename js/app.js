/* Initialisation et logique générale de l'application */
document.addEventListener('DOMContentLoaded', () => {

  /* ============ Thème (mode nuit) ============ */
  const THEME_KEY = 'dictavoix_theme';
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const themeIconMoon = btnThemeToggle.querySelector('.theme-icon--moon');
  const themeIconSun = btnThemeToggle.querySelector('.theme-icon--sun');
  const prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function getEffectiveTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return prefersDarkQuery.matches ? 'dark' : 'light';
  }

  function updateThemeIcon() {
    const isDark = getEffectiveTheme() === 'dark';
    themeIconMoon.classList.toggle('is-theme-icon-hidden', isDark);
    themeIconSun.classList.toggle('is-theme-icon-hidden', !isDark);
    btnThemeToggle.setAttribute('aria-label', isDark ? 'Activer le mode jour' : 'Activer le mode nuit');
  }

  btnThemeToggle.addEventListener('click', () => {
    const next = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeIcon();
  });

  prefersDarkQuery.addEventListener('change', () => {
    if (!localStorage.getItem(THEME_KEY)) updateThemeIcon();
  });

  updateThemeIcon();

  /* ============ Navigation ============ */
  const views = document.querySelectorAll('.view');
  const navButtons = document.querySelectorAll('.bottom-nav__btn');

  function switchView(name) {
    views.forEach((v) => { v.hidden = v.dataset.view !== name; });
    navButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.nav === name));
    if (name === 'notes') renderNotesList();
    if (name === 'clients') renderClientsList();
  }

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.nav));
  });

  /* ============ Profil praticien ============ */
  const modalProfile = document.getElementById('modal-profile');
  const formProfile = document.getElementById('form-profile');
  const inputPractitionerName = document.getElementById('input-practitioner-name');
  const inputPractitionerContact = document.getElementById('input-practitioner-contact');
  const inputLogo = document.getElementById('input-logo');
  const logoPreview = document.getElementById('logo-preview');
  const logoPreviewImg = document.getElementById('logo-preview-img');
  const btnRemoveLogo = document.getElementById('btn-remove-logo');

  let pendingLogoBase64 = undefined; // undefined = pas de changement, '' = supprimé

  function openProfileModal() {
    const profile = Storage.getProfile();
    inputPractitionerName.value = profile.name || '';
    inputPractitionerContact.value = profile.contact || '';
    pendingLogoBase64 = undefined;
    if (profile.logo) {
      logoPreviewImg.src = profile.logo;
      logoPreview.hidden = false;
    } else {
      logoPreview.hidden = true;
    }
    inputLogo.value = '';
    UI.openModal(modalProfile);
  }

  document.getElementById('btn-open-profile').addEventListener('click', openProfileModal);
  document.getElementById('btn-close-profile').addEventListener('click', () => UI.closeModal(modalProfile));
  modalProfile.addEventListener('click', (e) => { if (e.target === modalProfile) UI.closeModal(modalProfile); });

  inputLogo.addEventListener('change', () => {
    const file = inputLogo.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      UI.toast('Le fichier sélectionné n\'est pas une image.', 'error');
      inputLogo.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingLogoBase64 = reader.result;
      logoPreviewImg.src = pendingLogoBase64;
      logoPreview.hidden = false;
    };
    reader.onerror = () => UI.toast('Impossible de lire ce fichier image.', 'error');
    reader.readAsDataURL(file);
  });

  btnRemoveLogo.addEventListener('click', () => {
    pendingLogoBase64 = '';
    logoPreview.hidden = true;
    inputLogo.value = '';
  });

  formProfile.addEventListener('submit', (e) => {
    e.preventDefault();
    const current = Storage.getProfile();
    const profile = {
      name: inputPractitionerName.value.trim(),
      contact: inputPractitionerContact.value.trim(),
      logo: pendingLogoBase64 !== undefined ? pendingLogoBase64 : (current.logo || ''),
    };
    Storage.setProfile(profile);
    UI.closeModal(modalProfile);
    UI.toast('Profil enregistré.', 'success');
  });

  /* ============ Mentions légales & confidentialité ============ */
  const modalLegal = document.getElementById('modal-legal');

  document.getElementById('btn-open-legal').addEventListener('click', () => UI.openModal(modalLegal));
  document.getElementById('btn-close-legal').addEventListener('click', () => UI.closeModal(modalLegal));
  document.getElementById('btn-close-legal-footer').addEventListener('click', () => UI.closeModal(modalLegal));
  modalLegal.addEventListener('click', (e) => { if (e.target === modalLegal) UI.closeModal(modalLegal); });

  /* ============ Vue Compte-rendu ============ */
  const inputPatientName = document.getElementById('input-patient-name');
  const textareaReport = document.getElementById('textarea-report');
  const speechStatus = document.getElementById('speech-status');
  const btnMic = document.getElementById('btn-mic');
  const btnClearReport = document.getElementById('btn-clear-report');
  const btnSaveAsNote = document.getElementById('btn-save-as-note');
  const btnExportPdf = document.getElementById('btn-export-pdf');
  const draftBanner = document.getElementById('draft-banner');
  const btnRestoreDraft = document.getElementById('btn-restore-draft');
  const btnDiscardDraft = document.getElementById('btn-discard-draft');

  function setSpeechStatus(message, tone = '') {
    speechStatus.textContent = message || '';
    if (tone) speechStatus.dataset.tone = tone;
    else delete speechStatus.dataset.tone;
  }

  function joinText(base, addition) {
    const trimmedAddition = addition.trim();
    if (!trimmedAddition) return base;
    if (!base) return trimmedAddition;
    return base.replace(/\s+$/, '') + (base.endsWith('\n') ? '' : ' ') + trimmedAddition;
  }

  let baseText = '';
  let recognitionEndedByError = false;

  const speech = new Speech.SpeechController({
    onStart() {
      baseText = textareaReport.value;
      btnMic.classList.add('is-listening');
      btnMic.setAttribute('aria-pressed', 'true');
      btnMic.setAttribute('aria-label', 'Arrêter la dictée vocale');
      recognitionEndedByError = false;
      setSpeechStatus('Écoute en cours… parlez normalement.', 'ok');
    },
    onInterim(text) {
      textareaReport.value = joinText(baseText, text);
    },
    onFinal(text) {
      baseText = joinText(baseText, text);
      textareaReport.value = baseText;
    },
    onError(message) {
      recognitionEndedByError = true;
      setSpeechStatus(message, 'error');
      btnMic.classList.remove('is-listening');
      btnMic.setAttribute('aria-pressed', 'false');
      btnMic.setAttribute('aria-label', 'Démarrer la dictée vocale');
    },
    onEnd() {
      btnMic.classList.remove('is-listening');
      btnMic.setAttribute('aria-pressed', 'false');
      btnMic.setAttribute('aria-label', 'Démarrer la dictée vocale');
      if (!recognitionEndedByError) {
        setSpeechStatus('Dictée arrêtée.', '');
      }
    },
  });

  if (!Speech.isSupported) {
    btnMic.disabled = true;
    setSpeechStatus("La dictée vocale n'est pas prise en charge par ce navigateur. Essayez Chrome ou Edge.", 'error');
  }

  btnMic.addEventListener('click', () => {
    if (btnMic.classList.contains('is-listening')) {
      speech.stop();
    } else {
      speech.start();
    }
  });

  btnClearReport.addEventListener('click', async () => {
    if (!textareaReport.value.trim() && !inputPatientName.value.trim()) return;
    const ok = await UI.confirm('Effacer le compte-rendu en cours ? Cette action est irréversible.', { okLabel: 'Effacer' });
    if (!ok) return;
    textareaReport.value = '';
    inputPatientName.value = '';
    editingReportId = null;
    Storage.clearDraft();
    setSpeechStatus('');
    UI.toast('Compte-rendu effacé.', 'success');
  });

  const btnOrganizeAi = document.getElementById('btn-organize-ai');
  const organizeStatus = document.getElementById('organize-status');

  function setOrganizeStatus(message, tone = '') {
    organizeStatus.textContent = message || '';
    if (tone) organizeStatus.dataset.tone = tone;
    else delete organizeStatus.dataset.tone;
  }

  btnOrganizeAi.addEventListener('click', async () => {
    const text = textareaReport.value.trim();
    if (!text) {
      setOrganizeStatus('Le compte-rendu est vide.', 'error');
      return;
    }
    if (!window.dictavoixSupabase) {
      setOrganizeStatus('Fonction indisponible pour le moment.', 'error');
      return;
    }
    btnOrganizeAi.disabled = true;
    setOrganizeStatus("Organisation en cours…");
    try {
      const { data, error } = await window.dictavoixSupabase.functions.invoke('organize-report', {
        body: { text },
      });
      if (error || !data || !data.organized) {
        throw error || new Error('Réponse invalide');
      }
      textareaReport.value = data.organized;
      setOrganizeStatus('Compte-rendu organisé.', 'ok');
    } catch (err) {
      console.error(err);
      setOrganizeStatus("Impossible d'organiser le compte-rendu pour le moment.", 'error');
    } finally {
      btnOrganizeAi.disabled = false;
    }
  });

  btnSaveAsNote.addEventListener('click', () => {
    if (!textareaReport.value.trim()) {
      UI.toast('Le compte-rendu est vide.', 'error');
      return;
    }
    Notes.create({ title: '', content: textareaReport.value });
    UI.toast('Note créée à partir du compte-rendu.', 'success');
  });

  let editingReportId = null;

  /* ---- Prévisualisation du PDF avant enregistrement ---- */
  const modalPdfPreview = document.getElementById('modal-pdf-preview');
  const pdfPreviewContainer = document.getElementById('pdf-preview-container');
  const btnClosePdfPreview = document.getElementById('btn-close-pdf-preview');
  const btnPdfPreviewEdit = document.getElementById('btn-pdf-preview-edit');
  const btnPdfPreviewConfirm = document.getElementById('btn-pdf-preview-confirm');

  let pendingPdf = null;

  function waitForPdfjs(timeoutMs = 20000) {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Délai dépassé pour le chargement de PDF.js')), timeoutMs);
      window.addEventListener('pdfjslib-ready', () => {
        clearTimeout(timer);
        resolve(window.pdfjsLib);
      }, { once: true });
    });
  }

  function setPdfPreviewStatus(message, tone) {
    const p = document.createElement('p');
    p.className = 'pdf-preview-status';
    if (tone) p.dataset.tone = tone;
    p.textContent = message;
    pdfPreviewContainer.innerHTML = '';
    pdfPreviewContainer.appendChild(p);
  }

  function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
    ]);
  }

  /* Rendu de chaque page du PDF sur un <canvas> : fiable sur tous les navigateurs,
     contrairement à un <iframe> pointant vers le lecteur PDF natif (rendu noir sur certains).
     Un délai de sécurité évite de rester bloqué sur "Génération de l'aperçu…" indéfiniment
     si la bibliothèque PDF.js ne se charge pas (réseau, navigateur incompatible…). */
  async function renderPdfPreview(doc) {
    setPdfPreviewStatus('Génération de l’aperçu…');
    try {
      const pdfjsLib = await waitForPdfjs();
      const arrayBuffer = doc.output('arraybuffer');
      const pdf = await withTimeout(
        pdfjsLib.getDocument({ data: arrayBuffer }).promise,
        20000,
        'Délai dépassé lors du chargement du PDF'
      );
      pdfPreviewContainer.innerHTML = '';
      const containerWidth = pdfPreviewContainer.clientWidth - 28 || 600;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2.5, containerWidth / unscaledViewport.width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-preview-page';
        /* Rendu à la densité de pixels réelle de l'écran (Retina/iPhone), sinon
           le canvas est flou une fois affiché à sa taille CSS. */
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(viewport.width * dpr);
        canvas.height = Math.round(viewport.height * dpr);
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        pdfPreviewContainer.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        await withTimeout(
          page.render({ canvasContext: ctx, viewport }).promise,
          15000,
          'Délai dépassé lors du rendu de la page'
        );
      }
    } catch (err) {
      console.error(err);
      setPdfPreviewStatus("Impossible d'afficher l'aperçu, mais vous pouvez tout de même enregistrer le PDF.", 'error');
    }
  }

  function closePdfPreview() {
    UI.closeModal(modalPdfPreview);
    pendingPdf = null;
  }

  btnClosePdfPreview.addEventListener('click', closePdfPreview);
  btnPdfPreviewEdit.addEventListener('click', closePdfPreview);
  modalPdfPreview.addEventListener('click', (e) => { if (e.target === modalPdfPreview) closePdfPreview(); });

  btnPdfPreviewConfirm.addEventListener('click', () => {
    if (!pendingPdf) return;
    const { doc, fileName, patientName, content } = pendingPdf;
    doc.save(fileName);
    if (editingReportId) {
      updateReportRecord(editingReportId, { patientName, content });
      editingReportId = null;
      UI.toast('Compte-rendu mis à jour dans l’historique.', 'success');
    } else {
      saveReportRecord({ patientName, content });
      UI.toast('PDF généré et enregistré.', 'success');
    }
    closePdfPreview();
  });

  const btnPdfPreviewFileClient = document.getElementById('btn-pdf-preview-file-client');

  btnPdfPreviewFileClient.addEventListener('click', () => {
    if (!pendingPdf) return;
    openClientPicker(async (client) => {
      const { doc, fileName, patientName, content } = pendingPdf;
      try {
        doc.save(fileName);
        if (editingReportId) {
          const { error } = await window.dictavoixSupabase
            .from('reports')
            .update({
              client_id: client.id,
              patient_name: (patientName || '').trim(),
              content,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingReportId);
          if (error) throw error;
          editingReportId = null;
        } else {
          const { data: userData } = await window.dictavoixSupabase.auth.getUser();
          const { error } = await window.dictavoixSupabase.from('reports').insert({
            user_id: userData.user.id,
            client_id: client.id,
            patient_name: (patientName || '').trim(),
            content,
          });
          if (error) throw error;
        }
        UI.toast(`PDF généré et rangé dans le dossier de ${Clients.fullName(client)}.`, 'success');
        closePdfPreview();
        renderReportsList();
      } catch (err) {
        console.error(err);
        UI.toast("Impossible d'enregistrer dans le dossier client.", 'error');
      }
    });
  });

  btnExportPdf.addEventListener('click', () => {
    if (!textareaReport.value.trim()) {
      UI.toast('Le compte-rendu est vide.', 'error');
      return;
    }
    const patientName = inputPatientName.value;
    const content = textareaReport.value;
    try {
      const { doc, fileName } = PDF.buildDoc({ patientName, content, profile: Storage.getProfile() });
      pendingPdf = { doc, fileName, patientName, content };
      UI.openModal(modalPdfPreview);
      renderPdfPreview(doc);
    } catch (err) {
      console.error(err);
      UI.toast('Échec de la génération du PDF.', 'error');
    }
  });

  /* ---- Historique des comptes-rendus enregistrés ---- */
  const reportsListEl = document.getElementById('reports-list');
  const reportsEmptyEl = document.getElementById('reports-empty');

  function reportUid() {
    return `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function formatReportDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function saveReportRecord({ patientName, content }) {
    const { data: userData } = await window.dictavoixSupabase.auth.getUser();
    const { error } = await window.dictavoixSupabase.from('reports').insert({
      user_id: userData.user.id,
      patient_name: (patientName || '').trim(),
      content,
    });
    if (error) console.error('saveReportRecord', error);
    await renderReportsList();
  }

  async function updateReportRecord(id, { patientName, content }) {
    const { error } = await window.dictavoixSupabase
      .from('reports')
      .update({ patient_name: (patientName || '').trim(), content, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) console.error('updateReportRecord', error);
    await renderReportsList();
  }

  async function renderReportsList() {
    const { data: reports, error } = await window.dictavoixSupabase
      .from('reports')
      .select('*')
      .is('client_id', null)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('renderReportsList', error);
      return;
    }
    reportsListEl.innerHTML = '';

    if (!reports || reports.length === 0) {
      reportsEmptyEl.hidden = false;
      return;
    }
    reportsEmptyEl.hidden = true;

    reports.forEach((report) => {
      const li = document.createElement('li');
      li.className = 'list-card';
      li.innerHTML = `
        <h3 class="list-card__title"></h3>
        <p class="list-card__excerpt"></p>
        <span class="list-card__meta"></span>
        <div class="list-card__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-action="edit">Modifier</button>
          <button type="button" class="btn btn--ghost btn--sm" data-action="download">Télécharger</button>
          <button type="button" class="btn btn--ghost btn--sm" data-action="file">Dossier client</button>
          <button type="button" class="btn btn--danger btn--sm" data-action="delete">Supprimer</button>
        </div>
      `;
      li.querySelector('.list-card__title').textContent = report.patient_name || 'Patient non renseigné';
      li.querySelector('.list-card__excerpt').textContent = report.content;
      li.querySelector('.list-card__meta').textContent = `Exporté le ${formatReportDate(new Date(report.created_at).getTime())}`;

      li.querySelector('[data-action="edit"]').addEventListener('click', () => {
        editingReportId = report.id;
        inputPatientName.value = report.patient_name || '';
        textareaReport.value = report.content;
        lastSavedSnapshot = currentSnapshot();
        switchView('compte-rendu');
        UI.toast('Compte-rendu chargé pour modification.', 'success');
      });

      li.querySelector('[data-action="download"]').addEventListener('click', () => {
        try {
          PDF.exportReport({ patientName: report.patient_name, content: report.content, profile: Storage.getProfile() });
        } catch (err) {
          console.error(err);
          UI.toast("Échec de l'export PDF.", 'error');
        }
      });

      li.querySelector('[data-action="file"]').addEventListener('click', () => {
        openClientPicker(async (client) => {
          const { error: linkError } = await window.dictavoixSupabase
            .from('reports')
            .update({ client_id: client.id })
            .eq('id', report.id);
          if (linkError) {
            console.error(linkError);
            UI.toast("Impossible d'enregistrer dans le dossier client.", 'error');
            return;
          }
          UI.toast(`Compte-rendu rangé dans le dossier de ${Clients.fullName(client)}.`, 'success');
          renderReportsList();
        });
      });

      li.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const ok = await UI.confirm('Supprimer ce compte-rendu de l’historique ? Cette action est irréversible.', { okLabel: 'Supprimer' });
        if (!ok) return;
        const { error: delError } = await window.dictavoixSupabase.from('reports').delete().eq('id', report.id);
        if (delError) console.error(delError);
        renderReportsList();
        UI.toast('Compte-rendu supprimé de l’historique.', 'success');
      });

      reportsListEl.appendChild(li);
    });
  }

  /* ---- Sauvegarde automatique du brouillon ---- */
  let lastSavedSnapshot = '';

  function currentSnapshot() {
    return JSON.stringify({ patientName: inputPatientName.value, content: textareaReport.value });
  }

  function autosaveDraft() {
    if (!draftBanner.hidden) return; // décision de restauration en attente : ne pas écraser le brouillon
    const snapshot = currentSnapshot();
    if (snapshot === lastSavedSnapshot) return;
    if (!textareaReport.value.trim() && !inputPatientName.value.trim()) {
      Storage.clearDraft();
      lastSavedSnapshot = snapshot;
      return;
    }
    Storage.setDraft({
      patientName: inputPatientName.value,
      content: textareaReport.value,
      updatedAt: Date.now(),
    });
    lastSavedSnapshot = snapshot;
  }

  setInterval(autosaveDraft, 8000);
  window.addEventListener('beforeunload', autosaveDraft);

  function restoreDraftPrompt() {
    const draft = Storage.getDraft();
    if (draft && (draft.content || '').trim()) {
      draftBanner.hidden = false;
    }
  }

  btnRestoreDraft.addEventListener('click', () => {
    const draft = Storage.getDraft();
    if (draft) {
      inputPatientName.value = draft.patientName || '';
      textareaReport.value = draft.content || '';
      lastSavedSnapshot = currentSnapshot();
    }
    draftBanner.hidden = true;
    UI.toast('Brouillon restauré.', 'success');
  });

  btnDiscardDraft.addEventListener('click', () => {
    Storage.clearDraft();
    draftBanner.hidden = true;
  });

  /* ============ Vue Notes ============ */
  const modalNote = document.getElementById('modal-note');
  const formNote = document.getElementById('form-note');
  const inputNoteId = document.getElementById('input-note-id');
  const inputNoteTitle = document.getElementById('input-note-title');
  const textareaNoteContent = document.getElementById('textarea-note-content');
  const modalNoteTitle = document.getElementById('modal-note-title');
  const btnNewNote = document.getElementById('btn-new-note');
  const btnCloseNote = document.getElementById('btn-close-note');
  const btnTransferNote = document.getElementById('btn-transfer-note');

  /* ---- Dictée vocale dans la modale de note ---- */
  const btnNoteMic = document.getElementById('btn-note-mic');
  const noteSpeechStatus = document.getElementById('note-speech-status');

  function setNoteSpeechStatus(message, tone = '') {
    noteSpeechStatus.textContent = message || '';
    if (tone) noteSpeechStatus.dataset.tone = tone;
    else delete noteSpeechStatus.dataset.tone;
  }

  let noteBaseText = '';
  let noteSpeechEndedByError = false;

  const noteSpeech = new Speech.SpeechController({
    onStart() {
      noteBaseText = textareaNoteContent.value;
      btnNoteMic.classList.add('is-listening');
      btnNoteMic.setAttribute('aria-pressed', 'true');
      btnNoteMic.setAttribute('aria-label', 'Arrêter la dictée vocale');
      noteSpeechEndedByError = false;
      setNoteSpeechStatus('Écoute en cours… parlez normalement.', 'ok');
    },
    onInterim(text) {
      textareaNoteContent.value = joinText(noteBaseText, text);
    },
    onFinal(text) {
      noteBaseText = joinText(noteBaseText, text);
      textareaNoteContent.value = noteBaseText;
    },
    onError(message) {
      noteSpeechEndedByError = true;
      setNoteSpeechStatus(message, 'error');
      btnNoteMic.classList.remove('is-listening');
      btnNoteMic.setAttribute('aria-pressed', 'false');
      btnNoteMic.setAttribute('aria-label', 'Démarrer la dictée vocale');
    },
    onEnd() {
      btnNoteMic.classList.remove('is-listening');
      btnNoteMic.setAttribute('aria-pressed', 'false');
      btnNoteMic.setAttribute('aria-label', 'Démarrer la dictée vocale');
      if (!noteSpeechEndedByError) {
        setNoteSpeechStatus('Dictée arrêtée.', '');
      }
    },
  });

  if (!Speech.isSupported) {
    btnNoteMic.disabled = true;
  }

  btnNoteMic.addEventListener('click', () => {
    if (btnNoteMic.classList.contains('is-listening')) {
      noteSpeech.stop();
    } else {
      noteSpeech.start();
    }
  });

  function resetNoteMic() {
    noteSpeech.stop();
    btnNoteMic.classList.remove('is-listening');
    btnNoteMic.setAttribute('aria-pressed', 'false');
    setNoteSpeechStatus('');
  }

  async function renderNotesList() {
    const notes = await Notes.getAll();
    Notes.renderList(notes, {
      onEdit: openNoteModal,
      onDelete: handleDeleteNote,
      onTransfer: (note) => transferToReport(note.content),
      onFileToClient: (note) => {
        openClientPicker(async (client) => {
          try {
            await Notes.moveToClient(note.id, client.id);
            UI.toast(`Note rangée dans le dossier de ${Clients.fullName(client)}.`, 'success');
            renderNotesList();
          } catch (err) {
            UI.toast("Impossible d'enregistrer dans le dossier client.", 'error');
          }
        });
      },
    });
  }

  function openNoteModal(note) {
    resetNoteMic();
    inputNoteId.value = note ? note.id : '';
    inputNoteTitle.value = note ? note.title : '';
    textareaNoteContent.value = note ? note.content : '';
    modalNoteTitle.textContent = note ? 'Modifier la note' : 'Nouvelle note';
    UI.openModal(modalNote);
  }

  btnNewNote.addEventListener('click', () => openNoteModal(null));
  btnCloseNote.addEventListener('click', () => { resetNoteMic(); UI.closeModal(modalNote); });
  modalNote.addEventListener('click', (e) => { if (e.target === modalNote) { resetNoteMic(); UI.closeModal(modalNote); } });

  formNote.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = inputNoteId.value;
    const payload = { title: inputNoteTitle.value, content: textareaNoteContent.value };
    if (!payload.content.trim()) {
      UI.toast('Le contenu de la note est vide.', 'error');
      return;
    }
    try {
      if (id) {
        await Notes.update(id, payload);
        UI.toast('Note mise à jour.', 'success');
      } else {
        await Notes.create(payload);
        UI.toast('Note créée.', 'success');
      }
      UI.closeModal(modalNote);
      renderNotesList();
    } catch (err) {
      UI.toast("Échec de l'enregistrement de la note.", 'error');
    }
  });

  async function handleDeleteNote(note) {
    const ok = await UI.confirm(`Supprimer la note « ${note.title} » ? Cette action est irréversible.`, { okLabel: 'Supprimer' });
    if (!ok) return;
    await Notes.remove(note.id);
    renderNotesList();
    UI.toast('Note supprimée.', 'success');
  }

  function transferToReport(content) {
    textareaReport.value = joinText(textareaReport.value, content);
    UI.closeModal(modalNote);
    switchView('compte-rendu');
    UI.toast('Contenu transféré vers le compte-rendu.', 'success');
  }

  btnTransferNote.addEventListener('click', () => {
    if (!textareaNoteContent.value.trim()) {
      UI.toast('Rien à transférer.', 'error');
      return;
    }
    transferToReport(textareaNoteContent.value);
  });

  /* ============ Sélecteur de client (ranger un compte-rendu ou une note) ============ */
  const modalClientPicker = document.getElementById('modal-client-picker');
  const inputClientPickerSearch = document.getElementById('input-client-picker-search');
  const clientPickerListEl = document.getElementById('client-picker-list');
  const clientPickerEmptyEl = document.getElementById('client-picker-empty');
  const btnCloseClientPicker = document.getElementById('btn-close-client-picker');

  let clientPickerOnSelect = null;
  let clientPickerCache = [];

  function renderClientPickerItems(clients) {
    clientPickerListEl.innerHTML = '';
    if (clients.length === 0) {
      clientPickerEmptyEl.hidden = false;
      return;
    }
    clientPickerEmptyEl.hidden = true;
    clients.forEach((client) => {
      const li = document.createElement('li');
      li.className = 'list-card list-card--pickable';
      li.innerHTML = `<h3 class="list-card__title"></h3>`;
      li.querySelector('.list-card__title').textContent = Clients.fullName(client);
      li.addEventListener('click', () => {
        UI.closeModal(modalClientPicker);
        if (clientPickerOnSelect) clientPickerOnSelect(client);
      });
      clientPickerListEl.appendChild(li);
    });
  }

  async function openClientPicker(onSelect) {
    clientPickerOnSelect = onSelect;
    inputClientPickerSearch.value = '';
    UI.openModal(modalClientPicker);
    clientPickerCache = await Clients.getAll();
    if (clientPickerCache.length === 0) {
      UI.toast('Créez d’abord une fiche client dans l’onglet Clients.', 'error');
    }
    renderClientPickerItems(clientPickerCache);
  }

  inputClientPickerSearch.addEventListener('input', () => {
    const q = inputClientPickerSearch.value.trim().toLowerCase();
    const filtered = q
      ? clientPickerCache.filter((c) => Clients.fullName(c).toLowerCase().includes(q))
      : clientPickerCache;
    renderClientPickerItems(filtered);
  });

  btnCloseClientPicker.addEventListener('click', () => UI.closeModal(modalClientPicker));
  modalClientPicker.addEventListener('click', (e) => { if (e.target === modalClientPicker) UI.closeModal(modalClientPicker); });

  /* ============ Fiches client ============ */
  const clientsListEl = document.getElementById('clients-list');
  const clientsEmptyEl = document.getElementById('clients-empty');
  const inputClientSearch = document.getElementById('input-client-search');
  const btnNewClient = document.getElementById('btn-new-client');

  const modalClient = document.getElementById('modal-client');
  const modalClientTitle = document.getElementById('modal-client-title');
  const formClient = document.getElementById('form-client');
  const inputClientId = document.getElementById('input-client-id');
  const inputClientFirstName = document.getElementById('input-client-first-name');
  const inputClientLastName = document.getElementById('input-client-last-name');
  const inputClientAddress = document.getElementById('input-client-address');
  const inputClientContact = document.getElementById('input-client-contact');
  const inputClientQuickNote = document.getElementById('input-client-quick-note');
  const clientHistoryEl = document.getElementById('client-history');
  const clientReportsListEl = document.getElementById('client-reports-list');
  const clientReportsEmptyEl = document.getElementById('client-reports-empty');
  const clientNotesListEl = document.getElementById('client-notes-list');
  const clientNotesEmptyEl = document.getElementById('client-notes-empty');
  const btnCloseClient = document.getElementById('btn-close-client');
  const btnDeleteClient = document.getElementById('btn-delete-client');

  let clientsCache = [];

  async function renderClientsList() {
    clientsCache = await Clients.getAll();
    applyClientSearchFilter();
  }

  function applyClientSearchFilter() {
    const q = inputClientSearch.value.trim().toLowerCase();
    const filtered = q
      ? clientsCache.filter(
          (c) => Clients.fullName(c).toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q)
        )
      : clientsCache;
    renderClientsListItems(filtered);
  }

  function renderClientsListItems(clients) {
    clientsListEl.innerHTML = '';
    if (clients.length === 0) {
      clientsEmptyEl.hidden = false;
      return;
    }
    clientsEmptyEl.hidden = true;
    clients.forEach((client) => {
      const li = document.createElement('li');
      li.className = 'list-card';
      li.innerHTML = `
        <h3 class="list-card__title"></h3>
        <p class="list-card__excerpt"></p>
        <div class="list-card__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-action="open">Ouvrir</button>
        </div>
      `;
      li.querySelector('.list-card__title').textContent = Clients.fullName(client);
      li.querySelector('.list-card__excerpt').textContent = client.address || client.contact_info || '';
      li.querySelector('[data-action="open"]').addEventListener('click', () => openClientModal(client));
      clientsListEl.appendChild(li);
    });
  }

  inputClientSearch.addEventListener('input', applyClientSearchFilter);
  btnNewClient.addEventListener('click', () => openClientModal(null));

  async function renderClientHistory(clientId) {
    const [reports, notes] = await Promise.all([Clients.getReports(clientId), Clients.getNotes(clientId)]);

    clientReportsListEl.innerHTML = '';
    if (reports.length === 0) {
      clientReportsEmptyEl.hidden = false;
    } else {
      clientReportsEmptyEl.hidden = true;
      reports.forEach((report) => {
        const li = document.createElement('li');
        li.className = 'list-card';
        li.innerHTML = `
          <p class="list-card__excerpt"></p>
          <span class="list-card__meta"></span>
          <div class="list-card__actions">
            <button type="button" class="btn btn--ghost btn--sm" data-action="download">Télécharger</button>
          </div>
        `;
        li.querySelector('.list-card__excerpt').textContent = report.content;
        li.querySelector('.list-card__meta').textContent = `Exporté le ${formatReportDate(new Date(report.created_at).getTime())}`;
        li.querySelector('[data-action="download"]').addEventListener('click', () => {
          try {
            PDF.exportReport({ patientName: report.patient_name, content: report.content, profile: Storage.getProfile() });
          } catch (err) {
            console.error(err);
            UI.toast("Échec de l'export PDF.", 'error');
          }
        });
        clientReportsListEl.appendChild(li);
      });
    }

    clientNotesListEl.innerHTML = '';
    if (notes.length === 0) {
      clientNotesEmptyEl.hidden = false;
    } else {
      clientNotesEmptyEl.hidden = true;
      notes.forEach((note) => {
        const li = document.createElement('li');
        li.className = 'list-card';
        li.innerHTML = `
          <h3 class="list-card__title"></h3>
          <p class="list-card__excerpt"></p>
          <span class="list-card__meta"></span>
        `;
        li.querySelector('.list-card__title').textContent = note.title;
        li.querySelector('.list-card__excerpt').textContent = note.content;
        li.querySelector('.list-card__meta').textContent = `Modifiée le ${Notes.formatDate(note.updated_at)}`;
        clientNotesListEl.appendChild(li);
      });
    }
  }

  async function openClientModal(client) {
    inputClientId.value = client ? client.id : '';
    inputClientFirstName.value = (client && client.first_name) || '';
    inputClientLastName.value = (client && client.last_name) || '';
    inputClientAddress.value = (client && client.address) || '';
    inputClientContact.value = (client && client.contact_info) || '';
    inputClientQuickNote.value = (client && client.quick_note) || '';
    modalClientTitle.textContent = client ? Clients.fullName(client) : 'Nouveau client';
    btnDeleteClient.hidden = !client;
    clientHistoryEl.hidden = !client;
    UI.openModal(modalClient);
    if (client) await renderClientHistory(client.id);
  }

  btnCloseClient.addEventListener('click', () => UI.closeModal(modalClient));
  modalClient.addEventListener('click', (e) => { if (e.target === modalClient) UI.closeModal(modalClient); });

  formClient.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = inputClientId.value;
    const fields = {
      firstName: inputClientFirstName.value,
      lastName: inputClientLastName.value,
      address: inputClientAddress.value,
      contactInfo: inputClientContact.value,
      quickNote: inputClientQuickNote.value,
    };
    try {
      if (id) {
        await Clients.update(id, fields);
        UI.toast('Client mis à jour.', 'success');
      } else {
        await Clients.create(fields);
        UI.toast('Client créé.', 'success');
      }
      UI.closeModal(modalClient);
      renderClientsList();
    } catch (err) {
      UI.toast("Impossible d'enregistrer ce client.", 'error');
    }
  });

  btnDeleteClient.addEventListener('click', async () => {
    const id = inputClientId.value;
    if (!id) return;
    const ok = await UI.confirm('Supprimer cette fiche client ? Cette action est irréversible.', { okLabel: 'Supprimer' });
    if (!ok) return;
    try {
      await Clients.remove(id);
      UI.closeModal(modalClient);
      renderClientsList();
      UI.toast('Client supprimé.', 'success');
    } catch (err) {
      UI.toast('Échec de la suppression.', 'error');
    }
  });

  /* ============ Initialisation ============ */
  restoreDraftPrompt();
  renderReportsList();
  switchView('compte-rendu');
});
