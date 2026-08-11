(() => {
  const sertissageStages = [
    ['sertissageConception', 'EN CONCEPTION', 'En conception', 0, 0.4],
    ['sertissageSupplier', 'AFFECTATION AUX FOURNISSEURS', 'Affectation aux fournisseurs', 0.4, 0.85],
    ['sertissageValidated', 'VALIDÉ', 'Validé', 0.85, 1]
  ];

  function stageDates(project, stage) {
    const start = project.start || project.created || new Date().toISOString().slice(0, 10);
    const due = project.due || addDays(start, 30);
    const total = Math.max(3, Math.round((new Date(due) - new Date(start)) / 86400000) || 30);
    const detail = project.stageDetails?.[stage[0]] || {};
    const from = detail.start || addDays(start, Math.round(total * stage[3]));
    const to = detail.end || addDays(start, Math.round(total * stage[4]));
    const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000));
    return {detail, from, to, days};
  }

  function sertissageWorkflow(project) {
    const current = sertissageProjectStatuses.indexOf(project.status);
    return `<section class="card workflow-card"><div class="card-head"><div><h3>Étapes de fabrication</h3><span class="sub">Le workflow suit automatiquement le statut sélectionné</span></div><button class="secondary" data-edit-project="${project.id}">Modifier la fabrication</button></div><div class="workflow workflow-three">${sertissageStages.map((stage, index) => {
      const {detail, from, to, days} = stageDates(project, stage);
      const state = index < current || current === sertissageStages.length - 1 ? 'done' : index === current ? 'active' : 'pending';
      return `<button class="workflow-step ${state}" data-stage="${stage[0]}"><div class="step-marker">${state === 'done' ? '✓' : index + 1}</div><div class="step-body"><div><h4>${stage[1]}</h4><span>${state === 'done' ? 'Terminée' : state === 'active' ? 'En cours' : 'À venir'}</span></div><p>${from} → ${to}</p><small>${detail.duration || `${days} jours`}${detail.participants ? ` · ${detail.participants}` : ''}</small></div></button>`;
    }).join('')}</div></section>`;
  }

  const baseProjectDetail = projectDetail;
  projectDetail = () => {
    const project = data.projects.find(item => item.id === selectedProjectId);
    const html = baseProjectDetail();
    if (project?.mouldType !== 'Sertissage') return html;
    return html.replace(/<section class="card workflow-card">[\s\S]*?<\/section>/, sertissageWorkflow(project));
  };

  const baseOpenStageModal = openStageModal;
  openStageModal = key => {
    const project = data.projects.find(item => item.id === selectedProjectId);
    const stage = sertissageStages.find(item => item[0] === key);
    if (project?.mouldType !== 'Sertissage' || !stage) {
      baseOpenStageModal(key);
      return;
    }
    const detail = project.stageDetails?.[key] || {};
    $('#modalTitle').textContent = stage[1];
    $('#modalEyebrow').textContent = 'DÉTAIL DE L’ÉTAPE';
    $('#entityForm').dataset.type = 'stage';
    $('#entityForm').dataset.editId = key;
    $('#formFields').innerHTML = `<div class="field"><label>Date de début</label><input name="start" type="date" value="${detail.start || ''}"></div><div class="field"><label>Date de fin</label><input name="end" type="date" value="${detail.end || ''}"></div><div class="field"><label>Temps de travail</label><input name="duration" type="text" value="${detail.duration || ''}" placeholder="Calculé automatiquement à partir des dates"></div><div class="field"><label>Participants</label><input name="participants" type="text" value="${detail.participants || ''}" placeholder="XING ZHAO, fournisseur..."></div><div class="field full"><label>Remarques</label><textarea name="notes" placeholder="Informations, décisions et points de vigilance">${detail.notes || ''}</textarea></div>`;
    $('#modalBackdrop .modal').scrollTop = 0;
    $('#modalBackdrop').classList.add('open');
  };
})();
