(() => {
  const calculatorView = 'materials';
  const calculatorModalId = 'materialCalculatorBackdrop';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number = value => Number(String(value ?? 0).replace(',', '.')) || 0;
  const weightLabel = grams => grams >= 1000 ? `${(grams / 1000).toLocaleString('fr-FR', {maximumFractionDigits:3})} kg` : `${grams.toLocaleString('fr-FR', {maximumFractionDigits:2})} g`;
  const costLabel = euros => `${number(euros).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2})} €`;
  const dimensionLabel = value => number(value) ? `${number(value).toLocaleString('fr-FR', {maximumFractionDigits:3})} mm` : 'À renseigner';
  let editingId = '';

  const ensureStore = () => { data.materialCalculations = Array.isArray(data.materialCalculations) ? data.materialCalculations : []; };
  ensureStore();
  meta[calculatorView] = ['Calcul matière initiale', 'Calculez le poids, la largeur et l’épaisseur de la bande', '＋ Nouveau projet'];

  const openModalBeforeLegacyInox = openModal;
  openModal = (type, record = null) => {
    openModalBeforeLegacyInox(type, record);
    if (type !== 'parts' || !legacyInoxMaterials.includes(record?.material)) return;
    const materialField = document.getElementById('entityForm').elements.namedItem('material');
    if (!materialField) return;
    const option = document.createElement('option');
    option.value = record.material;
    option.textContent = `${record.material} · préciser Inox 304 ou Inox 316L`;
    materialField.prepend(option);
    materialField.value = record.material;
  };

  const reportsButton = document.querySelector('#nav [data-view="reports"]');
  if (reportsButton && !document.querySelector(`#nav [data-view="${calculatorView}"]`)) {
    reportsButton.insertAdjacentHTML('beforebegin', `<button class="nav-item" data-view="${calculatorView}"><i>▧</i>Calcul matière</button>`);
  }

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop" id="${calculatorModalId}">
      <section class="modal material-modal">
        <div class="modal-head"><div><span class="eyebrow" id="materialCalculatorEyebrow">NOUVEAU</span><h2 id="materialCalculatorTitle">Nouveau projet matière</h2></div><button class="close-btn" type="button" data-close-material-calculator aria-label="Fermer">×</button></div>
        <form id="materialCalculatorForm">
          <div class="material-project-fields"><label class="field"><span>Nom du projet / calcul</span><input name="name" required maxlength="160" placeholder="Ex. Série ASTOR KDR 28"></label><label class="field"><span>Date</span><input name="created" type="date" required></label></div>
          <div class="material-project-supply"><div class="material-shared-title"><b>Bande initiale commune</b><span>Cette même bande est utilisée pour toutes les pièces du projet.</span></div><label>Approvisionnement<select name="supplyMode"><option value="precut">Bande prédécoupée</option><option value="slit">Bande mère à découper</option></select></label><label class="project-slit-only">Largeur bande mère (mm)<input name="sourceWidth" type="number" min="0" step="any" placeholder="Ex. 1000"></label><label>Prix de la bande (€/kg)<input name="unitPrice" type="number" min="0" step="any" placeholder="Ex. 2,50"></label></div>
          <div class="material-lines" id="materialCalculatorLines"></div>
          <button class="secondary material-add-line" type="button" data-add-material-line>＋ Ajouter une pièce</button>
          <div class="material-live-summary" id="materialLiveSummary"></div>
          <div class="modal-actions"><button type="button" class="secondary" data-close-material-calculator>Annuler</button><button type="submit" class="primary">Enregistrer le calcul</button></div>
        </form>
      </section>
    </div>`);

  const modal = document.getElementById(calculatorModalId);
  const form = document.getElementById('materialCalculatorForm');
  const lines = document.getElementById('materialCalculatorLines');
  const linkedMoulds = part => {
    const ids = new Set(part?.relatedMouldIds || []);
    data.moulds.forEach(mould => { if ((mould.linkedPartIds || []).includes(part?.id)) ids.add(mould.id); });
    return [...ids].map(id => data.moulds.find(mould => mould.id === id)).filter(Boolean);
  };
  const partById = id => data.parts.find(part => part.id === id);
  const mouldById = id => data.moulds.find(mould => mould.id === id);
  const nextCalculationId = () => {
    const max = data.materialCalculations.reduce((highest, record) => Math.max(highest, number(String(record.id || '').match(/\d+/)?.[0])), 0);
    return `CM-${String(max + 1).padStart(4, '0')}`;
  };

  const supplyFromRecord = record => {
    const legacy = record?.items?.[0] || {};
    const supplyMode = (record?.supplyMode || legacy.supplyMode) === 'slit' ? 'slit' : 'precut';
    return {
      supplyMode,
      sourceWidth: record?.sourceWidth ?? legacy.sourceWidth ?? '',
      unitPrice: record?.unitPrice ?? legacy.unitPrice ?? (supplyMode === 'slit' ? legacy.sourcePrice : legacy.precutPrice) ?? ''
    };
  };
  const currentSupply = () => ({supplyMode: form.elements.supplyMode.value, sourceWidth: form.elements.sourceWidth.value, unitPrice: form.elements.unitPrice.value});

  function calculateItem(item, sharedSupply = null) {
    const part = partById(item.partId), mould = mouldById(item.mouldId), quantity = Math.max(0, number(item.quantity));
    const unitWeight = number(part?.weight), utilization = number(mould?.utilization);
    const width = number(mould?.stripWidth), thickness = number(mould?.maxThickness) || number(part?.thickness);
    const finishedWeight = unitWeight * quantity, rawWeight = utilization > 0 ? finishedWeight / (utilization / 100) : 0;
    const supply = sharedSupply || item;
    const supplyMode = supply.supplyMode === 'slit' ? 'slit' : 'precut', sourceWidth = number(supply.sourceWidth);
    const unitPrice = number(supply.unitPrice ?? (supplyMode === 'slit' ? supply.sourcePrice : supply.precutPrice));
    const rollCount = width > 0 && sourceWidth >= width ? Math.floor(sourceWidth / width) : 0;
    const leftoverWidth = rollCount ? sourceWidth - rollCount * width : 0, slitYield = sourceWidth > 0 ? rollCount * width / sourceWidth : 0;
    const purchaseWeight = supplyMode === 'slit' ? (rawWeight > 0 && slitYield > 0 ? rawWeight / slitYield : 0) : rawWeight;
    const leftoverWeight = supplyMode === 'slit' ? Math.max(0, purchaseWeight - rawWeight) : 0;
    const selectedCost = purchaseWeight / 1000 * unitPrice;
    const warnings = [];
    if (!part) warnings.push('Pièce introuvable');
    if (!mould) warnings.push('Choisir le moule associé');
    if (!unitWeight) warnings.push('Poids unitaire manquant');
    if (!utilization) warnings.push('Taux d’utilisation manquant');
    if (!width) warnings.push('Largeur de bande manquante');
    if (!thickness) warnings.push('Épaisseur manquante');
    return {part, mould, quantity, unitWeight, utilization, width, thickness, finishedWeight, rawWeight, supplyMode, sourceWidth, unitPrice, rollCount, leftoverWidth, slitYield, purchaseWeight, leftoverWeight, selectedCost, warnings};
  }

  const itemSummary = (item, supply = currentSupply()) => {
    const calc = calculateItem(item, supply);
    return `<span>Poids nécessaire : <b>${calc.rawWeight ? weightLabel(calc.rawWeight) : 'À calculer'}</b></span><span>Largeur utile : <b>${dimensionLabel(calc.width)}</b></span><span>Épaisseur : <b>${dimensionLabel(calc.thickness)}</b></span>${calc.warnings.map(warning => `<span class="warning">${safe(warning)}</span>`).join('')}`;
  };

  function optimizeSharedCut(calculations, sourceWidth) {
    const usable = calculations.map((calc, index) => ({index, width:number(calc.width), remaining:calc.width > 0 ? calc.rawWeight / calc.width : 0})).filter(item => item.width > 0 && item.remaining > 0 && item.width <= sourceWidth);
    const segments = [];
    const epsilon = 1e-7;
    for (let guard = 0; guard < 500 && usable.some(item => item.remaining > epsilon); guard += 1) {
      const active = usable.filter(item => item.remaining > epsilon);
      const candidates = [];
      active.forEach(item => {
        const count = Math.floor(sourceWidth / item.width);
        if (count > 0) candidates.push({counts:{[item.index]:count}, usedWidth:count * item.width, mixed:false});
      });
      for (let a = 0; a < active.length; a += 1) {
        for (let b = a + 1; b < active.length; b += 1) {
          const first = active[a], second = active[b], maxFirst = Math.floor(sourceWidth / first.width);
          for (let firstCount = 1; firstCount <= maxFirst; firstCount += 1) {
            const secondCount = Math.floor((sourceWidth - firstCount * first.width) / second.width);
            if (secondCount > 0) candidates.push({counts:{[first.index]:firstCount,[second.index]:secondCount}, usedWidth:firstCount * first.width + secondCount * second.width, mixed:true});
          }
        }
      }
      const mixed = candidates.filter(candidate => candidate.mixed);
      const pool = active.length > 1 && mixed.length ? mixed : candidates;
      const pattern = pool.sort((a,b) => b.usedWidth - a.usedWidth)[0];
      if (!pattern) break;
      const run = Math.min(...Object.entries(pattern.counts).map(([index,count]) => usable.find(item => item.index === number(index)).remaining / count));
      const sourceWeight = sourceWidth * run, leftoverWidth = Math.max(0, sourceWidth - pattern.usedWidth), leftoverWeight = leftoverWidth * run;
      Object.entries(pattern.counts).forEach(([index,count]) => { const item = usable.find(entry => entry.index === number(index)); item.remaining = Math.max(0, item.remaining - run * count); });
      segments.push({counts:pattern.counts, usedWidth:pattern.usedWidth, leftoverWidth, sourceWeight, leftoverWeight});
    }
    return segments;
  }

  const cutPlanHtml = (segments, calculations) => segments.length ? `<div class="material-cut-plan">${segments.map((segment,index) => { const cuts = Object.entries(segment.counts).map(([itemIndex,count]) => { const calc = calculations[number(itemIndex)]; return `${count} × ${dimensionLabel(calc.width)} (${safe(calc.part?.name || calc.part?.id || 'Pièce')})`; }).join(' + '); const leftoverWidth = `${number(segment.leftoverWidth).toLocaleString('fr-FR', {maximumFractionDigits:3})} mm`; return `<span><b>Découpe ${index + 1}</b>${cuts}<small>Reste ${leftoverWidth} · ${weightLabel(segment.leftoverWeight)}</small></span>`; }).join('')}</div>` : '';

  function projectTotals(items, supply) {
    const calculations = items.map(item => calculateItem(item, supply));
    const materials = [...new Set(calculations.map(calc => calc.part?.material).filter(Boolean))];
    const thicknesses = [...new Set(calculations.map(calc => number(calc.thickness)).filter(Boolean))];
    const widths = [...new Set(calculations.map(calc => number(calc.width)).filter(Boolean))];
    const warnings = [];
    if (!number(supply.unitPrice)) warnings.push('Prix par kilogramme manquant');
    if (supply.supplyMode === 'slit' && !number(supply.sourceWidth)) warnings.push('Largeur de bande mère manquante');
    if (materials.length > 1) warnings.push(`Matières incompatibles pour une bande commune : ${materials.join(' / ')}`);
    if (thicknesses.length > 1) warnings.push(`Épaisseurs incompatibles pour une bande commune : ${thicknesses.map(dimensionLabel).join(' / ')}`);
    if (supply.supplyMode !== 'slit' && widths.length > 1) warnings.push(`Largeurs incompatibles pour une bande prédécoupée commune : ${widths.map(dimensionLabel).join(' / ')}`);
    if (supply.supplyMode === 'slit' && widths.some(width => width > number(supply.sourceWidth))) warnings.push('La bande mère est plus étroite que l’une des bandes nécessaires');
    const canOptimize = supply.supplyMode === 'slit' && number(supply.sourceWidth) > 0 && materials.length <= 1 && thicknesses.length <= 1;
    const segments = canOptimize ? optimizeSharedCut(calculations, number(supply.sourceWidth)) : [];
    const requiredWeight = calculations.reduce((sum, calc) => sum + calc.rawWeight, 0);
    const purchaseWeight = canOptimize ? segments.reduce((sum, segment) => sum + segment.sourceWeight, 0) : requiredWeight;
    const leftoverWeight = canOptimize ? segments.reduce((sum, segment) => sum + segment.leftoverWeight, 0) : 0;
    return {
      calculations,
      requiredWeight,
      purchaseWeight,
      leftoverWeight,
      totalCost: purchaseWeight / 1000 * number(supply.unitPrice),
      segments,
      warnings
    };
  }

  function partOptions(selected = '') {
    return `<option value="">Sélectionner une pièce</option>${[...data.parts].sort((a,b) => a.id.localeCompare(b.id, 'fr', {numeric:true})).map(part => `<option value="${safe(part.id)}" ${part.id === selected ? 'selected' : ''}>${safe(part.id)} · ${safe(part.name)}</option>`).join('')}`;
  }
  function mouldOptions(partId, selected = '') {
    const moulds = linkedMoulds(partById(partId));
    return `<option value="">${partId ? (moulds.length ? 'Sélectionner le moule de la pièce' : 'Aucun moule associé à cette pièce') : 'Sélectionner d’abord une pièce'}</option>${moulds.map(mould => `<option value="${safe(mould.id)}" ${mould.id === selected ? 'selected' : ''}>${safe(mould.id)} · ${safe(mould.name)}</option>`).join('')}`;
  }
  function addLine(item = {}) {
    const row = document.createElement('div');
    row.className = 'material-line';
    row.innerHTML = `<label>Pièce<select name="partId" required>${partOptions(item.partId)}</select></label><label>Quantité<input name="quantity" type="number" min="0.01" step="any" required value="${safe(item.quantity || 1)}"></label><label class="material-mould-field">Moule associé<select name="mouldId" required>${mouldOptions(item.partId, item.mouldId)}</select></label><button class="danger material-remove-line" type="button" data-remove-material-line>Supprimer</button><div class="material-line-summary">${itemSummary(item)}</div>`;
    lines.appendChild(row);
  }
  function rowItem(row) {
    return {partId: row.querySelector('[name="partId"]').value, quantity: row.querySelector('[name="quantity"]').value, mouldId: row.querySelector('[name="mouldId"]').value};
  }
  function currentItems() { return [...lines.querySelectorAll('.material-line')].map(rowItem); }
  function toggleSupplyFields() { form.querySelectorAll('.project-slit-only').forEach(field => field.hidden = form.elements.supplyMode.value !== 'slit'); }
  function refreshAllRows() { [...lines.querySelectorAll('.material-line')].forEach(row => { row.querySelector('.material-line-summary').innerHTML = itemSummary(rowItem(row)); }); updateLiveSummary(); }
  function updateRow(row, partChanged = false) {
    if (partChanged) row.querySelector('[name="mouldId"]').innerHTML = mouldOptions(row.querySelector('[name="partId"]').value);
    row.querySelector('.material-line-summary').innerHTML = itemSummary(rowItem(row));
    updateLiveSummary();
  }
  function updateLiveSummary() {
    const totals = projectTotals(currentItems(), currentSupply());
    const complete = totals.calculations.filter(item => item.rawWeight && item.width && item.thickness).length;
    document.getElementById('materialLiveSummary').innerHTML = `<h3>Résultat de la découpe commune</h3><div class="material-live-totals"><span>Poids nécessaire : <b>${weightLabel(totals.requiredWeight)}</b></span><span>Poids total à acheter : <b>${weightLabel(totals.purchaseWeight)}</b></span><span>Poids restant : <b>${weightLabel(totals.leftoverWeight)}</b></span><span>Prix total d’achat : <b>${costLabel(totals.totalCost)}</b></span><span>Pièces calculables : <b>${complete}/${totals.calculations.length}</b></span></div>${cutPlanHtml(totals.segments, totals.calculations)}${totals.warnings.length ? `<div class="material-project-warning">${safe(totals.warnings.join(' · '))}</div>` : ''}`;
  }
  function openCalculator(record) {
    if (!canEdit()) { toast('Mode lecture seule · modification interdite'); return; }
    editingId = record?.id || '';
    form.reset(); lines.innerHTML = '';
    form.elements.name.value = record?.name || '';
    form.elements.created.value = record?.created || new Date().toISOString().slice(0,10);
    const supply = supplyFromRecord(record);
    form.elements.supplyMode.value = supply.supplyMode;
    form.elements.sourceWidth.value = supply.sourceWidth;
    form.elements.unitPrice.value = supply.unitPrice;
    toggleSupplyFields();
    (record?.items?.length ? record.items : [{}]).forEach(addLine);
    document.getElementById('materialCalculatorEyebrow').textContent = record ? 'MODIFICATION' : 'NOUVEAU';
    document.getElementById('materialCalculatorTitle').textContent = record ? 'Modifier le projet matière' : 'Nouveau projet matière';
    updateLiveSummary(); modal.classList.add('open');
  }
  function closeCalculator() { modal.classList.remove('open'); editingId = ''; }

  function resultCards(record) {
    const sharedSupply = supplyFromRecord(record);
    return (record.items || []).map(item => {
      const calc = calculateItem(item, sharedSupply);
      return `<div class="material-result"><div><span class="material-result-label">Pièce</span><b>${safe(calc.part?.id || item.partId)} · ${safe(calc.part?.name || 'Pièce inconnue')}</b></div><div><span class="material-result-label">Quantité / moule</span><span>${calc.quantity.toLocaleString('fr-FR')} pièce(s)</span><b>${calc.mould ? `${safe(calc.mould.id)} · ${safe(calc.mould.name)}` : 'Moule non sélectionné'}</b></div><div><span class="material-result-label">Poids nécessaire</span><strong>${calc.rawWeight ? weightLabel(calc.rawWeight) : 'Calcul incomplet'}</strong></div><div><span class="material-result-label">Largeur / épaisseur</span><strong>${dimensionLabel(calc.width)} × ${dimensionLabel(calc.thickness)}</strong></div><div><span class="material-result-label">Utilisation de la bande commune</span><b>${dimensionLabel(calc.width)} réservés à cette pièce</b><span>${safe(calc.part?.material || 'Matière à renseigner')}</span></div>${calc.warnings.length ? `<span class="material-warning">${safe(calc.warnings.join(' · '))}</span>` : ''}</div>`;
    }).join('');
  }
  function calculatorPage() {
    ensureStore();
    const query = String(document.getElementById('globalSearch')?.value || '').trim().toLowerCase();
    const records = data.materialCalculations.filter(record => !query || `${record.id} ${record.name}`.toLowerCase().includes(query));
    return `<section class="material-calculator-intro"><div><span class="eyebrow">PRÉPARATION MATIÈRE</span><h2>Calcul des besoins initiaux</h2><p>Définissez une bande initiale commune : le système combine les largeurs des différentes pièces pour proposer une découpe partagée.</p></div><div class="material-formula">Exemple : bande 50 mm = 15 mm ENT + 21 mm ASTOR + 14 mm restant<br>Prix d’achat = poids total de la bande mère × prix par kg</div></section>${records.length ? `<div class="material-project-list">${records.map(record => { const supply = supplyFromRecord(record), totals = projectTotals(record.items || [], supply); return `<article class="material-project-card"><div class="material-project-head"><div><span class="eyebrow">${safe(record.id)}</span><h3>${safe(record.name)}</h3><small>${safe(record.created)} · ${(record.items || []).length} référence(s)</small></div><div class="material-project-actions"><button class="secondary" data-edit-material="${safe(record.id)}">Modifier</button><button class="danger" data-delete-material="${safe(record.id)}">Supprimer</button></div></div><div class="material-shared-result"><b>Bande commune · ${supply.supplyMode === 'slit' ? `mère ${dimensionLabel(supply.sourceWidth)}` : 'prédécoupée'}</b><span>Poids nécessaire ${weightLabel(totals.requiredWeight)}</span><span>Poids à acheter ${weightLabel(totals.purchaseWeight)}</span><span>Reste ${weightLabel(totals.leftoverWeight)}</span><span>Prix ${costLabel(totals.totalCost)}</span></div>${cutPlanHtml(totals.segments, totals.calculations)}${totals.warnings.length ? `<div class="material-project-warning">${safe(totals.warnings.join(' · '))}</div>` : ''}<div class="material-result-head"><span>Pièce</span><span>Quantité / moule</span><span>Poids nécessaire</span><span>Largeur × épaisseur</span><span>Utilisation de la bande commune</span></div><div class="material-result-grid">${resultCards(record)}</div></article>`; }).join('')}</div>` : `<div class="material-empty"><b>Aucun calcul matière enregistré</b>Créez un projet pour calculer une découpe commune.</div>`}`;
  }

  const previousRender = render;
  render = () => {
    if (view !== calculatorView) { previousRender(); return; }
    ensureStore();
    document.getElementById('pageTitle').textContent = meta[calculatorView][0];
    document.getElementById('pageDesc').textContent = meta[calculatorView][1];
    document.getElementById('mainAddBtn').textContent = meta[calculatorView][2];
    content.innerHTML = calculatorPage();
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === calculatorView));
    applyRoleUi();
  };

  document.getElementById('mainAddBtn').addEventListener('click', event => {
    if (view !== calculatorView) return;
    event.preventDefault(); event.stopImmediatePropagation(); openCalculator();
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest('[data-close-material-calculator]')) closeCalculator();
    if (event.target.closest('[data-add-material-line]')) { addLine(); updateLiveSummary(); }
    const remove = event.target.closest('[data-remove-material-line]');
    if (remove) { remove.closest('.material-line').remove(); if (!lines.children.length) addLine(); updateLiveSummary(); }
    const edit = event.target.closest('[data-edit-material]');
    if (edit) openCalculator(data.materialCalculations.find(record => record.id === edit.dataset.editMaterial));
    const del = event.target.closest('[data-delete-material]');
    if (del && canEdit() && confirm('Supprimer ce calcul matière ?')) { data.materialCalculations = data.materialCalculations.filter(record => record.id !== del.dataset.deleteMaterial); save(); render(); toast('Calcul matière supprimé'); }
  });
  lines.addEventListener('change', event => {
    const row = event.target.closest('.material-line');
    if (row) updateRow(row, event.target.name === 'partId');
  });
  lines.addEventListener('input', event => { const row = event.target.closest('.material-line'); if (row) updateRow(row); });
  form.addEventListener('change', event => {
    if (!['supplyMode', 'sourceWidth', 'unitPrice'].includes(event.target.name)) return;
    toggleSupplyFields(); refreshAllRows();
  });
  form.addEventListener('input', event => {
    if (!['sourceWidth', 'unitPrice'].includes(event.target.name)) return;
    refreshAllRows();
  });
  form.addEventListener('submit', event => {
    event.preventDefault(); if (!canEdit()) return;
    const items = currentItems();
    if (!items.length || items.some(item => !item.partId || !item.mouldId || number(item.quantity) <= 0)) { toast('Sélectionnez une pièce, sa quantité et son moule pour chaque ligne'); return; }
    ensureStore();
    const existing = data.materialCalculations.find(record => record.id === editingId), wasEditing = Boolean(existing);
    const supply = currentSupply();
    const record = {id: existing?.id || nextCalculationId(), name: form.elements.name.value.trim(), created: form.elements.created.value, supplyMode:supply.supplyMode, sourceWidth:number(supply.sourceWidth), unitPrice:number(supply.unitPrice), items: items.map(item => ({...item, quantity:number(item.quantity)}))};
    if (existing) data.materialCalculations[data.materialCalculations.indexOf(existing)] = record; else data.materialCalculations.unshift(record);
    save(); closeCalculator(); render(); toast(wasEditing ? 'Calcul matière mis à jour' : 'Calcul matière créé');
  });
  modal.addEventListener('click', event => { if (event.target === modal) closeCalculator(); });
  window.addEventListener('moldflow-cloud-ready', ensureStore);
})();
