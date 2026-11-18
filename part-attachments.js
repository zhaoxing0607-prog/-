(() => {
  const MAX_FILES = 5;
  const MAX_SIZE = 10 * 1024 * 1024;
  const acceptedExtensions = /\.(jpe?g|png|webp|pdf|docx?|xlsx?|txt|csv|zip)$/i;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const formatSize = bytes => {
    const size = Number(bytes) || 0;
    return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(size / 1024))} Ko`;
  };
  const fileIcon = file => {
    const type = String(file?.type || '').toLowerCase();
    const name = String(file?.name || '');
    if (type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(name)) return 'IMG';
    if (type.includes('pdf') || /\.pdf$/i.test(name)) return 'PDF';
    if (/\.docx?$/i.test(name)) return 'DOC';
    if (/\.xlsx?$/i.test(name)) return 'XLS';
    if (/\.zip$/i.test(name)) return 'ZIP';
    return 'FILE';
  };

  const basePartDashboard = partDashboard;
  partDashboard = () => {
    const part = data.parts.find(item => item.id === selectedPartId);
    const html = basePartDashboard();
    if (!part) return html;
    const documents = Array.isArray(part.documents) ? part.documents : [];
    const list = documents.length
      ? `<div class="achat-attachment-card-list">${documents.map(file => `<div class="achat-attachment-file"><span class="achat-file-icon">${fileIcon(file)}</span><div><b>${escapeHtml(file.name || 'Document')}</b><small>${formatSize(file.size)}</small></div><button type="button" data-open-part-document="${escapeHtml(file.path)}">${['IMG','PDF'].includes(fileIcon(file)) ? 'Lire dans la fenêtre' : 'Ouvrir / télécharger'}</button>${canEdit() ? `<button type="button" class="danger" data-delete-part-document="${escapeHtml(file.path)}">Supprimer</button>` : ''}</div>`).join('')}</div>`
      : '<div class="empty">Aucun document associé à cette pièce.</div>';
    return `${html}<section class="card achat-attachments-card part-documents-card"><div class="card-head"><div><span class="section-kicker">DOCUMENTS ASSOCIÉS</span><h3>Documents de la pièce</h3><span class="sub">Photos, plans, fiches techniques, PDF, Word, Excel ou ZIP</span></div>${canEdit() ? `<button type="button" class="primary" data-add-part-documents="${escapeHtml(part.id)}">＋ Ajouter des documents</button>` : ''}</div>${list}</section>`;
  };

  document.body.insertAdjacentHTML('beforeend', `<input type="file" id="partDocumentInput" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" hidden><div class="part-document-viewer" id="partDocumentViewer" aria-hidden="true"><section class="part-document-viewer-panel" role="dialog" aria-modal="true" aria-labelledby="partDocumentViewerTitle"><header><div><span class="section-kicker">LECTURE DU DOCUMENT</span><h3 id="partDocumentViewerTitle">Document associé</h3></div><div><a id="partDocumentViewerExternal" target="_blank" rel="noopener">Ouvrir dans un nouvel onglet</a><button type="button" data-close-part-document-viewer aria-label="Fermer">×</button></div></header><div class="part-document-viewer-content" id="partDocumentViewerContent"></div></section></div>`);
  const input = document.querySelector('#partDocumentInput');
  const viewer = document.querySelector('#partDocumentViewer');
  const viewerTitle = document.querySelector('#partDocumentViewerTitle');
  const viewerContent = document.querySelector('#partDocumentViewerContent');
  const viewerExternal = document.querySelector('#partDocumentViewerExternal');
  let targetPartId = '';

  const closeViewer = () => {
    viewer.classList.remove('open');
    viewer.setAttribute('aria-hidden', 'true');
    viewerContent.replaceChildren();
    viewerExternal.removeAttribute('href');
  };
  const showViewer = (url, file) => {
    viewerTitle.textContent = file.name || 'Document associé';
    viewerExternal.href = url;
    const icon = fileIcon(file);
    if (icon === 'IMG') {
      const image = document.createElement('img');
      image.src = url;
      image.alt = file.name || 'Image associée à la pièce';
      viewerContent.appendChild(image);
    } else {
      const frame = document.createElement('iframe');
      frame.src = url;
      frame.title = file.name || 'Document PDF associé';
      viewerContent.appendChild(frame);
    }
    viewer.classList.add('open');
    viewer.setAttribute('aria-hidden', 'false');
    viewer.querySelector('[data-close-part-document-viewer]').focus();
  };

  document.addEventListener('click', async event => {
    const add = event.target.closest('[data-add-part-documents]');
    if (add) {
      if (!canEdit()) return;
      targetPartId = add.dataset.addPartDocuments;
      input.value = '';
      input.click();
      return;
    }

    const open = event.target.closest('[data-open-part-document]');
    if (open) {
      const part = data.parts.find(item => item.id === selectedPartId);
      const file = (part?.documents || []).find(item => item.path === open.dataset.openPartDocument) || {path:open.dataset.openPartDocument, name:'Document'};
      const previewable = ['IMG', 'PDF'].includes(fileIcon(file));
      const popup = previewable ? null : window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
      open.disabled = true;
      try {
        const url = await window.MoldCloud.achatAttachmentUrl(open.dataset.openPartDocument);
        if (!url) throw new Error('Document introuvable');
        if (previewable) showViewer(url, file);
        else if (popup) popup.location.replace(url);
        else window.location.href = url;
      } catch (error) {
        popup?.close();
        toast(error.message || 'Impossible d’ouvrir le document');
      } finally {
        open.disabled = false;
      }
      return;
    }

    if (event.target.closest('[data-close-part-document-viewer]') || event.target === viewer) {
      closeViewer();
      return;
    }

    const remove = event.target.closest('[data-delete-part-document]');
    if (!remove || !canEdit()) return;
    const part = data.parts.find(item => item.id === selectedPartId);
    const path = remove.dataset.deletePartDocument;
    if (!part || !confirm('Supprimer définitivement ce document associé ?')) return;
    remove.disabled = true;
    try {
      await window.MoldCloud.removeAchatAttachment(path);
      part.documents = (part.documents || []).filter(file => file.path !== path);
      save();
      render();
      toast('Document supprimé');
    } catch (error) {
      remove.disabled = false;
      toast(error.message || 'Impossible de supprimer le document');
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && viewer.classList.contains('open')) closeViewer();
  });

  input.addEventListener('change', async () => {
    const files = [...(input.files || [])];
    const part = data.parts.find(item => item.id === (targetPartId || selectedPartId));
    if (!files.length || !part || !canEdit()) return;
    const existing = Array.isArray(part.documents) ? part.documents : [];
    if (existing.length + files.length > MAX_FILES) {
      toast(`Maximum ${MAX_FILES} documents associés par pièce`);
      return;
    }
    if (files.some(file => file.size > MAX_SIZE)) {
      toast('Chaque document doit faire au maximum 10 Mo');
      return;
    }
    if (files.some(file => !acceptedExtensions.test(file.name))) {
      toast('Format non accepté : utilisez image, PDF, Word, Excel, TXT, CSV ou ZIP');
      return;
    }

    const button = document.querySelector(`[data-add-part-documents="${CSS.escape(part.id)}"]`);
    const originalLabel = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'Envoi des documents…';
    }
    const uploaded = [];
    try {
      for (const file of files) uploaded.push(await window.MoldCloud.uploadAchatAttachment(`part-${part.id}`, file));
      part.documents = [...existing, ...uploaded];
      save();
      render();
      toast(`${uploaded.length} document${uploaded.length > 1 ? 's' : ''} ajouté${uploaded.length > 1 ? 's' : ''}`);
    } catch (error) {
      await Promise.all(uploaded.map(file => window.MoldCloud.removeAchatAttachment(file.path).catch(() => null)));
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
      toast(error.message || 'Impossible d’envoyer les documents');
    }
  });
})();
