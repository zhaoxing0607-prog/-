(() => {
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const drawingExtensions = /\.(pdf|jpe?g|png|webp)$/i;
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
    ? `<div class="bom-file-cell">${fileButton(file, kind)}${canEdit() ? `<button type="button" class="bom-file-delete" data-delete-bom-file="${escapeHtml(componentId)}" data-bom-file-kind="${kind}" title="Supprimer le fichier ${kind.toUpperCase()}" aria-label="Supprimer le fichier ${kind.toUpperCase()}">×</button>` : ''}</div>`
    : '<span class="bom-no-file">—</span>';

  const baseMouldDashboard = mouldDashboard;
  mouldDashboard = () => {
    const html = baseMouldDashboard();
    const mould = data.moulds.find(item => item.id === selectedMouldId);
    if (!mould) return html;
    const components = bomFor(mould);
    const rows = components.length ? components.map(component => `<tr>
      <td><span class="bom-component-id">${escapeHtml(component.id)}</span><b class="bom-component-name">${escapeHtml(component.name || 'Composant')}</b></td>
      <td>${escapeHtml(component.material || '—')}</td>
      <td>${component.heatTreated ? '<span class="bom-heat yes">Oui</span>' : '<span class="bom-heat">Non</span>'}</td>
      <td>${escapeHtml(component.heatTreated && component.hardness ? component.hardness : '—')}</td>
      <td>${fileCell(component.drawing2d, '2d', component.id)}</td>
      <td>${fileCell(component.model3d, '3d', component.id)}</td>
      <td>${canEdit() ? `<div class="bom-row-actions"><button type="button" data-edit-bom-component="${escapeHtml(component.id)}">Modifier</button><button type="button" class="danger" data-delete-bom-component="${escapeHtml(component.id)}">Supprimer</button></div>` : ''}</td>
    </tr>`).join('') : '<tr><td colspan="7"><div class="bom-empty">Aucun composant dans la nomenclature de ce moule.</div></td></tr>';
    return `${html}<section class="card mould-bom-card"><div class="card-head"><div><span class="section-kicker">NOMENCLATURE OUTILLAGE</span><h3>BOM · Composants du moule</h3><span class="sub">Caractéristiques, plans 2D et modèles 3D de chaque composant</span></div><div class="bom-head-actions"><span>${components.length} composant${components.length > 1 ? 's' : ''}</span>${canEdit() ? '<button type="button" class="primary" data-add-bom-component>＋ Ajouter un composant</button>' : ''}</div></div><div class="bom-table-wrap"><table class="bom-table"><thead><tr><th>Composant</th><th>Matière</th><th>Traitement thermique</th><th>Dureté</th><th>Plan 2D</th><th>Fichier 3D</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  };

  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="mouldBomBackdrop"><section class="modal bom-component-modal"><div class="modal-head"><div><span class="eyebrow" id="mouldBomEyebrow">NOUVEAU COMPOSANT</span><h2 id="mouldBomTitle">Ajouter un composant</h2></div><button class="close-btn" type="button" data-close-bom-modal title="Fermer" aria-label="Fermer la fenêtre">×</button></div><form id="mouldBomForm"><div class="form-grid"><div class="field full"><label>Nom du composant</label><input name="name" required maxlength="160" placeholder="Ex. Poinçon, matrice, éjecteur…"></div><div class="field"><label>Matière</label><input name="material" maxlength="100" placeholder="Ex. 1.2379, 42CrMo4…"></div><div class="field"><label class="bom-checkbox-label"><input name="heatTreated" type="checkbox"> Traitement thermique</label></div><div class="field"><label>Dureté</label><input name="hardness" maxlength="80" placeholder="Ex. 58–60 HRC"></div><div class="field full bom-file-field"><label>Plan 2D</label><input name="drawing2d" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"><small id="bomDrawingCurrent">PDF, JPG, PNG ou WEBP · 50 Mo maximum</small></div><div class="field full bom-file-field"><label>Fichier 3D</label><input name="model3d" type="file" accept=".stp,.step,.stl,.obj,.glb,.gltf,application/step,application/octet-stream"><small id="bomModelCurrent">STP, STEP, STL, OBJ, GLB ou GLTF · 50 Mo maximum</small></div><div class="ticket-form-error full" id="mouldBomError" role="alert"></div></div><div class="modal-actions"><button type="button" class="secondary" data-close-bom-modal>Annuler</button><button type="submit" class="primary">Enregistrer le composant</button></div></form></section></div>`);

  const backdrop = document.querySelector('#mouldBomBackdrop');
  const form = document.querySelector('#mouldBomForm');
  const errorBox = document.querySelector('#mouldBomError');
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
    if (!treated) hardness.value = '';
  };
  const openModal = component => {
    const mould = data.moulds.find(item => item.id === selectedMouldId);
    if (!mould || !canEdit()) return;
    form.reset();
    form.dataset.mouldId = mould.id;
    form.dataset.componentId = component?.id || '';
    document.querySelector('#mouldBomEyebrow').textContent = component ? 'MODIFICATION DU COMPOSANT' : 'NOUVEAU COMPOSANT';
    document.querySelector('#mouldBomTitle').textContent = component ? `Modifier ${component.name || component.id}` : 'Ajouter un composant';
    form.elements.namedItem('name').value = component?.name || '';
    form.elements.namedItem('material').value = component?.material || '';
    form.elements.namedItem('heatTreated').checked = Boolean(component?.heatTreated);
    form.elements.namedItem('hardness').value = component?.hardness || '';
    document.querySelector('#bomDrawingCurrent').textContent = component?.drawing2d?.name ? `Fichier actuel : ${component.drawing2d.name} · choisissez un fichier pour le remplacer` : 'PDF, JPG, PNG ou WEBP · 50 Mo maximum';
    document.querySelector('#bomModelCurrent').textContent = component?.model3d?.name ? `Fichier actuel : ${component.model3d.name} · choisissez un fichier pour le remplacer` : 'STP, STEP, STL, OBJ, GLB ou GLTF · 50 Mo maximum';
    errorBox.textContent = '';
    syncHardness();
    backdrop.classList.add('open');
    form.elements.namedItem('name').focus();
  };

  form.elements.namedItem('heatTreated').addEventListener('change', syncHardness);
  ['drawing2d', 'model3d'].forEach(name => form.elements.namedItem(name).addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) return;
    const size = `${(file.size / 1024 / 1024).toFixed(1)} Mo`;
    const help = document.querySelector(name === 'drawing2d' ? '#bomDrawingCurrent' : '#bomModelCurrent');
    help.textContent = `${file.name} · ${size}${file.size > MAX_FILE_SIZE ? ' · fichier trop volumineux' : ' · prêt à envoyer'}`;
    help.classList.toggle('error', file.size > MAX_FILE_SIZE);
  }));
  document.addEventListener('click', async event => {
    if (event.target.closest('[data-add-bom-component]')) {
      openModal(null);
      return;
    }
    const edit = event.target.closest('[data-edit-bom-component]');
    if (edit) {
      const mould = data.moulds.find(item => item.id === selectedMouldId);
      if (!mould) return;
      openModal(bomFor(mould).find(component => component.id === edit.dataset.editBomComponent));
      return;
    }
    if (event.target.closest('[data-close-bom-modal]') || event.target === backdrop) {
      closeModal();
      return;
    }
    const openFile = event.target.closest('[data-open-bom-file]');
    if (openFile) {
      const mould = data.moulds.find(item => item.id === selectedMouldId);
      if (!mould) return;
      const file = bomFor(mould).flatMap(component => [component.drawing2d, component.model3d]).filter(Boolean).find(item => item.path === openFile.dataset.openBomFile);
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
    const deleteFile = event.target.closest('[data-delete-bom-file]');
    if (deleteFile && canEdit()) {
      const mould = data.moulds.find(item => item.id === selectedMouldId);
      const component = mould && bomFor(mould).find(item => item.id === deleteFile.dataset.deleteBomFile);
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
    const mould = data.moulds.find(item => item.id === selectedMouldId);
    const component = bomFor(mould).find(item => item.id === remove.dataset.deleteBomComponent);
    if (!component || !confirm(`Supprimer définitivement le composant ${component.name || component.id} et ses fichiers ?`)) return;
    remove.disabled = true;
    try {
      await Promise.all([component.drawing2d, component.model3d].filter(file => file?.path).map(file => window.MoldCloud.removeAchatAttachment(file.path)));
      mould.bomComponents = bomFor(mould).filter(item => item.id !== component.id);
      save();
      render();
      toast('Composant supprimé');
    } catch (error) {
      remove.disabled = false;
      toast(error.message || 'Impossible de supprimer le composant');
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!canEdit()) return;
    const mould = data.moulds.find(item => item.id === form.dataset.mouldId);
    if (!mould) return;
    const existing = bomFor(mould).find(item => item.id === form.dataset.componentId);
    const previousDrawing = existing?.drawing2d || null;
    const previousModel = existing?.model3d || null;
    const drawingFile = form.elements.namedItem('drawing2d').files[0];
    const modelFile = form.elements.namedItem('model3d').files[0];
    errorBox.textContent = '';
    if (drawingFile && !drawingExtensions.test(drawingFile.name)) return void (errorBox.textContent = 'Plan 2D : utilisez PDF, JPG, PNG ou WEBP.');
    if (modelFile && !modelExtensions.test(modelFile.name)) return void (errorBox.textContent = 'Fichier 3D : utilisez STP, STEP, STL, OBJ, GLB ou GLTF.');
    if ([drawingFile, modelFile].filter(Boolean).some(file => file.size > MAX_FILE_SIZE)) return void (errorBox.textContent = 'Chaque fichier doit faire au maximum 50 Mo.');
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = drawingFile || modelFile ? 'Envoi des fichiers…' : 'Enregistrement…';
    const uploaded = [];
    try {
      let drawing2d = existing?.drawing2d || null;
      let model3d = existing?.model3d || null;
      const owner = `mould-${mould.id}-bom-${existing?.id || nextComponentId(mould)}`;
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
      const component = {
        id: existing?.id || nextComponentId(mould),
        name: form.elements.namedItem('name').value.trim(),
        material: form.elements.namedItem('material').value.trim(),
        heatTreated: form.elements.namedItem('heatTreated').checked,
        hardness: form.elements.namedItem('hardness').value.trim(),
        drawing2d,
        model3d
      };
      if (existing) Object.assign(existing, component);
      else bomFor(mould).push(component);
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
      submit.disabled = false;
      submit.textContent = 'Enregistrer le composant';
    }
  });
})();
