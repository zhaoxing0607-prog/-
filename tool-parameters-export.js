(() => {
  const selectedIds = {moulds: new Set(), parts: new Set()};
  const selectionText = (count, type) => type === 'parts'
    ? `${count} pièce${count === 1 ? '' : 's'} sélectionnée${count === 1 ? '' : 's'}`
    : `${count} outil${count === 1 ? '' : 's'} sélectionné${count === 1 ? '' : 's'}`;
  const presentNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) && number !== 0 ? number : '';
  };

  const previousListPage = listPage;
  listPage = type => {
    const html = previousListPage(type);
    if (type !== 'moulds' && type !== 'parts') return html;

    const parts = type === 'parts', kind = parts ? 'part' : 'mould', selected = selectedIds[type];
    const validIds = new Set(data[type].map(record => record.id));
    selected.forEach(id => { if (!validIds.has(id)) selected.delete(id); });
    const rowStart = new RegExp(`<tr(?: class="[^"]*")?>(?=<td><button class="relation-link" data-${kind}-link="([^"]+)")`, 'g');
    const visibleIds = [...html.matchAll(rowStart)].map(match => match[1]);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
    const count = selected.size;
    const actions = `<div class="tool-parameter-actions"><span data-tool-selection-count>${selectionText(count, type)}</span><button type="button" class="primary" data-export-tool-parameters="${type}" ${count ? '' : 'disabled'}>Exporter les paramètres en PDF</button></div>`;
    let output = parts
      ? html.replace('<div class="table-wrap">', `<div class="toolbar">${actions}</div><div class="table-wrap">`)
      : html.replace('<span class="sub">', `${actions}<span class="sub">`);
    output = output.replace(
      '<thead><tr>',
      `<thead><tr><th class="mould-select-column"><input type="checkbox" data-select-all-parameters="${type}" aria-label="${parts ? 'Sélectionner toutes les pièces affichées' : 'Sélectionner tous les outils affichés'}" ${allSelected ? 'checked' : ''} ${visibleIds.length ? '' : 'disabled'}></th>`
    );
    output = output.replace(
      rowStart,
      (match, id) => `${match}<td class="mould-select-column"><input type="checkbox" data-select-parameter="${escapeRepairActor(id)}" data-parameter-type="${type}" aria-label="Sélectionner ${escapeRepairActor(id)}" ${selected.has(id) ? 'checked' : ''}></td>`
    );
    return output.replace(/<td colspan="\d+" class="empty">/, `<td colspan="${defs[type].headers.length + 1}" class="empty">`);
  };

  function updateSelectionControls(type) {
    const boxes = [...content.querySelectorAll('[data-select-parameter]')];
    const selectAll = content.querySelector('[data-select-all-parameters]');
    const selectedVisible = boxes.filter(box => box.checked).length;
    if (selectAll) {
      selectAll.checked = boxes.length > 0 && selectedVisible === boxes.length;
      selectAll.indeterminate = selectedVisible > 0 && selectedVisible < boxes.length;
    }
    const count = selectedIds[type].size;
    const countLabel = content.querySelector('[data-tool-selection-count]');
    const exportButton = content.querySelector('[data-export-tool-parameters]');
    if (countLabel) countLabel.textContent = selectionText(count, type);
    if (exportButton) exportButton.disabled = count === 0;
  }

  content.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-select-parameter]');
    const selectAll = event.target.closest('[data-select-all-parameters]');
    if (!checkbox && !selectAll) return;
    event.stopImmediatePropagation();
    const type = checkbox?.dataset.parameterType || selectAll.dataset.selectAllParameters;
    const selected = selectedIds[type];
    if (checkbox) {
      if (checkbox.checked) selected.add(checkbox.dataset.selectParameter);
      else selected.delete(checkbox.dataset.selectParameter);
    } else {
      content.querySelectorAll('[data-select-parameter]').forEach(box => {
        box.checked = selectAll.checked;
        if (selectAll.checked) selected.add(box.dataset.selectParameter);
        else selected.delete(box.dataset.selectParameter);
      });
    }
    updateSelectionControls(type);
  }, true);

  content.addEventListener('click', event => {
    const button = event.target.closest('[data-export-tool-parameters]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const type = button.dataset.exportToolParameters;
    const parts = type === 'parts';
    const records = data[type].filter(record => selectedIds[type].has(record.id));
    if (!records.length) { toast(parts ? 'Sélectionnez au moins une pièce' : 'Sélectionnez au moins un outil'); return; }
    const rows = parts ? records.map(part => ({
      id: part.id,
      articleCode: articleCodeLabel(part),
      family: partFamily(part) || 'À classer',
      name: part.name,
      material: part.material,
      thickness: Number(part.thickness || 0),
      weight: Number(part.weight || 0),
      moulds: mouldIdsForPart(part).join(', '),
      comment: String(part.comment || '').trim(),
      validation: part.validationStatus || 'Non validé'
    })) : records.map(mould => ({
      toolNumber: mould.id || '',
      toolName: mould.name || '',
      category: mould.mouldCategory || mould.type || '',
      projectNumber: projectReference(mould.project).id || '',
      stripWidth: presentNumber(mould.stripWidth),
      pitch: presentNumber(mould.rollingPitch),
      thickness: presentNumber(mould.maxThickness)
    }));
    const pdf = window.MaterialPdfExport;
    const build = parts ? pdf?.buildPartParametersPdf : pdf?.buildToolParametersPdf;
    if (!build) {
      toast('Export PDF indisponible · rechargez la page');
      return;
    }
    pdf.download(build(rows), parts ? 'parametres-pieces.pdf' : 'parametres-moules.pdf');
    toast('Export PDF terminé');
  }, true);
})();
