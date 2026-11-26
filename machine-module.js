(() => {
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const machines = () => {
    data.machines = Array.isArray(data.machines) ? data.machines : [];
    return data.machines;
  };
  let selectedMachineId = '';
  const currentMachine = () => machines().find(machine => machine.id === selectedMachineId);
  window.ToolMachineDetails = {current: currentMachine};
  meta.machineDetail = ['Machine', 'Dossier technique de la machine', 'Modifier la machine'];
  const documentsFor = machine => Array.isArray(machine.documents) ? machine.documents.filter(file => file?.path) : [];
  const machineFiles = machine => [...documentsFor(machine), machine.drawing2d, machine.model3d].filter(file => file?.path);
  const machineBomFiles = machine => [machine, ...(machine.bomLists || [])].flatMap(list => list.bomComponents || []).flatMap(component => [component.drawing2d, component.model3d]).filter(file => file?.path);
  const hasMachineFiles = machine => machineFiles(machine).length || machineBomFiles(machine).length;
  const documentExtensions = /\.(pdf|jpe?g|png|webp|gif|tiff?|pptx?|docx?|xlsx?|txt|csv|zip|dwg|dxf|stl|obj|glb|gltf|stp|step)$/i;
  const pendingDocuments = new Set();
  const nextMachineId = () => {
    const highest = machines().reduce((max, machine) => {
      const number = Number(String(machine.id || '').match(/\d+/)?.[0] || 0);
      return Math.max(max, number);
    }, 0);
    return `MAC-${String(highest + 1).padStart(3, '0')}`;
  };
  const machineTabs = active => `<div class="mould-page-tabs has-machines">
    <button class="mould-page-tab ${active === 'emboutissage' ? 'active' : ''}" data-mould-page="emboutissage"><strong>OUTILS EMBOUTISSAGE</strong><span>Emboutissage et injection</span></button>
    <button class="mould-page-tab ${active === 'sertissage' ? 'active' : ''}" data-mould-page="sertissage"><strong>Jeux de pose sertissage</strong><span>Outillages de sertissage</span></button>
    <button class="mould-page-tab ${active === 'machines' ? 'active' : ''}" data-mould-page="machines"><strong>Machines</strong><span>Équipements, pièces et dossiers techniques</span></button>
  </div>`;
  const partChips = machine => (machine.linkedPartIds || []).map(id => {
    const part = data.parts.find(item => item.id === id);
    return `<button type="button" class="relation-chip part-name-chip" data-part-link="${escapeHtml(id)}"><b>${escapeHtml(id)}</b><span>${escapeHtml(part?.name || 'Pièce introuvable')}</span></button>`;
  }).join('') || '<span class="machine-empty-value">Aucune pièce associée</span>';
  const fileButton = (file, kind) => file?.path
    ? `<button type="button" class="machine-file-button ${kind === '3d' ? 'is-3d' : ''}" data-open-machine-file="${escapeHtml(file.path)}"><span>${kind === '3d' ? '3D' : '2D'}</span><b title="${escapeHtml(file.name || 'Fichier')}">${escapeHtml(file.name || 'Fichier')}</b></button>`
    : '<span class="machine-empty-value">—</span>';
  const fileCell = (machine, kind) => {
    const key = kind === '3d' ? 'model3d' : 'drawing2d';
    const file = machine[key];
    return file?.path ? `<div class="machine-file-cell">${fileButton(file, kind)}${window.MoldCloud?.canManageAttachments() ? `<button type="button" class="machine-file-delete" data-delete-machine-file="${escapeHtml(machine.id)}" data-machine-file-kind="${kind}" title="Supprimer le fichier ${kind.toUpperCase()}" aria-label="Supprimer le fichier ${kind.toUpperCase()}">×</button>` : ''}</div>` : '<span class="machine-empty-value">—</span>';
  };
  const machineListPage = () => {
    const query = document.querySelector('#globalSearch')?.value.trim().toLowerCase() || '';
    const rows = machines().filter(machine => !query || [machine.id, machine.name, machine.comment, ...(machine.linkedPartIds || [])].join(' ').toLowerCase().includes(query));
    return `${machineTabs('machines')}<div class="machine-toolbar"><div><b>Parc machines</b><span>Machines de production et documents associés</span></div><span>${rows.length} machine${rows.length > 1 ? 's' : ''}</span></div><div class="table-wrap machine-table-wrap"><table class="machine-table"><thead><tr><th>Machine</th><th>Pièces associées</th><th>Commentaire</th><th>Actions</th></tr></thead><tbody>${rows.length ? rows.map(machine => `<tr><td><button type="button" class="project-link" data-machine-detail="${escapeHtml(machine.id)}"><span class="machine-id">${escapeHtml(machine.id)}</span><b class="machine-name">${escapeHtml(machine.name)}</b></button></td><td><div class="machine-part-list">${partChips(machine)}</div></td><td class="machine-comment">${escapeHtml(machine.comment || '—')}</td><td><div class="machine-row-actions">${canEdit() ? `<button type="button" data-edit-machine="${escapeHtml(machine.id)}">Modifier</button>${window.MoldCloud?.canManageAttachments() || !hasMachineFiles(machine) ? '<button type="button" class="danger" data-delete-machine="' + escapeHtml(machine.id) + '">Supprimer</button>' : ''}` : ''}</div></td></tr>`).join('') : '<tr><td colspan="4"><div class="empty machine-empty">Aucune machine enregistrée.<br><small>Utilisez « Ajouter une machine » pour commencer.</small></div></td></tr>'}</tbody></table></div>`;
  };

  const machineDetailPage = () => {
    const machine = currentMachine();
    const back = '<button type="button" class="back-btn" data-back-machines>← Retour aux machines</button>';
    if (!machine) return back + '<div class="empty">Machine introuvable.</div>';
    const documents = documentsFor(machine);
    const legacy = [['2d', machine.drawing2d], ['3d', machine.model3d]].filter(([,file]) => file?.path);
    const files = documents.map(file => `<article class="machine-document-item"><b>${escapeHtml(file.name || 'Document')}</b><button type="button" class="secondary" data-open-machine-file="${escapeHtml(file.path)}">${window.ToolDocumentViewer?.canPreview(file) ? 'Lire dans la fenêtre' : 'Ouvrir / télécharger'}</button>${window.MoldCloud?.canManageAttachments() ? `<button type="button" class="secondary danger" data-remove-machine-document="${escapeHtml(file.path)}">Supprimer</button>` : ''}</article>`).join('');
    return `${back}<section class="project-hero card"><div><span class="eyebrow">${escapeHtml(machine.id)}</span><h2>${escapeHtml(machine.name)}</h2><p>${escapeHtml(machine.comment || '')}</p><div class="machine-part-list">${partChips(machine)}</div></div></section>
      <section class="card relation-card"><div class="card-head"><div><span class="section-kicker">DOSSIER TECHNIQUE</span><h3>Documents associés</h3><span class="sub">PDF, images, TIFF, PowerPoint, modèles 3D et autres documents · 50 Mo par fichier</span></div>${window.MoldCloud?.canManageAttachments() ? `<button type="button" class="primary" data-add-machine-documents ${pendingDocuments.has(machine.id) ? 'disabled' : ''}>${pendingDocuments.has(machine.id) ? 'Envoi en cours…' : '＋ Ajouter des documents'}</button>` : ''}</div>
      <div class="machine-document-list">${files}${legacy.map(([kind]) => fileCell(machine, kind)).join('')}${!documents.length && !legacy.length ? '<div class="empty">Aucun document associé.</div>' : ''}</div></section>
      ${window.renderToolBom?.(machine, true) || ''}`;
  };
  const baseListPage = listPage;
  listPage = type => {
    if (type === 'machineDetail') return machineDetailPage();
    if (type === 'moulds' && mouldPage === 'machines') return machineListPage();
    let html = baseListPage(type);
    if (type !== 'moulds') return html;
    const thirdTab = '<button class="mould-page-tab" data-mould-page="machines"><strong>Machines</strong><span>Équipements, pièces et dossiers techniques</span></button>';
    return html.replace('<div class="mould-page-tabs">', '<div class="mould-page-tabs has-machines">').replace('</div><div class="toolbar">', `${thirdTab}</div><div class="toolbar">`);
  };

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="machineBackdrop"><section class="modal machine-modal"><div class="modal-head"><div><span class="eyebrow" id="machineEyebrow">NOUVELLE MACHINE</span><h2 id="machineTitle">Ajouter une machine</h2></div><button class="close-btn" type="button" data-close-machine-modal title="Fermer" aria-label="Fermer la fenêtre">×</button></div><form id="machineForm"><div class="form-grid"><div class="field full"><label>Nom de la machine</label><input name="name" required maxlength="160" placeholder="Ex. Presse 9500, machine de frappe…"></div><div class="field full"><label>Pièces associées</label><select name="linkedPartIds" multiple size="9"></select><small class="machine-multi-help">Sélection multiple · Ctrl / Cmd + clic</small></div><div class="field full"><label>Commentaire</label><textarea name="comment" maxlength="1000" placeholder="Informations techniques, emplacement ou remarques…"></textarea></div><div class="ticket-form-error full" id="machineError" role="alert"></div></div><div class="modal-actions"><button type="button" class="secondary" data-close-machine-modal>Annuler</button><button type="submit" class="primary">Enregistrer la machine</button></div></form></section></div>`);

  document.body.insertAdjacentHTML('beforeend', '<input type="file" id="machineDocumentsInput" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.tif,.tiff,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.dwg,.dxf,.stl,.obj,.glb,.gltf,.stp,.step" hidden>');
  const documentsInput = document.querySelector('#machineDocumentsInput');
  documentsInput.addEventListener('change', async () => {
    const id = documentsInput.dataset.machineId;
    const files = [...documentsInput.files];
    if (!window.MoldCloud?.canManageAttachments() || !files.length || pendingDocuments.has(id) || !machines().some(machine => machine.id === id)) return;
    if (files.some(file => !documentExtensions.test(file.name) || file.size > MAX_FILE_SIZE)) return toast('Format non accepté ou fichier supérieur à 50 Mo.');
    const uploaded = [];
    pendingDocuments.add(id);
    render();
    try {
      for (const file of files) uploaded.push(await window.MoldCloud.uploadAchatAttachment(`machine-${id}-documents`, file));
      const machine = machines().find(item => item.id === id);
      if (!machine) throw new Error('Machine introuvable');
      machine.documents = [...documentsFor(machine), ...uploaded];
      save();
      toast('Documents ajoutés');
    } catch (error) {
      await Promise.allSettled(uploaded.map(file => window.MoldCloud.removeAchatAttachment(file.path)));
      toast(error.message || 'Impossible d’envoyer les documents');
    } finally {
      pendingDocuments.delete(id);
      render();
    }
  });
  const backdrop = document.querySelector('#machineBackdrop');
  const form = document.querySelector('#machineForm');
  const errorBox = document.querySelector('#machineError');
  const closeMachineModal = () => {
    backdrop.classList.remove('open');
    form.reset();
    form.dataset.machineId = '';
    errorBox.textContent = '';
  };
  const fillPartOptions = selected => {
    const selectedIds = new Set(selected || []);
    form.elements.namedItem('linkedPartIds').replaceChildren(...data.parts.map(part => {
      const option = document.createElement('option');
      option.value = part.id;
      option.textContent = `${part.id} · ${part.name}`;
      option.selected = selectedIds.has(part.id);
      return option;
    }));
  };
  const openMachineModal = machine => {
    if (!canEdit()) return;
    form.reset();
    form.dataset.machineId = machine?.id || '';
    document.querySelector('#machineEyebrow').textContent = machine ? 'MODIFICATION DE LA MACHINE' : 'NOUVELLE MACHINE';
    document.querySelector('#machineTitle').textContent = machine ? `Modifier ${machine.name}` : 'Ajouter une machine';
    form.elements.namedItem('name').value = machine?.name || '';
    form.elements.namedItem('comment').value = machine?.comment || '';
    fillPartOptions(machine?.linkedPartIds);
    errorBox.textContent = '';
    backdrop.classList.add('open');
    form.elements.namedItem('name').focus();
  };

  const baseRender = render;
  render = () => {
    machines();
    baseRender();
    if (view === 'moulds') document.querySelector('#mainAddBtn').textContent = mouldPage === 'machines' ? '＋ Ajouter une machine' : '＋ Ajouter un moule';
    if (view === 'machineDetail') {
      document.querySelector('#pageTitle').textContent = currentMachine()?.name || 'Machine';
      document.querySelector('.nav-item[data-view="moulds"]')?.classList.add('active');
      if (!currentMachine()) document.querySelector('#mainAddBtn').hidden = true;
    }
  };

  document.querySelector('#mainAddBtn').addEventListener('click', event => {
    if (view !== 'machineDetail' && (view !== 'moulds' || mouldPage !== 'machines')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (view !== 'machineDetail' || currentMachine()) openMachineModal(view === 'machineDetail' ? currentMachine() : null);
  }, true);


  document.addEventListener('click', async event => {
    const details = event.target.closest('[data-machine-detail]');
    if (details) {
      selectedMachineId = details.dataset.machineDetail;
      view = 'machineDetail';
      render();
      return;
    }
    if (event.target.closest('[data-back-machines]')) {
      selectedMachineId = '';
      view = 'moulds';
      mouldPage = 'machines';
      render();
      return;
    }
    const machineDetail = view === 'machineDetail' ? currentMachine() : null;
    if (event.target.closest('[data-add-machine-documents]') && machineDetail && window.MoldCloud?.canManageAttachments()) {
      documentsInput.dataset.machineId = machineDetail.id;
      documentsInput.value = '';
      documentsInput.click();
      return;
    }
    const removeDocument = event.target.closest('[data-remove-machine-document]');
    if (removeDocument && machineDetail && canEdit()) {
      const file = documentsFor(machineDetail).find(item => item.path === removeDocument.dataset.removeMachineDocument);
      if (!file || !confirm(`Supprimer le document ${file.name || ''} ?`)) return;
      removeDocument.disabled = true;
      try {
        await window.MoldCloud.removeAchatAttachment(file.path);
        const machine = machines().find(item => item.id === machineDetail.id);
        if (machine) {
          machine.documents = documentsFor(machine).filter(item => item.path !== file.path);
          save();
        }
        render();
        toast('Document supprimé');
      } catch (error) {
        removeDocument.disabled = false;
        toast(error.message || 'Impossible de supprimer le document');
      }
      return;
    }
    if (event.target.closest('[data-close-machine-modal]') || event.target === backdrop) {
      closeMachineModal();
      return;
    }
    const edit = event.target.closest('[data-edit-machine]');
    if (edit) {
      openMachineModal(machines().find(machine => machine.id === edit.dataset.editMachine));
      return;
    }
    const openFile = event.target.closest('[data-open-machine-file]');
    if (openFile) {
      const file = machineDetail && machineFiles(machineDetail).find(item => item.path === openFile.dataset.openMachineFile);
      if (!file) return toast('Fichier introuvable');
      openFile.disabled = true;
      try {
        const url = await window.MoldCloud.achatAttachmentUrl(file.path);
        if (!url) throw new Error('Fichier introuvable');
        if (window.ToolDocumentViewer) await window.ToolDocumentViewer.open(url, file);
        else if (!/\.(stl|obj|glb|gltf|stp|step)$/i.test(file.name || file.path)) window.open(url, '_blank', 'noopener');
      } catch (error) {
        toast(error.message || 'Impossible d’ouvrir le fichier');
      } finally {
        openFile.disabled = false;
      }
      return;
    }
    const deleteFile = event.target.closest('[data-delete-machine-file]');
    if (deleteFile && window.MoldCloud?.canManageAttachments()) {
      const machine = machines().find(item => item.id === deleteFile.dataset.deleteMachineFile);
      const kind = deleteFile.dataset.machineFileKind;
      const key = kind === '3d' ? 'model3d' : 'drawing2d';
      const file = machine?.[key];
      if (!file?.path || !confirm(`Supprimer le fichier ${kind.toUpperCase()} ${file.name || ''} ?`)) return;
      deleteFile.disabled = true;
      try {
        await window.MoldCloud.removeAchatAttachment(file.path);
        machine[key] = null;
        save();
        render();
        toast(`Fichier ${kind.toUpperCase()} supprimé`);
      } catch (error) {
        deleteFile.disabled = false;
        toast(error.message || `Impossible de supprimer le fichier ${kind.toUpperCase()}`);
      }
      return;
    }
    const remove = event.target.closest('[data-delete-machine]');
    if (!remove || !canEdit()) return;
    const machine = machines().find(item => item.id === remove.dataset.deleteMachine);
    if (machine && hasMachineFiles(machine) && !window.MoldCloud?.canManageAttachments()) return;
    if (!machine || !confirm(`Supprimer définitivement la machine ${machine.name} et ses fichiers ?`)) return;
    remove.disabled = true;
    try {
      const paths = new Set([...machineFiles(machine), ...machineBomFiles(machine)].map(file => file.path));
      await Promise.all([...paths].map(path => window.MoldCloud.removeAchatAttachment(path)));
      data.machines = machines().filter(item => item.id !== machine.id);
      save();
      render();
      toast('Machine supprimée');
    } catch (error) {
      remove.disabled = false;
      toast(error.message || 'Impossible de supprimer la machine');
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && backdrop.classList.contains('open')) closeMachineModal();
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!canEdit()) return;
    const existing = machines().find(machine => machine.id === form.dataset.machineId);
    if (form.dataset.machineId && !existing) return toast('Machine introuvable');
    errorBox.textContent = '';
    const name = form.elements.namedItem('name').value.trim();
    if (!name) {
      errorBox.textContent = 'Indiquez le nom de la machine.';
      return;
    }
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Enregistrement…';
    try {
      const fields = {
        name,
        linkedPartIds: [...form.elements.namedItem('linkedPartIds').selectedOptions].map(option => option.value),
        comment: form.elements.namedItem('comment').value.trim()
      };
      if (existing) Object.assign(existing, fields);
      else machines().unshift({id: nextMachineId(), ...fields});
      save();
      closeMachineModal();
      render();
      toast(existing ? 'Machine modifiée' : 'Machine ajoutée');
    } catch (error) {
      errorBox.textContent = error.message || 'Impossible d’enregistrer la machine.';
    } finally {
      submit.disabled = false;
      submit.textContent = 'Enregistrer la machine';
    }
  });

  machines();
  render();
})();
