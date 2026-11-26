(() => {
  const MAX_SIZE = 10 * 1024 * 1024;
  let invoiceLibraryOpen = false;
  const acceptedExtensions = /\.(pdf|jpe?g|png|webp)$/i;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const ensureInvoices = () => {
    data.invoices = Array.isArray(data.invoices) ? data.invoices : [];
    return data.invoices;
  };
  const formatSize = bytes => {
    const size = Number(bytes) || 0;
    return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(size / 1024))} Ko`;
  };
  const invoiceForPurchase = purchase => ensureInvoices().find(invoice => invoice.id === purchase?.invoiceFileId);
  const nextInvoiceId = () => {
    const highest = ensureInvoices().reduce((max, invoice) => {
      const number = Number(String(invoice.id || '').match(/\d+/)?.[0] || 0);
      return Math.max(max, number);
    }, 0);
    return `FAC-${String(highest + 1).padStart(4, '0')}`;
  };
  const assignedPurchases = invoiceId => data.purchases.filter(purchase => purchase.invoiceFileId === invoiceId);

  ensureInvoices();
  window.addEventListener('moldflow-cloud-ready', () => ensureInvoices());

  const invoiceNumberIndex = fields.purchases.findIndex(field => field[0] === 'invoiceNumber');
  if (!fields.purchases.some(field => field[0] === 'invoiceFileId')) {
    fields.purchases.splice(invoiceNumberIndex + 1, 0, ['invoiceFileId', 'Fichier de facture associé', 'select', []]);
  }
  const invoiceFileField = fields.purchases.find(field => field[0] === 'invoiceFileId');
  const openModalBeforeInvoices = openModal;
  openModal = (type, record = null) => {
    if (type === 'purchases') invoiceFileField[3] = ensureInvoices().map(invoice => invoice.id);
    openModalBeforeInvoices(type, record);
    if (type !== 'purchases') return;
    const select = $('#entityForm').elements.namedItem('invoiceFileId');
    if (!select) return;
    [...select.options].forEach(option => {
      const invoice = ensureInvoices().find(item => item.id === option.value);
      if (invoice) option.textContent = `${invoice.id} · ${invoice.name || 'Facture'}`;
    });
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'Aucun fichier de facture associé';
    select.prepend(none);
    select.required = false;
    select.disabled = !window.MoldCloud?.canManageAttachments();
    select.value = record?.invoiceFileId || '';
  };

  $('#entityForm').addEventListener('change', event => {
    if (event.target.name !== 'invoiceFileId' || !event.target.value || !window.MoldCloud?.canManageAttachments()) return;
    const invoice = ensureInvoices().find(item => item.id === event.target.value);
    const number = $('#entityForm').elements.namedItem('invoiceNumber');
    if (invoice && number && !number.value.trim()) number.value = invoice.id;
  });

  function invoiceLibrarySection() {
    const invoices = ensureInvoices();
    const linkedCount = data.purchases.filter(purchase => purchase.invoiceFileId).length;
    const cards = invoices.length ? `<div class="invoice-library-grid">${invoices.map(invoice => {
      const linked = assignedPurchases(invoice.id);
      return `<article class="invoice-library-item"><span class="invoice-library-icon">${/\.pdf$/i.test(invoice.name || '') ? 'PDF' : 'IMG'}</span><div class="invoice-library-info"><span>${escapeHtml(invoice.id)}</span><b title="${escapeHtml(invoice.name || 'Facture')}">${escapeHtml(invoice.name || 'Facture')}</b><small>${formatSize(invoice.size)} · Ajoutée le ${escapeHtml(invoice.createdAt || '—')}</small><div class="invoice-purchase-links">${linked.length ? linked.map(purchase => `<button type="button" data-purchase-link="${escapeHtml(purchase.id)}">${escapeHtml(purchase.id)}</button>`).join('') : '<em>Non associée</em>'}</div></div><button type="button" class="invoice-open-button" data-open-invoice="${escapeHtml(invoice.id)}">Lire</button>${window.MoldCloud?.canManageAttachments() ? `<button type="button" class="invoice-delete-button" data-delete-invoice="${escapeHtml(invoice.id)}">Supprimer</button>` : ''}</article>`;
    }).join('')}</div>` : '<div class="invoice-library-empty">Aucune facture enregistrée. Ajoutez un PDF ou une image de facture.</div>';
    return `<section class="card invoice-library-card"><div class="card-head"><div><span class="section-kicker">FACTURES</span><h3>Bibliothèque des factures</h3><span class="sub">Ajoutez les fichiers, puis associez-les aux achats concernés</span></div><div class="invoice-library-actions"><span>${invoices.length} fichier${invoices.length > 1 ? 's' : ''} · ${linkedCount} achat${linkedCount > 1 ? 's' : ''} lié${linkedCount > 1 ? 's' : ''}</span>${window.MoldCloud?.canManageAttachments() ? '<button type="button" class="primary" data-add-invoices>＋ Ajouter des factures</button>' : ''}</div></div>${cards}</section>`;
  }

  function invoiceLibraryLauncher() {
    const invoices = ensureInvoices();
    const linkedCount = data.purchases.filter(purchase => purchase.invoiceFileId).length;
    return `<button type="button" class="card invoice-library-launcher" data-open-invoice-library><span class="invoice-library-launcher-icon">FAC</span><span class="invoice-library-launcher-copy"><span class="section-kicker">FACTURES</span><strong>Bibliothèque des factures</strong><small>Ouvrir le dossier, ajouter des factures et consulter les fichiers</small></span><span class="invoice-library-launcher-count"><b>${invoices.length}</b><small>fichier${invoices.length > 1 ? 's' : ''}</small></span><span class="invoice-library-launcher-linked">${linkedCount} achat${linkedCount > 1 ? 's' : ''} lié${linkedCount > 1 ? 's' : ''}</span><span class="invoice-library-launcher-action">Ouvrir</span></button>`;
  }

  function invoiceLibraryArchive() {
    const invoices = ensureInvoices();
    return `<div class="invoice-library-archive"><button type="button" class="back-btn invoice-library-back" data-close-invoice-library>Retour aux achats</button><section class="card invoice-library-archive-hero"><div><span class="section-kicker">ARCHIVES DES FACTURES</span><h2>Fichiers de factures</h2><p>Ajoutez vos factures, consultez-les en ligne et associez-les aux achats correspondants.</p></div><span class="invoice-library-archive-badge">${invoices.length} fichier${invoices.length > 1 ? 's' : ''}</span></section>${invoiceLibrarySection()}</div>`;
  }

  const listPageBeforeInvoices = listPage;
  listPage = type => {
    if (type !== 'purchases') return listPageBeforeInvoices(type);
    if (invoiceLibraryOpen) return invoiceLibraryArchive();
    const html = listPageBeforeInvoices(type);
    const launcher = invoiceLibraryLauncher();
    return html.includes('<div class="toolbar">') ? html.replace('<div class="toolbar">', `${launcher}<div class="toolbar">`) : `${launcher}${html}`;
  };

  const purchaseRowBeforeInvoices = defs.purchases.row;
  defs.purchases.row = purchase => {
    const html = purchaseRowBeforeInvoices(purchase);
    const invoice = invoiceForPurchase(purchase);
    if (!invoice) return html;
    const tone = purchase.invoicePaid === 'Oui' ? 'paid' : 'unpaid';
    const label = `${purchase.invoicePaid === 'Oui' ? 'Payée' : 'Non payée'} · ${invoice.name || invoice.id}`;
    const cell = `<td><button type="button" class="invoice-cell-button ${tone}" data-open-invoice="${escapeHtml(invoice.id)}" title="Lire ${escapeHtml(invoice.name || invoice.id)}"><span>${purchase.invoicePaid === 'Oui' ? '✓' : '!'}</span>${escapeHtml(label)}</button></td>`;
    const lastCell = html.lastIndexOf('<td>');
    return lastCell === -1 ? html : `${html.slice(0, lastCell)}${cell}`;
  };

  const purchaseDashboardBeforeInvoices = purchaseDashboard;
  purchaseDashboard = () => {
    const html = purchaseDashboardBeforeInvoices();
    const purchase = data.purchases.find(item => item.id === selectedPurchaseId);
    const invoice = invoiceForPurchase(purchase);
    if (!invoice) return html;
    const tone = purchase.invoicePaid === 'Oui' ? 'paid' : 'unpaid';
    const label = `${purchase.invoicePaid === 'Oui' ? 'Payée' : 'Non payée'} · ${invoice.name || invoice.id}`;
    return html.replace(/<b class="invoice-(?:paid|unpaid)">[\s\S]*?<\/b>/, `<button type="button" class="invoice-detail-button ${tone}" data-open-invoice="${escapeHtml(invoice.id)}">${escapeHtml(label)}</button>`);
  };

  document.body.insertAdjacentHTML('beforeend', `<input type="file" id="invoiceFileInput" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" hidden><div class="invoice-viewer" id="invoiceViewer" aria-hidden="true"><section class="invoice-viewer-panel" role="dialog" aria-modal="true" aria-labelledby="invoiceViewerTitle"><header><div><span class="section-kicker">LECTURE DE LA FACTURE</span><h3 id="invoiceViewerTitle">Facture</h3></div><div><a id="invoiceViewerExternal" target="_blank" rel="noopener">Ouvrir dans un nouvel onglet</a><button type="button" data-close-invoice-viewer aria-label="Fermer">×</button></div></header><div class="invoice-viewer-content" id="invoiceViewerContent"></div></section></div>`);
  const input = document.querySelector('#invoiceFileInput');
  const viewer = document.querySelector('#invoiceViewer');
  const viewerTitle = document.querySelector('#invoiceViewerTitle');
  const viewerExternal = document.querySelector('#invoiceViewerExternal');
  const viewerContent = document.querySelector('#invoiceViewerContent');

  const closeViewer = () => {
    viewer.classList.remove('open');
    viewer.setAttribute('aria-hidden', 'true');
    viewerContent.replaceChildren();
    viewerExternal.removeAttribute('href');
  };
  async function openInvoice(invoiceId) {
    const invoice = ensureInvoices().find(item => item.id === invoiceId);
    if (!invoice) return toast('Facture introuvable');
    try {
      const url = await window.MoldCloud.achatAttachmentUrl(invoice.path);
      if (!url) throw new Error('Fichier de facture introuvable');
      viewerTitle.textContent = `${invoice.id} · ${invoice.name || 'Facture'}`;
      viewerExternal.href = url;
      if (/\.pdf$/i.test(invoice.name || '')) {
        const frame = document.createElement('iframe');
        frame.src = url;
        frame.title = invoice.name || invoice.id;
        viewerContent.appendChild(frame);
      } else {
        const image = document.createElement('img');
        image.src = url;
        image.alt = invoice.name || invoice.id;
        viewerContent.appendChild(image);
      }
      viewer.classList.add('open');
      viewer.setAttribute('aria-hidden', 'false');
      viewer.querySelector('[data-close-invoice-viewer]').focus();
    } catch (error) {
      toast(error.message || 'Impossible d’ouvrir la facture');
    }
  }

  document.addEventListener('click', async event => {
    if (event.target.closest('[data-open-invoice-library]')) {
      invoiceLibraryOpen = true;
      render();
      return;
    }
    if (event.target.closest('[data-close-invoice-library]')) {
      invoiceLibraryOpen = false;
      render();
      return;
    }
    if (event.target.closest('[data-add-invoices]')) {
      if (!window.MoldCloud?.canManageAttachments()) return;
      input.value = '';
      input.click();
      return;
    }
    const open = event.target.closest('[data-open-invoice]');
    if (open) {
      event.preventDefault();
      event.stopPropagation();
      await openInvoice(open.dataset.openInvoice);
      return;
    }
    if (event.target.closest('[data-close-invoice-viewer]') || event.target === viewer) {
      closeViewer();
      return;
    }
    const remove = event.target.closest('[data-delete-invoice]');
    if (!remove || !window.MoldCloud?.canManageAttachments()) return;
    const invoice = ensureInvoices().find(item => item.id === remove.dataset.deleteInvoice);
    if (!invoice) return;
    const linked = assignedPurchases(invoice.id);
    const warning = linked.length ? ` Cette facture est liée à ${linked.length} achat(s) ; les associations seront retirées.` : '';
    if (!confirm(`Supprimer définitivement ${invoice.name || invoice.id} ?${warning}`)) return;
    remove.disabled = true;
    try {
      await window.MoldCloud.removeAchatAttachment(invoice.path);
      data.invoices = ensureInvoices().filter(item => item.id !== invoice.id);
      linked.forEach(purchase => { purchase.invoiceFileId = ''; });
      save();
      render();
      toast('Facture supprimée');
    } catch (error) {
      remove.disabled = false;
      toast(error.message || 'Impossible de supprimer la facture');
    }
  });
  document.addEventListener('click', event => {
    const navigation = event.target.closest('[data-view]');
    if (navigation && navigation.dataset.view !== 'purchases') invoiceLibraryOpen = false;
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && viewer.classList.contains('open')) closeViewer();
  });

  input.addEventListener('change', async () => {
    const files = [...(input.files || [])];
    if (!files.length || !window.MoldCloud?.canManageAttachments()) return;
    if (files.some(file => file.size > MAX_SIZE)) return toast('Chaque facture doit faire au maximum 10 Mo');
    if (files.some(file => !acceptedExtensions.test(file.name))) return toast('Format accepté : PDF, JPG, PNG ou WEBP');
    const button = document.querySelector('[data-add-invoices]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Envoi des factures…';
    }
    const uploaded = [];
    try {
      for (const file of files) {
        const stored = await window.MoldCloud.uploadAchatAttachment('invoice-library', file);
        const invoice = {...stored, id: nextInvoiceId(), createdAt: new Date().toLocaleDateString('fr-FR')};
        uploaded.push(invoice);
        ensureInvoices().unshift(invoice);
      }
      save();
      render();
      toast(`${uploaded.length} facture${uploaded.length > 1 ? 's' : ''} ajoutée${uploaded.length > 1 ? 's' : ''}`);
    } catch (error) {
      uploaded.forEach(invoice => { data.invoices = ensureInvoices().filter(item => item.id !== invoice.id); });
      await Promise.all(uploaded.map(invoice => window.MoldCloud.removeAchatAttachment(invoice.path).catch(() => null)));
      if (button) {
        button.disabled = false;
        button.textContent = '＋ Ajouter des factures';
      }
      toast(error.message || 'Impossible d’envoyer les factures');
    }
  });
})();
