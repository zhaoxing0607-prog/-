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
  const ticketAttachments = ticket => {
    if (Array.isArray(ticket?.attachments)) return ticket.attachments;
    const components = Array.isArray(ticket?.components) ? ticket.components : [];
    return Array.isArray(components[0]?.attachments) ? components[0].attachments : [];
  };
  window.getAchatTicketAttachments = ticketAttachments;

  function attachmentButtons(files, compact = false) {
    if (!files.length) return '';
    return `<div class="achat-attachment-links ${compact ? 'compact' : ''}">${files.map(file => `<button type="button" class="achat-attachment-link" data-open-achat-attachment="${escapeHtml(file.path)}" title="${escapeHtml(file.name)}"><span>${fileIcon(file)}</span>${escapeHtml(file.name || 'Fichier')}</button>`).join('')}</div>`;
  }
  window.renderAchatTicketAttachments = ticket => attachmentButtons(ticketAttachments(ticket), true);

  function renderEditor(form) {
    const editor = form.querySelector('.achat-attachment-editor');
    if (!editor) return;
    const retained = (form._achatAttachmentOriginal || []).filter(file => !form._achatAttachmentRemoved.has(file.path));
    const existing = retained.map(file => `<div class="achat-attachment-item"><span class="achat-file-icon">${fileIcon(file)}</span><div><b>${escapeHtml(file.name || 'Fichier')}</b><small>${formatSize(file.size)}</small></div><button type="button" data-remove-existing-achat-attachment="${escapeHtml(file.path)}">Retirer</button></div>`);
    const pending = (form._achatAttachmentPending || []).map((file, index) => `<div class="achat-attachment-item pending"><span class="achat-file-icon">${fileIcon(file)}</span><div><b>${escapeHtml(file.name)}</b><small>${formatSize(file.size)} · prêt à envoyer</small></div><button type="button" data-remove-new-achat-attachment="${index}">Retirer</button></div>`);
    editor.innerHTML = [...existing, ...pending].join('') || '<div class="photo-empty">Aucun fichier joint.</div>';
    const count = form.querySelector('.achat-attachment-count');
    if (count) count.textContent = `${retained.length + pending.length} / ${MAX_FILES}`;
  }

  function installEditor(form, attachments, kind) {
    form.querySelector('.achat-attachment-field')?.remove();
    form._achatAttachmentOriginal = Array.isArray(attachments) ? attachments : [];
    form._achatAttachmentRemoved = new Set();
    form._achatAttachmentPending = [];
    form._achatAttachmentPrepared = false;
    form._achatAttachmentKind = kind;
    const hiddenName = kind === 'purchase' ? 'purchaseAttachmentData' : 'achatTicketAttachmentData';
    const field = `<div class="field full achat-attachment-field"><div class="achat-attachment-label"><label>Pièces jointes <span class="optional-label">(facultatif)</span></label><span class="achat-attachment-count">0 / ${MAX_FILES}</span></div><div class="achat-attachment-editor"></div><input class="achat-attachment-input" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"><small>Images, PDF, Word, Excel, texte ou ZIP · ${MAX_FILES} fichiers maximum · 10 Mo par fichier.</small><input type="hidden" name="${hiddenName}" value="[]"><div class="ticket-form-error achat-attachment-error" role="alert"></div></div>`;
    if (kind === 'purchase') document.querySelector('#formFields')?.insertAdjacentHTML('beforeend', field);
    else form.querySelector('.ticket-form-error')?.insertAdjacentHTML('beforebegin', field);
    renderEditor(form);
  }

  const baseOpenModal = openModal;
  openModal = (type, record = null) => {
    baseOpenModal(type, record);
    if (type === 'purchases') installEditor(document.querySelector('#entityForm'), record?.attachments || [], 'purchase');
  };

  const baseOpenAchatTicketModal = openAchatTicketModal;
  openAchatTicketModal = (ticket = null) => {
    baseOpenAchatTicketModal(ticket);
    installEditor(document.querySelector('#achatTicketForm'), ticketAttachments(ticket), 'ticket');
  };

  document.addEventListener('change', event => {
    const input = event.target.closest('.achat-attachment-input');
    if (!input) return;
    const form = input.closest('form');
    const incoming = [...input.files];
    const retainedCount = (form._achatAttachmentOriginal || []).filter(file => !form._achatAttachmentRemoved.has(file.path)).length;
    const error = form.querySelector('.achat-attachment-error');
    error.classList.remove('visible');
    if (retainedCount + form._achatAttachmentPending.length + incoming.length > MAX_FILES) {
      error.textContent = `Maximum ${MAX_FILES} fichiers par achat ou ticket.`;
      error.classList.add('visible');
    } else if (incoming.some(file => file.size > MAX_SIZE)) {
      error.textContent = 'Chaque fichier doit faire au maximum 10 Mo.';
      error.classList.add('visible');
    } else if (incoming.some(file => !acceptedExtensions.test(file.name))) {
      error.textContent = 'Format non accepté. Utilisez une image, un PDF, Word, Excel, TXT, CSV ou ZIP.';
      error.classList.add('visible');
    } else {
      form._achatAttachmentPending.push(...incoming);
      renderEditor(form);
    }
    input.value = '';
  });

  document.addEventListener('click', async event => {
    const removeExisting = event.target.closest('[data-remove-existing-achat-attachment]');
    if (removeExisting) {
      const form = removeExisting.closest('form');
      form._achatAttachmentRemoved.add(removeExisting.dataset.removeExistingAchatAttachment);
      renderEditor(form);
      return;
    }
    const removeNew = event.target.closest('[data-remove-new-achat-attachment]');
    if (removeNew) {
      const form = removeNew.closest('form');
      form._achatAttachmentPending.splice(Number(removeNew.dataset.removeNewAchatAttachment), 1);
      renderEditor(form);
      return;
    }
    const open = event.target.closest('[data-open-achat-attachment]');
    if (open) {
      const popup = window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
      open.disabled = true;
      try {
        const url = await window.MoldCloud.achatAttachmentUrl(open.dataset.openAchatAttachment);
        if (!url) throw new Error('Fichier introuvable');
        if (popup) popup.location.replace(url);
        else window.location.href = url;
      } catch (error) {
        popup?.close();
        toast(error.message || 'Impossible d’ouvrir le fichier');
      } finally {
        open.disabled = false;
      }
      return;
    }
    const removePurchase = event.target.closest('[data-delete-purchase-attachment]');
    if (removePurchase) {
      const purchase = data.purchases.find(item => item.id === selectedPurchaseId);
      const path = removePurchase.dataset.deletePurchaseAttachment;
      if (!purchase || !canEdit() || !confirm('Supprimer définitivement ce fichier ?')) return;
      removePurchase.disabled = true;
      try {
        await window.MoldCloud.removeAchatAttachment(path);
        purchase.attachments = (purchase.attachments || []).filter(file => file.path !== path);
        save();
        render();
        toast('Fichier supprimé');
      } catch (error) {
        removePurchase.disabled = false;
        toast(error.message || 'Impossible de supprimer le fichier');
      }
    }
  });

  async function prepareAttachments(event, form) {
    if (form._achatAttachmentPrepared || !form._achatAttachmentKind) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!canEdit() && form._achatAttachmentKind === 'purchase') return;
    const pending = form._achatAttachmentPending || [];
    const retained = (form._achatAttachmentOriginal || []).filter(file => !form._achatAttachmentRemoved.has(file.path));
    const submit = form.querySelector('[type="submit"]');
    const originalText = submit.textContent;
    const error = form.querySelector('.achat-attachment-error');
    submit.disabled = true;
    submit.textContent = pending.length ? 'Envoi des fichiers…' : 'Enregistrement…';
    error.classList.remove('visible');
    try {
      const owner = form._achatAttachmentKind === 'purchase'
        ? (form.dataset.editId || form.elements.namedItem('id')?.value || `achat-${Date.now()}`)
        : `ticket-${editingAchatTicketId || Date.now()}`;
      const uploaded = [];
      for (const file of pending) uploaded.push(await window.MoldCloud.uploadAchatAttachment(owner, file));
      const metadata = [...retained, ...uploaded];
      const hiddenName = form._achatAttachmentKind === 'purchase' ? 'purchaseAttachmentData' : 'achatTicketAttachmentData';
      form.elements.namedItem(hiddenName).value = JSON.stringify(metadata);
      form._achatAttachmentPrepared = true;
      submit.disabled = false;
      submit.textContent = originalText;
      form.requestSubmit();
    } catch (uploadError) {
      error.textContent = uploadError.message || 'Impossible d’envoyer les fichiers.';
      error.classList.add('visible');
      submit.disabled = false;
      submit.textContent = originalText;
    }
  }

  document.querySelector('#entityForm').addEventListener('submit', event => {
    if (event.currentTarget.dataset.type === 'purchases') prepareAttachments(event, event.currentTarget);
  }, true);
  document.querySelector('#achatTicketForm').addEventListener('submit', event => prepareAttachments(event, event.currentTarget), true);

  const basePurchaseDashboard = purchaseDashboard;
  purchaseDashboard = () => {
    const purchase = data.purchases.find(item => item.id === selectedPurchaseId);
    const html = basePurchaseDashboard();
    if (!purchase) return html;
    const files = Array.isArray(purchase.attachments) ? purchase.attachments : [];
    const content = files.length ? `<div class="achat-attachment-card-list">${files.map(file => `<div class="achat-attachment-file"><span class="achat-file-icon">${fileIcon(file)}</span><div><b>${escapeHtml(file.name || 'Fichier')}</b><small>${formatSize(file.size)}</small></div><button type="button" data-open-achat-attachment="${escapeHtml(file.path)}">Ouvrir / télécharger</button>${canEdit() ? `<button type="button" class="danger" data-delete-purchase-attachment="${escapeHtml(file.path)}">Supprimer</button>` : ''}</div>`).join('')}</div>` : '<div class="empty">Aucune pièce jointe associée à cet achat.</div>';
    return `${html}<section class="card achat-attachments-card"><div class="card-head"><div><span class="section-kicker">PIÈCES JOINTES</span><h3>Documents de l’achat</h3><span class="sub">Photos, plans, devis, PDF ou fichiers techniques</span></div>${canEdit() ? `<button type="button" class="primary" data-edit="${purchase.id}" data-type="purchases">＋ Ajouter des fichiers</button>` : ''}</div>${content}</section>`;
  };
})();
