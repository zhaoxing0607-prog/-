(() => {
  const MAX_SIZE = 10 * 1024 * 1024;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const formatSize = bytes => {
    const size = Number(bytes) || 0;
    return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(size / 1024))} Ko`;
  };

  const baseRepairDashboard = repairDashboard;
  repairDashboard = () => {
    const repair = data.repairs.find(item => item.id === selectedRepairId);
    const html = baseRepairDashboard();
    if (!repair) return html;
    const document = repair.document?.path ? repair.document : null;
    const actions = canEdit() ? `<button type="button" class="primary repair-document-add" data-add-repair-document="${repair.id}">${document ? '↻ Remplacer le PDF' : '＋ Ajouter un PDF'}</button>` : '';
    const content = document ? `<div class="repair-document-file"><div class="repair-document-icon">PDF</div><div><b>${escapeHtml(document.name || 'Document associé.pdf')}</b><span>${formatSize(document.size)}</span></div><div class="repair-document-actions"><button type="button" data-open-repair-document="${escapeHtml(document.path)}">Ouvrir / télécharger</button>${canEdit() ? `<button type="button" class="danger" data-delete-repair-document="${escapeHtml(document.path)}">Supprimer</button>` : ''}</div></div>` : '<div class="empty">Aucun document PDF associé à cette panne.</div>';
    return `${html}<section class="card repair-document-card"><div class="card-head"><div><span class="section-kicker">DOCUMENT ASSOCIÉ</span><h3>Fichier PDF de la panne</h3><span class="sub">Plan, rapport, devis ou document technique</span></div>${actions}</div>${content}</section>`;
  };

  document.body.insertAdjacentHTML('beforeend', '<input type="file" id="repairDocumentInput" accept="application/pdf,.pdf" hidden>');
  const input = document.querySelector('#repairDocumentInput');
  let targetRepairId = '';

  document.addEventListener('click', async event => {
    const add = event.target.closest('[data-add-repair-document]');
    if (add) {
      if (!canEdit()) return;
      targetRepairId = add.dataset.addRepairDocument;
      input.value = '';
      input.click();
      return;
    }
    const open = event.target.closest('[data-open-repair-document]');
    if (open) {
      const popup = window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
      open.disabled = true;
      try {
        const url = await window.MoldCloud.panneDocumentUrl(open.dataset.openRepairDocument);
        if (!url) throw new Error('Document introuvable');
        if (popup) popup.location.replace(url);
        else window.location.href = url;
      } catch (error) {
        popup?.close();
        toast(error.message || 'Impossible d’ouvrir le document');
      } finally {
        open.disabled = false;
      }
      return;
    }
    const remove = event.target.closest('[data-delete-repair-document]');
    if (!remove || !canEdit()) return;
    const repair = data.repairs.find(item => item.id === selectedRepairId);
    if (!repair?.document?.path || !confirm('Supprimer définitivement le document PDF associé ?')) return;
    remove.disabled = true;
    try {
      await window.MoldCloud.removePanneDocument(repair.document.path);
      delete repair.document;
      save();
      render();
      toast('Document PDF supprimé');
    } catch (error) {
      remove.disabled = false;
      toast(error.message || 'Impossible de supprimer le document');
    }
  });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    const repair = data.repairs.find(item => item.id === (targetRepairId || selectedRepairId));
    if (!file || !repair || !canEdit()) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast('Sélectionnez uniquement un fichier PDF');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast('Le PDF dépasse la limite de 10 Mo');
      return;
    }
    const previous = repair.document?.path || '';
    const button = document.querySelector(`[data-add-repair-document="${CSS.escape(repair.id)}"]`);
    const label = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'Envoi du PDF…';
    }
    try {
      const uploaded = await window.MoldCloud.uploadPanneDocument(repair.id, file);
      repair.document = uploaded;
      save();
      render();
      toast('Document PDF ajouté');
      if (previous) window.MoldCloud.removePanneDocument(previous).catch(() => null);
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = label;
      }
      toast(error.message || 'Impossible d’envoyer le document');
    }
  });
})();
