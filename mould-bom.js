(() => {
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const drawingExtensions = /\.(pdf|dwg|jpe?g|png|webp)$/i;
  const modelExtensions = /\.(stl|obj|glb|gltf|stp|step)$/i;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const bomFor = mould => {
    mould.bomComponents = Array.isArray(mould.bomComponents) ? mould.bomComponents : [];
    return mould.bomComponents;
  };
  const nextComponentId = mould => {
    const highest = bomFor(mould).reduce((max, component) => {
      const number = Number(String(component.id || '').match(/\d+/)?.[0] || 0);
      return Math.max(max, number);
    }, 0);
    return `BOM-${String(highest + 1).padStart(3, '0')}`;
  };
  const fileButton = (file, kind) => file?.path
    ? `<button type="button" class="bom-file-button ${kind === '3d' ? 'is-3d' : ''}" data-open-bom-file="${escapeHtml(file.path)}"><span>${kind === '3d' ? '3D' : '2D'}</span><b title="${escapeHtml(file.name || 'Fichier')}">${escapeHtml(file.name || 'Fichier')}</b></button>`
    : '<span class="bom-no-file">—</span>';
  const fileCell = (file, kind, componentId) => file?.path
    ? `<div class="bom-file-cell">${fileButton(file, kind)}${window.MoldCloud?.canManageAttachments() ? `<button type="button" class="bom-file-delete" data-delete-bom-file="${escapeHtml(componentId)}" data-bom-file-kind="${kind}" title="Supprimer le fichier ${kind.toUpperCase()}" aria-label="Supprimer le fichier ${kind.toUpperCase()}">×</button>` : ''}</div>`
    : '<span class="bom-no-file">—</span>';

  const ownerFor = (kind, id) => (kind === 'machine' ? data.machines : data.moulds)?.find(item => item.id === id);
  const activeOwner = () => view === 'machineDetail' ? window.ToolMachineDetails?.current() : ownerFor('mould', selectedMouldId);
  const machineBoms = machine => Array.isArray(machine.bomLists) ? machine.bomLists : [];
  const bomRecord = (owner, listId) => listId ? machineBoms(owner).find(list => list.id === listId) : owner;
  const collapseState = new Map();
  const renderBomTable = (record, listId = '') => {
    const components = bomFor(record);
    const rows = components.length ? components.map(component => `<tr>
      <td><span class="bom-component-id">${escapeHtml(component.id)}</span><b class="bom-component-name">${escapeHtml(component.name || 'Composant')}</b>${component.isStandard ? `<span class="bom-standard-summary"><strong>Standard</strong>${component.supplier ? `<small>Fournisseur : ${escapeHtml(component.supplier)}</small>` : ''}${component.modelReference ? `<small>Modèle / réf. : ${escapeHtml(component.modelReference)}</small>` : ''}</span>` : ''}</td>
      <td>${escapeHtml(component.material || '—')}</td>
      <td>${component.heatTreated ? '<span class="bom-heat yes">Oui</span>' : '<span class="bom-heat">Non</span>'}</td>
      <td>${escapeHtml(component.heatTreated && component.hardness ? component.hardness : '—')}</td>
      <td>${fileCell(component.drawing2d, '2d', component.id)}</td>
      <td>${fileCell(component.model3d, '3d', component.id)}</td>
      <td class="bom-comment">${escapeHtml(component.comment || '—')}</td>
      <td>${canEdit() ? `<div class="bom-row-actions"><button type="button" data-edit-bom-component="${escapeHtml(component.id)}">Modifier</button><button type="button" class="danger" data-delete-bom-component="${escapeHtml(component.id)}">Supprimer</button></div>` : ''}</td>
    </tr>`).join('') : '<tr><td colspan="8"><div class="bom-empty">Aucun composant dans la nomenclature de cet équipement.</div></td></tr>';
    return `<div class="bom-head-actions"><span>${components.length} composant(s)</span>${canEdit() ? '<button type="button" class="primary" data-add-bom-component>＋ Ajouter un composant</button>' : ''}${canEdit() && listId !== null ? '<button type="button" class="secondary" data-rename-bom-list>Renommer le BOM</button>' : ''}</div><div class="bom-table-wrap"><table class="bom-table"><thead><tr><th>Composant</th><th>Matière</th><th>Traitement thermique</th><th>Dureté</th><th>Plan 2D</th><th>Fichier 3D</th><th>Commentaire</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  const renderBom = (owner, isMachine = false) => {
    if (!isMachine) return `<section class="card mould-bom-card"><span class="section-kicker">NOMENCLATURE OUTILLAGE</span><h3>BOM · Composants du moule</h3>${renderBomTable(owner, null)}</section>`;
    const legacy = bomFor(owner).length || owner.bomName ? [{id:'',name:owner.bomName || 'BOM principal',record:owner}] : [];
    const lists = [...legacy, ...machineBoms(owner).map(list => ({id:list.id,name:list.name,record:list}))];
    const panels = lists.map(({id,name,record}) => {
      const key = JSON.stringify([owner.id, id]);
      return `<details class="machine-bom-list" data-bom-list="${escapeHtml(id)}" data-bom-collapse-key="${escapeHtml(key)}" ${(collapseState.get(key) ?? !id) ? 'open' : ''}><summary><strong>${escapeHtml(name)}</strong> <span>${bomFor(record).length} composant(s)</span></summary><div class="machine-bom-body">${renderBomTable(record,id)}</div></details>`;
    }).join('');
    return `<section class="card mould-bom-card"><div class="card-head"><div><span class="section-kicker">NOMENCLATURE MACHINE</span><h3>BOM de la machine</h3></div>${canEdit() ? '<button type="button" class="primary" data-create-bom-list>＋ Nouveau BOM</button>' : ''}</div>${panels || '<p class="bom-empty">Aucun BOM associé à cette machine.</p>'}</section>`;
  };
  window.renderToolBom = renderBom;
  const baseMouldDashboard = mouldDashboard;
  mouldDashboard = () => {
    const mould = ownerFor('mould', selectedMouldId);
    return baseMouldDashboard() + (mould ? renderBom(mould) : '');
  };

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="mouldBomBackdrop"><section class="modal bom-component-modal" role="dialog" aria-modal="true" aria-labelledby="mouldBomTitle"><div class="modal-head"><div><span class="eyebrow" id="mouldBomEyebrow">NOUVEAU COMPOSANT</span><h2 id="mouldBomTitle">Ajouter un composant</h2></div></div><form id="mouldBomForm"><div class="form-grid"><div class="field full"><label>Nom du composant</label><input name="name" required maxlength="160" placeholder="Ex. Poinçon, matrice, éjecteur…"></div><div class="field"><label for="bomMaterial">Matière</label><input id="bomMaterial" name="material" list="bomMaterialOptions" maxlength="100" placeholder="Choisir ou saisir une matière"><datalist id="bomMaterialOptions"><option value="Cr12MoV"></option><option value="SKD11"></option><option value="45#"></option><option value="Z160"></option><option value="40CMD"></option></datalist></div><div class="field"><label class="bom-checkbox-label"><input name="heatTreated" type="checkbox"> Traitement thermique</label></div><div class="field"><label>Dureté</label><input name="hardness" maxlength="80" placeholder="Ex. 58–60 HRC"></div><div class="field"><label class="bom-checkbox-label"><input name="isStandard" type="checkbox"> Composant standard</label></div><div class="field bom-standard-field" hidden><label for="bomSupplier">Fournisseur (facultatif)</label><input id="bomSupplier" name="supplier" maxlength="160"></div><div class="field bom-standard-field" hidden><label for="bomModelReference">Modèle / référence (facultatif)</label><input id="bomModelReference" name="modelReference" maxlength="160"></div><div class="field full bom-file-field"><label>Plan 2D</label><input name="drawing2d" type="file" accept=".pdf,.dwg,.jpg,.jpeg,.png,.webp"><small id="bomDrawingCurrent">PDF, DWG, JPG, PNG ou WEBP · 50 Mo maximum</small></div><div class="field full bom-file-field"><label>Fichier 3D</label><input name="model3d" type="file" accept=".stp,.step,.stl,.obj,.glb,.gltf,application/step,application/octet-stream"><small id="bomModelCurrent">STP, STEP, STL, OBJ, GLB ou GLTF · 50 Mo maximum</small></div><div class="field full"><label for="bomComment">Commentaire (facultatif)</label><textarea id="bomComment" name="comment" rows="3" maxlength="1000"></textarea></div><div class="ticket-form-error full" id="mouldBomError" role="alert"></div></div><div class="modal-actions"><button type="button" class="secondary" data-close-bom-modal>Annuler</button><button type="submit" class="primary">Enregistrer le composant</button></div></form></section></div>`);

  const backdrop = document.querySelector('#mouldBomBackdrop');
  const form = document.querySelector('#mouldBomForm');
  const errorBox = document.querySelector('#mouldBomError');
  const cancel = form.querySelector('[data-close-bom-modal]');
  let saving = false;
  const closeModal = () => {
    backdrop.classList.remove('open');
    form.reset();
    form.dataset.componentId = '';
    errorBox.textContent = '';
  };
  const syncHardness = () => {
    const treated = form.elements.namedItem('heatTreated').checked;
    const hardness = form.elements.namedItem('hardness');
    hardness.disabled = !treated;
  };
  const syncStandardFields = () => {
    const standard = form.elements.namedItem('isStandard').checked;
    for (const name of ['supplier', 'modelReference']) {
      const input = form.elements.namedItem(name);
      input.disabled = !standard;
      input.closest('.bom-standard-field').hidden = !standard;
    }
  };
  const openModal = (component, listId = '') => {
    const mould = activeOwner();
    if (!mould || !canEdit() || backdrop.classList.contains('open')) return;
    form.reset();
    form.dataset.mouldId = mould.id;
    form.dataset.ownerKind = view === 'machineDetail' ? 'machine' : 'mould';
    form.dataset.componentId = component?.id || '';
    form.dataset.bomListId = listId;
    for (const input of form.querySelectorAll('input[type="file"]')) input.disabled = !window.MoldCloud?.canManageAttachments();
    document.querySelector('#mouldBomEyebrow').textContent = component ? 'MODIFICATION DU COMPOSANT' : 'NOUVEAU COMPOSANT';
    document.querySelector('#mouldBomTitle').textContent = component ? `Modifier ${component.name || component.id}` : 'Ajouter un composant';
    form.elements.namedItem('name').value = component?.name || '';
    form.elements.namedItem('material').value = component?.material || '';
    form.elements.namedItem('heatTreated').checked = Boolean(component?.heatTreated);
    form.elements.namedItem('hardness').value = component?.hardness || '';
    form.elements.namedItem('comment').value = component?.comment || '';
    form.elements.namedItem('isStandard').checked = Boolean(component?.isStandard);
    form.elements.namedItem('supplier').value = component?.supplier || '';
    form.elements.namedItem('modelReference').value = component?.modelReference || '';
    document.querySelector('#bomDrawingCurrent').textContent = component?.drawing2d?.name ? `Fichier actuel : ${component.drawing2d.name} · choisissez un fichier pour le remplacer` : 'PDF, DWG, JPG, PNG ou WEBP · 50 Mo maximum';
    document.querySelector('#bomModelCurrent').textContent = component?.model3d?.name ? `Fichier actuel : ${component.model3d.name} · choisissez un fichier pour le remplacer` : 'STP, STEP, STL, OBJ, GLB ou GLTF · 50 Mo maximum';
    errorBox.textContent = '';
    syncHardness();
    syncStandardFields();
    backdrop.classList.add('open');
    form.elements.namedItem('name').focus({preventScroll:true});
    backdrop.querySelector('.modal').scrollTop = 0;
  };

  form.elements.namedItem('heatTreated').addEventListener('change', syncHardness);
  form.elements.namedItem('isStandard').addEventListener('change', syncStandardFields);
  ['drawing2d', 'model3d'].forEach(name => form.elements.namedItem(name).addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    const size = `${(file.size / 1024 / 1024).toFixed(1)} Mo`;
    const help = document.querySelector(name === 'drawing2d' ? '#bomDrawingCurrent' : '#bomModelCurrent');
    help.textContent = `${file.name} · ${size}${file.size > MAX_FILE_SIZE ? ' · fichier trop volumineux' : ' · prêt à envoyer'}`;
    help.classList.toggle('error', file.size > MAX_FILE_SIZE);
  }));
  document.addEventListener('toggle', event => {
    const panel = event.target;
    if (panel.isConnected && panel.dataset?.bomCollapseKey) collapseState.set(panel.dataset.bomCollapseKey, panel.open);
  }, true);
  document.addEventListener('click', async event => {
    const listId = event.target.closest('[data-bom-list]')?.dataset.bomList || '';
    const createList = event.target.closest('[data-create-bom-list]');
    const renameList = event.target.closest('[data-rename-bom-list]');
    if (createList || renameList) {
      if (view !== 'machineDetail' || !canEdit()) return;
      const machine = activeOwner();
      const list = machine && bomRecord(machine, listId);
      if (!list) return;
      const previous = createList ? '' : listId ? list.name : machine.bomName || 'BOM principal';
      const answer = window.prompt(createList ? 'Nom du nouveau BOM' : 'Nouveau nom du BOM', previous);
      if (answer === null) return;
      const name = answer.trim();
      if (!name || name.length > 160) return toast('Saisissez un nom de 1 à 160 caractères.');
      if (createList) {
        const id = 'LIST-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        machine.bomLists = [...machineBoms(machine), {id,name,bomComponents:[]}];
        collapseState.set(JSON.stringify([machine.id,id]), true);
      } else if (listId) list.name = name;
      else machine.bomName = name;
      save();
      render();
      return;
    }
    if (event.target.closest('[data-add-bom-component]')) {
      openModal(null, listId);
      return;
    }
    const edit = event.target.closest('[data-edit-bom-component]');
    if (edit) {
      const mould = activeOwner();
      if (!mould) return;
      const list = bomRecord(mould, listId);
      const component = list && bomFor(list).find(item => item.id === edit.dataset.editBomComponent);
      if (component) openModal(component, listId);
      else toast('Composant introuvable');
      return;
    }
    if (event.target.closest('[data-close-bom-modal]')) {
      if (!saving) closeModal();
      return;
    }
    const openFile = event.target.closest('[data-open-bom-file]');
    if (openFile) {
      const mould = activeOwner();
      if (!mould) return;
      const list = bomRecord(mould, listId);
      const file = list && bomFor(list).flatMap(component => [component.drawing2d, component.model3d]).filter(Boolean).find(item => item.path === openFile.dataset.openBomFile);
      if (!file) return toast('Fichier introuvable');
      openFile.disabled = true;
      try {
        const url = await window.MoldCloud.achatAttachmentUrl(file.path);
        if (!url) throw new Error('Fichier introuvable');
        if (window.ToolDocumentViewer) await window.ToolDocumentViewer.open(url, file);
        else if (!modelExtensions.test(file.name || file.path)) window.open(url, '_blank', 'noopener');
      } catch (error) {
        toast(error.message || 'Impossible d’ouvrir le fichier');
      } finally {
        openFile.disabled = false;
      }
      return;
    }
    const deleteFile = event.target.closest('[data-delete-bom-file]');
    if (deleteFile && window.MoldCloud?.canManageAttachments()) {
      const mould = activeOwner();
      const list = mould && bomRecord(mould, listId);
      const component = list && bomFor(list).find(item => item.id === deleteFile.dataset.deleteBomFile);
      const kind = deleteFile.dataset.bomFileKind;
      const key = kind === '3d' ? 'model3d' : 'drawing2d';
      const file = component?.[key];
      if (!file?.path || !confirm(`Supprimer le fichier ${kind.toUpperCase()} ${file.name || ''} ?`)) return;
      deleteFile.disabled = true;
      try {
        await window.MoldCloud.removeAchatAttachment(file.path);
        component[key] = null;
        save();
        render();
        toast(`Fichier ${kind.toUpperCase()} supprimé`);
      } catch (error) {
        deleteFile.disabled = false;
        toast(error.message || `Impossible de supprimer le fichier ${kind.toUpperCase()}`);
      }
      return;
    }
    const remove = event.target.closest('[data-delete-bom-component]');
    if (!remove || !canEdit()) return;
    const mould = activeOwner();
    const list = mould && bomRecord(mould, listId);
    const component = list && bomFor(list).find(item => item.id === remove.dataset.deleteBomComponent);
    if ((component?.drawing2d?.path || component?.model3d?.path) && !window.MoldCloud?.canManageAttachments()) return toast('Les pièces jointes sont en lecture seule pour ce compte.');
    if (!component || !confirm(`Supprimer définitivement le composant ${component.name || component.id} et ses fichiers ?`)) return;
    const isLegacyMachineBom = view === 'machineDetail' && !listId;
    remove.disabled = true;
    try {
      await Promise.all([component.drawing2d, component.model3d].filter(file => file?.path).map(file => window.MoldCloud.removeAchatAttachment(file.path)));
      if (isLegacyMachineBom && !mould.bomName) mould.bomName = 'BOM principal';
      list.bomComponents = bomFor(list).filter(item => item.id !== component.id);
      save();
      render();
      toast('Composant supprimé');
    } catch (error) {
      remove.disabled = false;
      toast(error.message || 'Impossible de supprimer le composant');
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!canEdit() || saving || !backdrop.classList.contains('open')) return;
    const {ownerKind, mouldId, componentId, bomListId} = form.dataset;
    const mould = ownerFor(ownerKind, mouldId);
    const list = mould && bomRecord(mould, bomListId);
    if (!list) {
      errorBox.textContent = 'BOM introuvable.';
      return;
    }
    if (componentId && !bomFor(list).some(item => item.id === componentId)) {
      errorBox.textContent = 'Ce composant n’existe plus.';
      return;
    }
    const drawingFile = form.elements.namedItem('drawing2d').files[0];
    const modelFile = form.elements.namedItem('model3d').files[0];
    errorBox.textContent = '';
    if ((drawingFile || modelFile) && !window.MoldCloud?.canManageAttachments()) return void (errorBox.textContent = 'Les pièces jointes sont en lecture seule pour ce compte.');
    if (drawingFile && !drawingExtensions.test(drawingFile.name)) return void (errorBox.textContent = 'Plan 2D : utilisez PDF, DWG, JPG, PNG ou WEBP.');
    if (modelFile && !modelExtensions.test(modelFile.name)) return void (errorBox.textContent = 'Fichier 3D : utilisez STP, STEP, STL, OBJ, GLB ou GLTF.');
    if ([drawingFile, modelFile].filter(Boolean).some(file => file.size > MAX_FILE_SIZE)) return void (errorBox.textContent = 'Chaque fichier doit faire au maximum 50 Mo.');
    const isStandard = form.elements.namedItem('isStandard').checked;
    const fields = {
      name: form.elements.namedItem('name').value.trim(),
      material: form.elements.namedItem('material').value.trim(),
      heatTreated: form.elements.namedItem('heatTreated').checked,
      hardness: form.elements.namedItem('hardness').value.trim(),
      comment: form.elements.namedItem('comment').value.trim(),
      isStandard,
      supplier: isStandard ? form.elements.namedItem('supplier').value.trim() : '',
      modelReference: isStandard ? form.elements.namedItem('modelReference').value.trim() : ''
    };
    const submit = form.querySelector('[type="submit"]');
    saving = true;
    cancel.disabled = true;
    submit.disabled = true;
    submit.textContent = drawingFile || modelFile ? 'Envoi des fichiers…' : 'Enregistrement…';
    const uploaded = [];
    try {
      let drawing2d, model3d;
      const owner = `${ownerKind}-${mouldId}-${bomListId ? bomListId + '-' : ''}bom-${componentId || nextComponentId(list)}`;
      const showProgress = label => (uploadedBytes, totalBytes) => {
        const percent = Math.min(100, Math.round(uploadedBytes / Math.max(totalBytes, 1) * 100));
        submit.textContent = `Envoi ${label} · ${percent} %`;
      };
      if (drawingFile) {
        drawing2d = await window.MoldCloud.uploadAchatAttachment(`${owner}-2d`, drawingFile, showProgress('2D'));
        uploaded.push(drawing2d);
      }
      if (modelFile) {
        model3d = await window.MoldCloud.uploadAchatAttachment(`${owner}-3d`, modelFile, showProgress('3D'));
        uploaded.push(model3d);
      }
      const currentMould = ownerFor(ownerKind, mouldId);
      const currentList = currentMould && bomRecord(currentMould, bomListId);
      if (!currentList) throw new Error('BOM introuvable.');
      const existing = bomFor(currentList).find(item => item.id === componentId);
      if (componentId && !existing) throw new Error('Ce composant n’existe plus.');
      const previousDrawing = existing?.drawing2d;
      const previousModel = existing?.model3d;
      const component = {
        id: componentId || nextComponentId(currentList),
        ...fields,
        drawing2d: drawing2d ?? previousDrawing ?? null,
        model3d: model3d ?? previousModel ?? null
      };
      if (existing) Object.assign(existing, component);
      else bomFor(currentList).push(component);
      save();
      closeModal();
      render();
      const replaced = [drawingFile ? previousDrawing : null, modelFile ? previousModel : null].filter(file => file?.path && !uploaded.some(item => item.path === file.path));
      replaced.forEach(file => window.MoldCloud.removeAchatAttachment(file.path).catch(() => null));
      toast(existing ? 'Composant modifié' : 'Composant ajouté au BOM');
    } catch (error) {
      await Promise.all(uploaded.map(file => window.MoldCloud.removeAchatAttachment(file.path).catch(() => null)));
      const message = error.message || 'Impossible d’enregistrer le composant.';
      errorBox.textContent = /maximum allowed size|exceeded|max.*size|too large|payload/i.test(message)
        ? 'Le fichier dépasse la limite actuelle du stockage cloud. La limite doit être réglée à 50 Mo dans Supabase.'
        : message;
    } finally {
      saving = false;
      cancel.disabled = false;
      submit.disabled = false;
      submit.textContent = 'Enregistrer le composant';
    }
  });
})();
