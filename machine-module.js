(() => {
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const drawingExtensions = /\.(pdf|jpe?g|png|webp)$/i;
  const modelExtensions = /\.(stl|obj|glb|gltf|stp|step)$/i;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const machines = () => {
    data.machines = Array.isArray(data.machines) ? data.machines : [];
    return data.machines;
  };
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
    return file?.path ? `<div class="machine-file-cell">${fileButton(file, kind)}${canEdit() ? `<button type="button" class="machine-file-delete" data-delete-machine-file="${escapeHtml(machine.id)}" data-machine-file-kind="${kind}" title="Supprimer le fichier ${kind.toUpperCase()}" aria-label="Supprimer le fichier ${kind.toUpperCase()}">×</button>` : ''}</div>` : '<span class="machine-empty-value">—</span>';
  };
  const machineListPage = () => {
    const query = document.querySelector('#globalSearch')?.value.trim().toLowerCase() || '';
    const rows = machines().filter(machine => !query || [machine.id, machine.name, machine.comment, ...(machine.linkedPartIds || [])].join(' ').toLowerCase().includes(query));
    return `${machineTabs('machines')}<div class="machine-toolbar"><div><b>Parc machines</b><span>Machines de production et documents associés</span></div><span>${rows.length} machine${rows.length > 1 ? 's' : ''}</span></div><div class="table-wrap machine-table-wrap"><table class="machine-table"><thead><tr><th>Machine</th><th>Pièces associées</th><th>Plan 2D</th><th>Fichier 3D</th><th>Commentaire</th><th>Actions</th></tr></thead><tbody>${rows.length ? rows.map(machine => `<tr><td><span class="machine-id">${escapeHtml(machine.id)}</span><b class="machine-name">${escapeHtml(machine.name)}</b></td><td><div class="machine-part-list">${partChips(machine)}</div></td><td>${fileCell(machine, '2d')}</td><td>${fileCell(machine, '3d')}</td><td class="machine-comment">${escapeHtml(machine.comment || '—')}</td><td><div class="machine-row-actions">${canEdit() ? `<button type="button" data-edit-machine="${escapeHtml(machine.id)}">Modifier</button><button type="button" class="danger" data-delete-machine="${escapeHtml(machine.id)}">Supprimer</button>` : ''}</div></td></tr>`).join('') : '<tr><td colspan="6"><div class="empty machine-empty">Aucune machine enregistrée.<br><small>Utilisez « Ajouter une machine » pour commencer.</small></div></td></tr>'}</tbody></table></div>`;
  };

  const baseListPage = listPage;
  listPage = type => {
    if (type === 'moulds' && mouldPage === 'machines') return machineListPage();
    let html = baseListPage(type);
    if (type !== 'moulds') return html;
    const thirdTab = '<button class="mould-page-tab" data-mould-page="machines"><strong>Machines</strong><span>Équipements, pièces et dossiers techniques</span></button>';
    return html.replace('<div class="mould-page-tabs">', '<div class="mould-page-tabs has-machines">').replace('</div><div class="toolbar">', `${thirdTab}</div><div class="toolbar">`);
  };

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="machineBackdrop"><section class="modal machine-modal"><div class="modal-head"><div><span class="eyebrow" id="machineEyebrow">NOUVELLE MACHINE</span><h2 id="machineTitle">Ajouter une machine</h2></div><button class="close-btn" type="button" data-close-machine-modal title="Fermer" aria-label="Fermer la fenêtre">×</button></div><form id="machineForm"><div class="form-grid"><div class="field full"><label>Nom de la machine</label><input name="name" required maxlength="160" placeholder="Ex. Presse 9500, machine de frappe…"></div><div class="field full"><label>Pièces associées</label><select name="linkedPartIds" multiple size="9"></select><small class="machine-multi-help">Sélection multiple · Ctrl / Cmd + clic</small></div><div class="field full"><label>Commentaire</label><textarea name="comment" maxlength="1000" placeholder="Informations techniques, emplacement ou remarques…"></textarea></div><div class="field full machine-upload-field"><label>Plan 2D</label><input name="drawing2d" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"><small id="machineDrawingCurrent">PDF, JPG, PNG ou WEBP · 50 Mo maximum</small></div><div class="field full machine-upload-field"><label>Fichier 3D</label><input name="model3d" type="file" accept=".stp,.step,.stl,.obj,.glb,.gltf,application/step,application/octet-stream"><small id="machineModelCurrent">STP, STEP, STL, OBJ, GLB ou GLTF · 50 Mo maximum</small></div><div class="ticket-form-error full" id="machineError" role="alert"></div></div><div class="modal-actions"><button type="button" class="secondary" data-close-machine-modal>Annuler</button><button type="submit" class="primary">Enregistrer la machine</button></div></form></section></div>`);

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
    document.querySelector('#machineDrawingCurrent').textContent = machine?.drawing2d?.name ? `Fichier actuel : ${machine.drawing2d.name} · choisissez un fichier pour le remplacer` : 'PDF, JPG, PNG ou WEBP · 50 Mo maximum';
    document.querySelector('#machineModelCurrent').textContent = machine?.model3d?.name ? `Fichier actuel : ${machine.model3d.name} · choisissez un fichier pour le remplacer` : 'STP, STEP, STL, OBJ, GLB ou GLTF · 50 Mo maximum';
    errorBox.textContent = '';
    backdrop.classList.add('open');
    form.elements.namedItem('name').focus();
  };

  const baseRender = render;
  render = () => {
    machines();
    baseRender();
    if (view === 'moulds') document.querySelector('#mainAddBtn').textContent = mouldPage === 'machines' ? '＋ Ajouter une machine' : '＋ Ajouter un moule';
  };

  document.querySelector('#mainAddBtn').addEventListener('click', event => {
    if (view !== 'moulds' || mouldPage !== 'machines') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMachineModal(null);
  }, true);

  ['drawing2d', 'model3d'].forEach(name => form.elements.namedItem(name).addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    const help = document.querySelector(name === 'drawing2d' ? '#machineDrawingCurrent' : '#machineModelCurrent');
    help.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} Mo${file.size > MAX_FILE_SIZE ? ' · fichier trop volumineux' : ' · prêt à envoyer'}`;
    help.classList.toggle('error', file.size > MAX_FILE_SIZE);
  }));

  document.addEventListener('click', async event => {
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
      const file = machines().flatMap(machine => [machine.drawing2d, machine.model3d]).filter(Boolean).find(item => item.path === openFile.dataset.openMachineFile);
      if (!file) return toast('Fichier introuvable');
      openFile.disabled = true;
      try {
        const url = await window.MoldCloud.achatAttachmentUrl(file.path);
        if (!url) throw new Error('Fichier introuvable');
        if (window.ToolDocumentViewer) await window.ToolDocumentViewer.open(url, file);
        else window.open(url, '_blank', 'noopener');
      } catch (error) {
        toast(error.message || 'Impossible d’ouvrir le fichier');
      } finally {
        openFile.disabled = false;
      }
      return;
    }
    const deleteFile = event.target.closest('[data-delete-machine-file]');
    if (deleteFile && canEdit()) {
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
    if (!machine || !confirm(`Supprimer définitivement la machine ${machine.name} et ses fichiers ?`)) return;
    remove.disabled = true;
    try {
      await Promise.all([machine.drawing2d, machine.model3d].filter(file => file?.path).map(file => window.MoldCloud.removeAchatAttachment(file.path)));
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

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!canEdit()) return;
    const existing = machines().find(machine => machine.id === form.dataset.machineId);
    const drawingFile = form.elements.namedItem('drawing2d').files[0];
    const modelFile = form.elements.namedItem('model3d').files[0];
    errorBox.textContent = '';
    if (drawingFile && !drawingExtensions.test(drawingFile.name)) return void (errorBox.textContent = 'Plan 2D : utilisez PDF, JPG, PNG ou WEBP.');
    if (modelFile && !modelExtensions.test(modelFile.name)) return void (errorBox.textContent = 'Fichier 3D : utilisez STP, STEP, STL, OBJ, GLB ou GLTF.');
    if ([drawingFile, modelFile].filter(Boolean).some(file => file.size > MAX_FILE_SIZE)) return void (errorBox.textContent = 'Chaque fichier doit faire au maximum 50 Mo.');
    const submit = form.querySelector('[type="submit"]');
    const previousDrawing = existing?.drawing2d || null;
    const previousModel = existing?.model3d || null;
    const machineId = existing?.id || nextMachineId();
    const uploaded = [];
    submit.disabled = true;
    submit.textContent = drawingFile || modelFile ? 'Envoi des fichiers…' : 'Enregistrement…';
    try {
      let drawing2d = existing?.drawing2d || null;
      let model3d = existing?.model3d || null;
      const showProgress = label => (uploadedBytes, totalBytes) => {
        const percent = Math.min(100, Math.round(uploadedBytes / Math.max(totalBytes, 1) * 100));
        submit.textContent = `Envoi ${label} · ${percent} %`;
      };
      if (drawingFile) {
        drawing2d = await window.MoldCloud.uploadAchatAttachment(`machine-${machineId}-2d`, drawingFile, showProgress('2D'));
        uploaded.push(drawing2d);
      }
      if (modelFile) {
        model3d = await window.MoldCloud.uploadAchatAttachment(`machine-${machineId}-3d`, modelFile, showProgress('3D'));
        uploaded.push(model3d);
      }
      const machine = {
        id: machineId,
        name: form.elements.namedItem('name').value.trim(),
        linkedPartIds: [...form.elements.namedItem('linkedPartIds').selectedOptions].map(option => option.value),
        comment: form.elements.namedItem('comment').value.trim(),
        drawing2d,
        model3d
      };
      if (existing) Object.assign(existing, machine);
      else machines().unshift(machine);
      save();
      closeMachineModal();
      render();
      const replaced = [drawingFile ? previousDrawing : null, modelFile ? previousModel : null].filter(file => file?.path && !uploaded.some(item => item.path === file.path));
      replaced.forEach(file => window.MoldCloud.removeAchatAttachment(file.path).catch(() => null));
      toast(existing ? 'Machine modifiée' : 'Machine ajoutée');
    } catch (error) {
      await Promise.all(uploaded.map(file => window.MoldCloud.removeAchatAttachment(file.path).catch(() => null)));
      errorBox.textContent = error.message || 'Impossible d’enregistrer la machine.';
    } finally {
      submit.disabled = false;
      submit.textContent = 'Enregistrer la machine';
    }
  });

  machines();
  render();
})();
