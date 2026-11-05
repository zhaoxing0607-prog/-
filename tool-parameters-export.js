(() => {
  const selectedMouldIds = new Set();
  const presentNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) && number !== 0 ? number : '';
  };

  const previousListPage = listPage;
  listPage = type => {
    const html = previousListPage(type);
    if (type !== 'moulds') return html;

    const validIds = new Set(data.moulds.map(mould => mould.id));
    [...selectedMouldIds].forEach(id => { if (!validIds.has(id)) selectedMouldIds.delete(id); });
    const visibleIds = [...new Set([...html.matchAll(/data-mould-link="([^"]+)"/g)].map(match => match[1]))];
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedMouldIds.has(id));
    const count = selectedMouldIds.size;
    let output = html.replace(
      '<span class="sub">',
      `<div class="tool-parameter-actions"><span data-tool-selection-count>${count} outil${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}</span><button class="primary" data-export-tool-parameters ${count ? '' : 'disabled'}>Exporter PARAMÈTRES OUTIL</button></div><span class="sub">`
    );
    output = output.replace(
      '<thead><tr>',
      `<thead><tr><th class="mould-select-column"><input type="checkbox" data-select-all-moulds aria-label="Sélectionner tous les outils affichés" ${allSelected ? 'checked' : ''}></th>`
    );
    output = output.replace(
      /<tr class="([^"]*)">(?=<td><button class="relation-link" data-mould-link="([^"]+)")/g,
      (match, rowClass, id) => `${match}<td class="mould-select-column"><input type="checkbox" data-select-mould="${id}" aria-label="Sélectionner ${id}" ${selectedMouldIds.has(id) ? 'checked' : ''}></td>`
    );
    return output.replace('colspan="12"', 'colspan="13"');
  };

  function updateSelectionControls() {
    const boxes = [...content.querySelectorAll('[data-select-mould]')];
    const selectAll = content.querySelector('[data-select-all-moulds]');
    const selectedVisible = boxes.filter(box => box.checked).length;
    if (selectAll) {
      selectAll.checked = boxes.length > 0 && selectedVisible === boxes.length;
      selectAll.indeterminate = selectedVisible > 0 && selectedVisible < boxes.length;
    }
    const count = selectedMouldIds.size;
    const countLabel = content.querySelector('[data-tool-selection-count]');
    const exportButton = content.querySelector('[data-export-tool-parameters]');
    if (countLabel) countLabel.textContent = `${count} outil${count > 1 ? 's' : ''} sélectionné${count > 1 ? 's' : ''}`;
    if (exportButton) exportButton.disabled = count === 0;
  }

  content.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-select-mould]');
    const selectAll = event.target.closest('[data-select-all-moulds]');
    if (!checkbox && !selectAll) return;
    event.stopImmediatePropagation();
    if (checkbox) {
      if (checkbox.checked) selectedMouldIds.add(checkbox.dataset.selectMould);
      else selectedMouldIds.delete(checkbox.dataset.selectMould);
    } else {
      content.querySelectorAll('[data-select-mould]').forEach(box => {
        box.checked = selectAll.checked;
        if (selectAll.checked) selectedMouldIds.add(box.dataset.selectMould);
        else selectedMouldIds.delete(box.dataset.selectMould);
      });
    }
    updateSelectionControls();
  }, true);

  content.addEventListener('click', event => {
    const button = event.target.closest('[data-export-tool-parameters]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const moulds = data.moulds.filter(mould => selectedMouldIds.has(mould.id));
    if (!moulds.length) { toast('Sélectionnez au moins un outil'); return; }
    const rows = moulds.map(mould => ({
      toolNumber: mould.id || '',
      toolName: mould.name || '',
      category: mould.mouldCategory || mould.type || '',
      projectNumber: projectReference(mould.project).id || '',
      stripWidth: presentNumber(mould.stripWidth),
      pitch: presentNumber(mould.rollingPitch),
      thickness: presentNumber(mould.maxThickness)
    }));
    if (!window.NomenclatureXlsx?.downloadToolParameters) {
      toast('Export Excel indisponible · rechargez la page');
      return;
    }
    window.NomenclatureXlsx.downloadToolParameters(rows);
    toast(`${rows.length} outil${rows.length > 1 ? 's' : ''} exporté${rows.length > 1 ? 's' : ''}`);
  }, true);
})();
