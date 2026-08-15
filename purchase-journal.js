(() => {
  function ensurePurchaseTracking(purchase) {
    purchase.workLogs ||= [];
    purchase.workLogs.forEach((log, index) => {
      if (!log.id) log.id = `ALOG-${purchase.id}-${log.date || 'ancienne'}-${index}`;
      if (!purchaseStatuses.includes(log.status)) log.status = purchase.status || 'En consultation';
      if (!Object.prototype.hasOwnProperty.call(log, 'work')) log.work = log.notes || '';
      if (!Object.prototype.hasOwnProperty.call(log, 'blocker')) log.blocker = '';
      if (!log.blockerStatus) log.blockerStatus = log.blocker ? 'En attente de résolution' : 'Résolu';
    });
  }

  data.purchases.forEach(ensurePurchaseTracking);

  function purchaseJournalSection(purchase) {
    ensurePurchaseTracking(purchase);
    const logs = purchase.workLogs.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return `<section class="card project-log-card purchase-log-card"><div class="card-head"><div><span class="section-kicker">Suivi des achats</span><h3>Journal d’achat</h3><span class="sub">Avancement, actions réalisées et points à suivre</span></div>${canEdit() ? `<button class="primary" data-purchase-log="${purchase.id}">＋ Ajouter le journal du jour</button>` : ''}</div><div class="log-list">${logs.length ? logs.map(log => {
      const resolved = log.blockerStatus === 'Résolu';
      return `<article class="log-entry purchase-log-entry"><div class="log-date"><b>${log.date}</b>${badge(log.status)}${log.author ? `<small>Par ${log.author}</small>` : ''}${canEdit() ? `<div class="log-actions purchase-log-actions"><button type="button" class="purchase-log-edit" data-edit-purchase-log="${log.id}" data-purchase-id="${purchase.id}">Modifier</button><button type="button" class="purchase-log-delete" data-delete-purchase-log="${log.id}" data-purchase-id="${purchase.id}">Supprimer</button></div>` : ''}</div><div><span>Action / avancement réalisé</span><p>${log.work || '—'}</p></div><div class="log-blocker ${log.blocker ? (resolved ? 'resolved' : 'active') : ''}"><span>Point à suivre · ${resolved ? 'Résolu' : 'En attente de résolution'}</span><p>${log.blocker || 'Aucun point en attente'}</p></div></article>`;
    }).join('') : '<div class="empty">Aucune entrée dans le journal de cet achat.</div>'}</div></section>`;
  }

  const basePurchaseDashboard = purchaseDashboard;
  purchaseDashboard = () => {
    const purchase = data.purchases.find(item => item.id === selectedPurchaseId);
    if (!purchase) return basePurchaseDashboard();
    ensurePurchaseTracking(purchase);
    return basePurchaseDashboard() + purchaseJournalSection(purchase);
  };

  function openPurchaseLog(purchaseId, logId = '') {
    const purchase = data.purchases.find(item => item.id === purchaseId);
    const log = (purchase?.workLogs || []).find(item => item.id === logId);
    if (!purchase || !canEdit()) return;
    ensurePurchaseTracking(purchase);
    $('#modalTitle').textContent = `${log ? 'Modifier le journal' : 'Journal'} · ${purchase.id}`;
    $('#modalEyebrow').textContent = log ? 'MODIFICATION DU JOURNAL' : 'MISE À JOUR DE L’ACHAT';
    $('#entityForm').dataset.type = 'purchaseLog';
    $('#entityForm').dataset.editId = purchase.id;
    $('#entityForm').dataset.logId = log?.id || '';
    $('#formFields').innerHTML = `<div class="field"><label>Date</label><input name="date" type="date" value="${log?.date || new Date().toISOString().slice(0, 10)}" required></div><div class="field"><label>Statut de l’achat</label><select name="status" required>${purchaseStatuses.map(status => `<option ${status === (log?.status || purchase.status) ? 'selected' : ''}>${status}</option>`).join('')}</select></div><div class="field full"><label>Action / avancement réalisé aujourd’hui</label><textarea name="work" placeholder="Ex. devis reçu, fournisseur relancé, commande confirmée, composants expédiés..." required>${log?.work || ''}</textarea></div><div class="field"><label>Statut du point à suivre</label><select name="blockerStatus"><option ${log?.blockerStatus !== 'Résolu' ? 'selected' : ''}>En attente de résolution</option><option ${log?.blockerStatus === 'Résolu' ? 'selected' : ''}>Résolu</option></select></div><div class="field full"><label>Point à suivre / problème actuel</label><textarea name="blocker" placeholder="Ex. devis en attente, délai fournisseur, référence à confirmer...">${log?.blocker || ''}</textarea></div>`;
    $('#modalBackdrop .modal').scrollTop = 0;
    $('#modalBackdrop').classList.add('open');
  }

  content.addEventListener('click', event => {
    const add = event.target.closest('[data-purchase-log]');
    const edit = event.target.closest('[data-edit-purchase-log]');
    const remove = event.target.closest('[data-delete-purchase-log]');
    if (add) {
      openPurchaseLog(add.dataset.purchaseLog);
      return;
    }
    if (edit) {
      openPurchaseLog(edit.dataset.purchaseId, edit.dataset.editPurchaseLog);
      return;
    }
    if (remove && canEdit() && confirm('Supprimer cette entrée du journal d’achat ?')) {
      const purchase = data.purchases.find(item => item.id === remove.dataset.purchaseId);
      if (!purchase) return;
      purchase.workLogs = purchase.workLogs.filter(log => log.id !== remove.dataset.deletePurchaseLog);
      save();
      render();
      toast('Entrée du journal d’achat supprimée');
    }
  });

  $('#entityForm').addEventListener('submit', event => {
    if (event.target.dataset.type !== 'purchaseLog') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!canEdit()) return;
    const purchase = data.purchases.find(item => item.id === event.target.dataset.editId);
    if (!purchase) return;
    ensurePurchaseTracking(purchase);
    const entry = Object.fromEntries(new FormData(event.target));
    const logId = event.target.dataset.logId;
    if (logId) {
      const index = purchase.workLogs.findIndex(log => log.id === logId);
      if (index !== -1) purchase.workLogs[index] = {...purchase.workLogs[index], ...entry};
    } else {
      entry.id = `ALOG-${purchase.id}-${Date.now()}`;
      entry.author = currentMemberName;
      purchase.workLogs.unshift(entry);
    }
    purchase.status = entry.status;
    if (purchase.status === 'Terminé' && purchase.repairId) {
      const linkedPurchases = data.purchases.filter(item => item.repairId === purchase.repairId);
      const repair = data.repairs.find(item => item.id === purchase.repairId);
      if (repair && linkedPurchases.every(item => item.status === 'Terminé')) repair.status = 'En réparation';
    }
    save();
    closeModal();
    render();
    toast(logId ? 'Journal d’achat modifié' : 'Journal d’achat ajouté');
  }, true);

  window.addEventListener('moldflow-cloud-ready', () => {
    data.purchases.forEach(ensurePurchaseTracking);
    localStorage.setItem('mouldOpsDataFr', JSON.stringify(data));
    render();
  });
})();
