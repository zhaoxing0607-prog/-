(() => {
  const repairWorkflowStatuses = ['En conception', 'Usinage', 'Mise au point', 'Terminé'];

  function ensureRepairTracking(repair) {
    repair.workLogs ||= [];
    repair.stageActors ||= {};
    repair.workLogs.forEach(log => {
      if (log.actor && log.status && !repair.stageActors[log.status]) repair.stageActors[log.status] = log.actor;
    });
    if (repair.status === 'Terminé') repair.workflowStatus = 'Terminé';
    if (!repairWorkflowStatuses.includes(repair.workflowStatus)) {
      repair.workflowStatus = repair.status === 'En réparation' ? 'Usinage' : 'En conception';
    }
  }

  data.repairs.forEach(ensureRepairTracking);

  function repairWorkflowSection(repair) {
    ensureRepairTracking(repair);
    const current = repairWorkflowStatuses.indexOf(repair.workflowStatus);
    const descriptions = ['Analyse et définition de la solution', 'Fabrication ou remise en état', 'Montage, réglage et essais', 'Réparation clôturée'];
    return `<section class="card workflow-card repair-workflow-card"><div class="card-head"><div><span class="section-kicker">Processus de réparation</span><h3>Avancement de l’intervention</h3></div><span class="repair-current-stage">${repair.workflowStatus}</span></div><div class="workflow repair-workflow">${repairWorkflowStatuses.map((status, index) => {
      const completed = index < current || current === repairWorkflowStatuses.length - 1;
      const state = completed ? 'done' : index === current ? 'active' : '';
      const actor = repair.stageActors[status];
      return `<div class="workflow-step ${state}"><span class="step-marker">${completed ? '✓' : index + 1}</span><div class="step-body"><h4>${status}</h4><span>${descriptions[index]}</span><small class="repair-stage-actor">Acteur : ${actor || 'À définir'}</small></div></div>`;
    }).join('')}</div></section>`;
  }

  function repairJournalSection(repair) {
    const logs = repair.workLogs.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return `<section class="card project-log-card repair-log-card"><div class="card-head"><div><span class="section-kicker">Suivi quotidien</span><h3>Journal de réparation</h3><span class="sub">Travaux réalisés, étape actuelle et remarques · chaque entrée peut être modifiée</span></div>${canEdit() ? `<button class="primary" data-repair-log="${repair.id}">＋ Ajouter une entrée</button>` : ''}</div><div class="log-list">${logs.length ? logs.map(log => `<article class="log-entry repair-log-entry"><div class="log-date"><b>${log.date}</b>${badge(log.status)}<span class="repair-log-actor">Acteur : ${log.actor || 'À définir'}</span>${canEdit() ? `<div class="log-actions repair-log-actions"><button type="button" class="repair-log-edit" data-edit-repair-log="${log.id}" data-repair-id="${repair.id}" title="Modifier cette entrée">✎ Modifier l’entrée</button><button type="button" class="repair-log-delete" data-delete-repair-log="${log.id}" data-repair-id="${repair.id}">Supprimer</button></div>` : ''}</div><div><span>Travail réalisé</span><p>${log.work || '—'}</p></div><div class="repair-log-notes"><span>Remarques</span><p>${log.notes || 'Aucune remarque'}</p></div></article>`).join('') : '<div class="empty">Aucune entrée dans le journal de réparation.</div>'}</div></section>`;
  }

  const baseRepairDashboard = repairDashboard;
  repairDashboard = () => {
    const repair = data.repairs.find(item => item.id === selectedRepairId);
    if (!repair) return baseRepairDashboard();
    ensureRepairTracking(repair);
    return baseRepairDashboard() + repairWorkflowSection(repair) + repairJournalSection(repair);
  };

  function openRepairLog(repairId, logId = '') {
    const repair = data.repairs.find(item => item.id === repairId);
    const log = (repair?.workLogs || []).find(item => item.id === logId);
    if (!repair || !canEdit()) return;
    ensureRepairTracking(repair);
    $('#modalTitle').textContent = `${log ? 'Modifier le journal' : 'Journal'} · ${repair.id}`;
    $('#modalEyebrow').textContent = log ? 'MODIFICATION DU JOURNAL' : 'MISE À JOUR DE LA RÉPARATION';
    $('#entityForm').dataset.type = 'repairLog';
    $('#entityForm').dataset.editId = repair.id;
    $('#entityForm').dataset.logId = log?.id || '';
    const selectedActor = log?.actor || repair.stageActors[log?.status || repair.workflowStatus] || (requesterNames.includes(currentMemberName) ? currentMemberName : 'XING ZHAO');
    const actors = requesterNames.includes(selectedActor) ? requesterNames : [...requesterNames, selectedActor];
    $('#formFields').innerHTML = `<div class="field"><label>Date</label><input name="date" type="date" value="${log?.date || new Date().toISOString().slice(0, 10)}" required></div><div class="field"><label>Étape de la réparation</label><select name="status" required>${repairWorkflowStatuses.map(status => `<option ${status === (log?.status || repair.workflowStatus) ? 'selected' : ''}>${status}</option>`).join('')}</select></div><div class="field"><label>Acteur</label><select name="actor" required>${actors.map(actor => `<option ${actor === selectedActor ? 'selected' : ''}>${actor}</option>`).join('')}</select></div><div class="field full"><label>Travail réalisé</label><textarea name="work" placeholder="Décrivez les opérations, contrôles et résultats..." required>${log?.work || ''}</textarea></div><div class="field full"><label>Remarques</label><textarea name="notes" placeholder="Informations complémentaires, problème rencontré ou prochaine action...">${log?.notes || ''}</textarea></div>`;
    $('#modalBackdrop .modal').scrollTop = 0;
    $('#modalBackdrop').classList.add('open');
  }

  content.addEventListener('click', event => {
    const add = event.target.closest('[data-repair-log]');
    const edit = event.target.closest('[data-edit-repair-log]');
    const remove = event.target.closest('[data-delete-repair-log]');
    if (add) {
      openRepairLog(add.dataset.repairLog);
      return;
    }
    if (edit) {
      openRepairLog(edit.dataset.repairId, edit.dataset.editRepairLog);
      return;
    }
    if (remove && confirm('Supprimer cette entrée du journal de réparation ?')) {
      const repair = data.repairs.find(item => item.id === remove.dataset.repairId);
      if (!repair) return;
      repair.workLogs = repair.workLogs.filter(log => log.id !== remove.dataset.deleteRepairLog);
      save();
      render();
      toast('Entrée du journal supprimée');
    }
  });

  $('#entityForm').addEventListener('submit', event => {
    if (event.target.dataset.type !== 'repairLog') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!canEdit()) return;
    const repair = data.repairs.find(item => item.id === event.target.dataset.editId);
    if (!repair) return;
    ensureRepairTracking(repair);
    const entry = Object.fromEntries(new FormData(event.target));
    const logId = event.target.dataset.logId;
    if (logId) {
      const index = repair.workLogs.findIndex(log => log.id === logId);
      if (index !== -1) repair.workLogs[index] = {...repair.workLogs[index], ...entry};
    } else {
      entry.id = `RLOG-${repair.id}-${Date.now()}`;
      repair.workLogs.unshift(entry);
    }
    repair.workflowStatus = entry.status;
    repair.stageActors[entry.status] = entry.actor;
    if (entry.status === 'Terminé') {
      repair.status = 'Terminé';
      const mould = data.moulds.find(item => item.id === mouldReference(repair.mould).id);
      if (mould) mould.status = mould.mouldCategory === 'Sertissage' ? 'Validé' : 'Dispo';
    } else if (repair.status === 'Terminé') {
      repair.status = 'En réparation';
      const mould = data.moulds.find(item => item.id === mouldReference(repair.mould).id);
      if (mould) mould.status = 'Panne';
    }
    save();
    closeModal();
    render();
    toast(logId ? 'Journal de réparation modifié' : 'Journal de réparation ajouté');
  }, true);
})();
