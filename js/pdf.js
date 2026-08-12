/* Génération du compte-rendu en PDF (jsPDF, format A4) — mise en page moderne aux couleurs de Dictavoix */
const PDF = (() => {
  const PAGE_WIDTH = 210;
  const PAGE_HEIGHT = 297;
  const MARGIN = 18; // mm, marge de contenu (hors bandeau d'en-tête)
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  const COLOR = {
    teal900: [11, 61, 60],
    teal800: [15, 76, 75],
    teal700: [19, 94, 92],
    teal100: [226, 239, 238],
    amber600: [201, 122, 43],
    amber500: [217, 142, 63],
    amber100: [251, 234, 214],
    text: [27, 43, 42],
    textMuted: [92, 107, 106],
    border: [221, 216, 204],
    white: [255, 255, 255],
  };

  const ACCENT_HEIGHT = 2.6;
  const CONTINUATION_HEIGHT = 16;
  const CONTINUATION_ACCENT = 1.6;
  const FOOTER_Y = PAGE_HEIGHT - 14;

  function formatDate(date) {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function setFill(doc, color) { doc.setFillColor(color[0], color[1], color[2]); }
  function setText(doc, color) { doc.setTextColor(color[0], color[1], color[2]); }
  function setDraw(doc, color) { doc.setDrawColor(color[0], color[1], color[2]); }

  /* Largeur totale d'un texte espacé lettre par lettre (police/taille déjà réglées sur doc) */
  function spacedTextWidth(doc, text, spacing) {
    const widths = text.split('').map((c) => doc.getTextWidth(c));
    return widths.reduce((sum, w) => sum + w + spacing, -spacing);
  }

  /* Texte avec espacement entre lettres, pour imiter les petites capitales "design" */
  function textSpaced(doc, text, x, y, { spacing = 0.6, align = 'left' } = {}) {
    const chars = text.split('');
    const widths = chars.map((c) => doc.getTextWidth(c));
    const totalWidth = widths.reduce((sum, w) => sum + w + spacing, -spacing);
    let cursor = align === 'right' ? x - totalWidth : x;
    chars.forEach((c, i) => {
      doc.text(c, cursor, y);
      cursor += widths[i] + spacing;
    });
  }

  function drawLogoBadge(doc, profile, x, y, size, bgColor) {
    if (!profile || !profile.logo) return false;
    setFill(doc, COLOR.white);
    doc.roundedRect(x, y, size, size, size * 0.16, size * 0.16, 'F');
    try {
      const format = profile.logo.includes('image/png') ? 'PNG' : 'JPEG';
      const pad = size * 0.12;
      doc.addImage(profile.logo, format, x + pad, y + pad, size - pad * 2, size - pad * 2, undefined, 'FAST');
      return true;
    } catch (err) {
      console.warn('Logo illisible, en-tête sans logo.', err);
      // Efface le badge blanc déjà peint pour ne pas laisser de trace derrière le texte
      setFill(doc, bgColor);
      doc.rect(x - 1, y - 1, size + 2, size + 2, 'F');
      return false;
    }
  }

  /* En-tête façon lettre à en-tête : logo + nom + coordonnées du praticien à gauche. */
  function drawHeroHeader(doc, profile) {
    const hasLogo = !!(profile && profile.logo);
    const hasName = !!(profile && profile.name && profile.name.trim());
    const hasContact = !!(profile && profile.contact && profile.contact.trim());

    const logoSize = 24;
    const leftTextX = hasLogo ? MARGIN + logoSize + 8 : MARGIN;
    const textMaxWidth = PAGE_WIDTH - MARGIN - leftTextX;

    let contactLines = [];
    if (hasContact) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      contactLines = doc.splitTextToSize(profile.contact.trim(), textMaxWidth).slice(0, 3);
    }

    const heroHeight = Math.max(34, 20 + 9 + contactLines.length * 4.6);

    /* En-tête clair : un simple bandeau de couleur en haut plutôt qu'un grand
       aplat sombre, pour rester léger à l'impression (couleur ou N&B). */
    setFill(doc, COLOR.amber500);
    doc.rect(0, 0, PAGE_WIDTH, ACCENT_HEIGHT, 'F');
    setDraw(doc, COLOR.border);
    doc.setLineWidth(0.3);
    doc.line(0, heroHeight, PAGE_WIDTH, heroHeight);

    if (hasLogo) {
      const logoY = (heroHeight - logoSize) / 2;
      drawLogoBadge(doc, profile, MARGIN, logoY, logoSize, COLOR.white);
    }

    let textY = 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    setText(doc, COLOR.teal900);
    doc.text(hasName ? profile.name.trim() : 'Informations', leftTextX, textY, { maxWidth: textMaxWidth });

    if (contactLines.length) {
      textY += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setText(doc, COLOR.textMuted);
      contactLines.forEach((line) => {
        doc.text(line, leftTextX, textY);
        textY += 4.6;
      });
    }

    return heroHeight;
  }

  function drawContinuationHeader(doc, profile) {
    setFill(doc, COLOR.amber500);
    doc.rect(0, 0, PAGE_WIDTH, CONTINUATION_ACCENT, 'F');
    setDraw(doc, COLOR.border);
    doc.setLineWidth(0.3);
    doc.line(0, CONTINUATION_HEIGHT, PAGE_WIDTH, CONTINUATION_HEIGHT);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    setText(doc, COLOR.teal900);
    doc.text((profile && profile.name) || 'Informations', MARGIN, CONTINUATION_HEIGHT / 2 + 3.2);
  }

  function drawMetaCard(doc, x, y, w, h, label, value) {
    setFill(doc, COLOR.teal100);
    doc.roundedRect(x, y, w, h, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setText(doc, COLOR.amber600);
    textSpaced(doc, label, x + 7, y + 8.5, { spacing: 0.8 });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    setText(doc, COLOR.teal900);
    const maxWidth = w - 14;
    const valueLines = doc.splitTextToSize(value, maxWidth).slice(0, 1);
    doc.text(valueLines, x + 7, y + 17);
  }

  function drawSectionTag(doc, x, y, label) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const spacing = 0.9;
    const padX = 5;
    const tagWidth = spacedTextWidth(doc, label, spacing) + padX * 2;
    setFill(doc, COLOR.amber500);
    doc.roundedRect(x, y - 5.6, tagWidth, 8, 4, 4, 'F');
    setText(doc, COLOR.white);
    textSpaced(doc, label, x + padX, y, { spacing });
    return tagWidth;
  }

  function drawFooter(doc, profile, pageNumber, totalPages) {
    setDraw(doc, COLOR.border);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, FOOTER_Y, PAGE_WIDTH - MARGIN, FOOTER_Y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(doc, COLOR.textMuted);
    doc.text('Généré avec Dictavoix', MARGIN, FOOTER_Y + 6);
    doc.text(`Page ${pageNumber} / ${totalPages}`, PAGE_WIDTH - MARGIN, FOOTER_Y + 6, { align: 'right' });
  }

  function fileNameFor(patientName) {
    const safePatient = (patientName || 'patient').trim().replace(/\s+/g, '-').toLowerCase() || 'patient';
    return `${safePatient}_compte-rendu_${new Date().toISOString().slice(0, 10)}.pdf`;
  }

  function photoFormat(dataUrl) {
    const match = /^data:image\/(png|jpe?g)/i.exec(dataUrl || '');
    if (!match) return null;
    return match[1].toLowerCase() === 'png' ? 'PNG' : 'JPEG';
  }

  /* Construit le document jsPDF sans l'enregistrer (pour prévisualisation) */
  function buildDoc({ patientName, content, profile, photos }) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('La bibliothèque jsPDF est introuvable.');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const heroHeight = drawHeroHeader(doc, profile);

    let cursorY = heroHeight + 16;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    setText(doc, COLOR.teal900);
    doc.text('Informations', MARGIN, cursorY);
    setFill(doc, COLOR.amber500);
    doc.roundedRect(MARGIN, cursorY + 3, 26, 1.4, 0.7, 0.7, 'F');

    cursorY += 16;

    const cardHeight = 22;
    const cardGap = 6;
    const cardWidth = (CONTENT_WIDTH - cardGap) / 2;
    drawMetaCard(doc, MARGIN, cursorY, cardWidth, cardHeight, 'NOM ET PRÉNOM', patientName && patientName.trim() ? patientName.trim() : 'Non renseigné');
    drawMetaCard(doc, MARGIN + cardWidth + cardGap, cursorY, cardWidth, cardHeight, 'DATE', formatDate(new Date()));

    cursorY += cardHeight + 16;

    drawSectionTag(doc, MARGIN, cursorY, 'COMPTE-RENDU');
    cursorY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11.5);
    setText(doc, COLOR.text);

    const bodyText = content && content.trim() ? content.trim() : '(Aucun contenu)';
    const lines = doc.splitTextToSize(bodyText, CONTENT_WIDTH);
    const lineHeight = 6.4;
    const bottomLimit = FOOTER_Y - 6;

    lines.forEach((line) => {
      if (cursorY + lineHeight > bottomLimit) {
        doc.addPage();
        drawContinuationHeader(doc, profile);
        cursorY = CONTINUATION_HEIGHT + 14;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11.5);
        setText(doc, COLOR.text);
      }
      doc.text(line, MARGIN, cursorY);
      cursorY += lineHeight;
    });

    const photoList = (photos || []).filter((p) => p && p.dataUrl);
    photoList.forEach((entry, index) => {
      const format = photoFormat(entry.dataUrl);
      if (!format) return;
      try {
        const props = doc.getImageProperties(entry.dataUrl);
        let imgWidth = CONTENT_WIDTH;
        let imgHeight = (imgWidth * props.height) / props.width;
        const maxHeight = 110;
        if (imgHeight > maxHeight) {
          imgHeight = maxHeight;
          imgWidth = (imgHeight * props.width) / props.height;
        }
        if (cursorY + 10 + imgHeight > bottomLimit) {
          doc.addPage();
          drawContinuationHeader(doc, profile);
          cursorY = CONTINUATION_HEIGHT + 14;
        } else {
          cursorY += 4;
        }
        const label = (entry.label || '').trim();
        const tag = label ? label.toUpperCase() : (photoList.length > 1 ? `PHOTO ${index + 1}/${photoList.length}` : 'PHOTO');
        drawSectionTag(doc, MARGIN, cursorY, tag);
        cursorY += 10;
        doc.addImage(entry.dataUrl, format, MARGIN, cursorY, imgWidth, imgHeight);
        cursorY += imgHeight;
      } catch (err) {
        console.warn('Photo illisible, ignorée dans le PDF.', err);
      }
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(doc, profile, i, totalPages);
    }

    return { doc, fileName: fileNameFor(patientName) };
  }

  /* Déclenche un vrai téléchargement via un lien <a download>, plutôt que
     doc.save() ou l'ouverture d'un nouvel onglet (peu fiables en PWA iOS :
     page blanche, ou navigation qui fait quitter l'application). */
  function savePdfFile(doc, fileName) {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* Partage natif du fichier PDF (feuille de partage iOS/Android) plutôt que de
     passer par le visualiseur PDF de Safari puis son propre bouton de partage :
     ce dernier partage parfois le PDF comme une page web (avec son adresse
     https en plus dans le mail) au lieu du fichier lui-même. En donnant
     directement un vrai fichier à l'OS via l'API de partage native, l'email
     ne contient que la pièce jointe. Retombe sur le téléchargement classique
     si le partage natif de fichiers n'est pas disponible (ordinateur, ou
     navigateur qui ne le prend pas en charge) ou si l'utilisateur annule.
     Retourne true si le partage natif a été utilisé, false sinon. */
  async function sharePdfFile(doc, fileName) {
    if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && typeof File !== 'undefined') {
      const blob = doc.output('blob');
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return true;
        } catch (err) {
          if (err && err.name === 'AbortError') return true; // l'utilisateur a annulé le partage, rien d'autre à faire
          console.warn('Partage natif indisponible, téléchargement classique utilisé.', err);
        }
      }
    }
    savePdfFile(doc, fileName);
    return false;
  }

  /* Construit puis enregistre directement (téléchargement immédiat, sans prévisualisation) */
  function exportReport(params) {
    const { doc, fileName } = buildDoc(params);
    savePdfFile(doc, fileName);
  }

  /* Construit puis partage directement (partage natif, avec repli sur le téléchargement) */
  function shareReport(params) {
    const { doc, fileName } = buildDoc(params);
    return sharePdfFile(doc, fileName);
  }

  return { buildDoc, exportReport, shareReport, savePdfFile, sharePdfFile };
})();
