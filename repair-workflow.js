(() => {
  const repairWorkflowStatuses = ['En conception', 'Usinage', 'Mise au point', 'Terminé'];

  function ensureRepairTracking(repair) {
    repair.workLogs ||= [];
    repair.stageActors ||= {};
    if (!repairWorkflowStatuses.includes(repair.workflowStatus)) {
      repair.workflowStatus = repair.status === 'En réparation' ? 'Usinage' : 'En conception';
    }
    repair.workLogs.forEach(log => {
      if (!repairWorkflowStatuses.includes(log.status)) log.status = repair.workflowStatus;
      if (!Object.prototype.hasOwnProperty.call(log, 'blocker')) log.blocker = log.notes || '';
      if (!log.blockerStatus) log.blockerStatus = log.blocker ? 'En attente de résolution' : 'Résolu';
    });
  }

  data.repairs.forEach(ensureRepairTracking);

  function repairWorkflowSection(repair) {
    ensureRepairTracking(repair);
    const current = repairWorkflowStatuses.indexOf(repair.workflowStatus);
    const descriptions = ['Analyse et définition de la solution', 'Fabrication ou remise en état', 'Montage, réglage et essais', 'Réparation clôturée'];
    const stageControl = canEdit() ? `<label class="repair-stage-control"><span>Étape actuelle</span><select class="repair-stage-select" data-repair-workflow-status="${repair.id}">${repairWorkflowStatuses.map(status => `<option ${status === repair.workflowStatus ? 'selected' : ''}>${status}</option>`).join('')}</select></label>` : `<div class="repair-stage-control"><span>Étape actuelle</span><b class="repair-current-stage">${repair.workflowStatus}</b></div>`;
    return `<section class="card workflow-card repair-workflow-card"><div class="card-head"><div><span class="section-kicker">Processus de réparation</span><h3>Avancement de l’intervention</h3></div>${stageControl}</div><div class="workflow repair-workflow">${repairWorkflowStatuses.map((status, index) => {
      const completed = index < current || current === repairWorkflowStatuses.length - 1;
      const state = completed ? 'done' : index === current ? 'active' : '';
      const actorValue = repair.stageActors[status];
      const actors = (Array.isArray(actorValue) ? actorValue : actorValue ? [actorValue] : []).filter(Boolean);
      const actorLabel = `Acteur : ${actors.length ? actors.join(' · ') : 'À définir'}`;
      const actorControl = canEdit() ? `<button type="button" class="repair-stage-actor" data-repair-stage-actor="${status}" data-repair-id="${repair.id}" title="Double-cliquez pour définir l’acteur">${actorLabel}</button>` : `<small class="repair-stage-actor">${actorLabel}</small>`;
      return `<div class="workflow-step ${state}"><span class="step-marker">${completed ? '✓' : index + 1}</span><div class="step-body"><h4>${status}</h4><span>${descriptions[index]}</span>${actorControl}</div></div>`;
    }).join('')}</div></section>`;
  }

  function repairJournalSection(repair) {
    const logs = repair.workLogs.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return `<section class="card project-log-card repair-log-card"><div class="card-head"><div><span class="section-kicker">Suivi quotidien</span><h3>Journal de réparation</h3><span class="sub">Avancement, travail réalisé et points bloquants</span></div>${canEdit() ? `<button class="primary" data-repair-log="${repair.id}">＋ Ajouter le journal du jour</button>` : ''}</div><div class="log-list">${logs.length ? logs.map(log => { const resolved = log.blockerStatus === 'Résolu'; return `<article class="log-entry repair-log-entry"><div class="log-date"><b>${log.date}</b>${badge(log.status)}${canEdit() ? `<div class="log-actions repair-log-actions"><button type="button" class="repair-log-edit" data-edit-repair-log="${log.id}" data-repair-id="${repair.id}" title="Modifier cette entrée">Modifier</button><button type="button" class="repair-log-delete" data-delete-repair-log="${log.id}" data-repair-id="${repair.id}">Supprimer</button></div>` : ''}</div><div><span>Travail réalisé</span><p>${log.work || '—'}</p></div><div class="log-blocker ${log.blocker ? (resolved ? 'resolved' : 'active') : ''}"><span>Point bloquant · ${resolved ? 'Résolu' : 'En attente de résolution'}</span><p>${log.blocker || 'Aucun blocage'}</p></div></article>`; }).join('') : '<div class="empty">Aucun journal de travail pour cette réparation.</div>'}</div></section>`;
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
    $('#formFields').innerHTML = `<div class="field"><label>Date</label><input name="date" type="date" value="${log?.date || new Date().toISOString().slice(0, 10)}" required></div><div class="field"><label>Étape actuelle</label><select name="status" required>${repairWorkflowStatuses.map(status => `<option ${status === (log?.status || repair.workflowStatus) ? 'selected' : ''}>${status}</option>`).join('')}</select></div><div class="field full"><label>Travail réalisé aujourd’hui</label><textarea name="work" placeholder="Décrivez les opérations effectuées, décisions et résultats..." required>${log?.work || ''}</textarea></div><div class="field"><label>Statut du point bloquant</label><select name="blockerStatus"><option ${log?.blockerStatus !== 'Résolu' ? 'selected' : ''}>En attente de résolution</option><option ${log?.blockerStatus === 'Résolu' ? 'selected' : ''}>Résolu</option></select></div><div class="field full"><label>Point bloquant / problème actuel</label><textarea name="blocker" placeholder="Indiquez ce qui bloque la réparation. Laissez vide s’il n’y a aucun blocage.">${log?.blocker || log?.notes || ''}</textarea></div>`;
    $('#modalBackdrop .modal').scrollTop = 0;
    $('#modalBackdrop').classList.add('open');
  }

  function openStageActor(repairId, stage) {
    const repair = data.repairs.find(item => item.id === repairId);
    if (!repair || !repairWorkflowStatuses.includes(stage) || !canEdit()) return;
    ensureRepairTracking(repair);
    const actorValue = repair.stageActors[stage];
    const selectedActors = (Array.isArray(actorValue) ? actorValue : actorValue ? [actorValue] : []).filter(Boolean);
    const actors = [...new Set([...requesterNames, ...selectedActors])];
    $('#modalTitle').textContent = `Acteurs · ${stage}`;
    $('#modalEyebrow').textContent = 'RESPONSABLE DE L’ÉTAPE';
    $('#entityForm').dataset.type = 'repairStageActor';
    $('#entityForm').dataset.editId = repair.id;
    $('#entityForm').dataset.stage = stage;
    $('#formFields').innerHTML = `<div class="field full"><label>Acteurs</label><select name="actor" multiple size="${Math.min(8, actors.length + 1)}"><option value="__none__" ${selectedActors.length ? '' : 'selected'}>— À définir —</option>${actors.map(actor => `<option value="${actor}" ${selectedActors.includes(actor) ? 'selected' : ''}>${actor}</option>`).join('')}</select><div class="multi-actions"><small class="multi-help">Sélection multiple · Ctrl / Cmd + clic</small><button type="button" data-clear-multi="actor">Aucun acteur</button></div></div>`;
    $('#modalBackdrop .modal').scrollTop = 0;
    $('#modalBackdrop').classList.add('open');
  }

  content.addEventListener('dblclick', event => {
    const actor = event.target.closest('[data-repair-stage-actor]');
    if (actor) openStageActor(actor.dataset.repairId, actor.dataset.repairStageActor);
  });

  content.addEventListener('change', event => {
    const stage = event.target.closest('[data-repair-workflow-status]');
    if (!stage || !canEdit()) return;
    const repair = data.repairs.find(item => item.id === stage.dataset.repairWorkflowStatus);
    if (!repair || !repairWorkflowStatuses.includes(stage.value)) return;
    repair.workflowStatus = stage.value;
    save();
    render();
    toast(`Étape actuelle : ${stage.value}`);
  });

  $('#entityForm').addEventListener('change', event => {
    if (!event.target.matches('select[multiple][name="actor"]')) return;
    const none = [...event.target.options].find(option => option.value === '__none__');
    const selected = [...event.target.selectedOptions].filter(option => option.value !== '__none__');
    if (none) none.selected = selected.length === 0;
  });

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
    if (event.target.dataset.type === 'repairStageActor') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!canEdit()) return;
      const repair = data.repairs.find(item => item.id === event.target.dataset.editId);
      const stage = event.target.dataset.stage;
      if (!repair || !repairWorkflowStatuses.includes(stage)) return;
      ensureRepairTracking(repair);
      repair.stageActors[stage] = new FormData(event.target).getAll('actor').filter(actor => actor && actor !== '__none__');
      save();
      closeModal();
      render();
      toast('Acteur de l’étape mis à jour');
      return;
    }
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
    save();
    closeModal();
    render();
    toast(logId ? 'Journal de réparation modifié' : 'Journal de réparation ajouté');
  }, true);
})();
