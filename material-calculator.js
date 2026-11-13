(() => {
  const calculatorView = 'materials';
  const calculatorModalId = 'materialCalculatorBackdrop';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number = value => Number(String(value ?? 0).replace(',', '.')) || 0;
  const weightLabel = grams => grams >= 1000 ? `${(grams / 1000).toLocaleString('fr-FR', {maximumFractionDigits:3})} kg` : `${grams.toLocaleString('fr-FR', {maximumFractionDigits:2})} g`;
  const costLabel = euros => `${number(euros).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2})} €`;
  const dimensionLabel = value => number(value) ? `${number(value).toLocaleString('fr-FR', {maximumFractionDigits:3})} mm` : 'À renseigner';
  let editingId = '';
  let materialLineSequence = 0;
  const expandedMaterialIds = new Set();

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
          <div class="material-lines" id="materialCalculatorLines"></div>
          <button class="secondary material-add-line" type="button" data-add-material-line>＋ Ajouter une pièce</button>
          <div class="material-project-supply"><div class="material-shared-title"><b>Options d’approvisionnement</b><span>Choisissez une bande prédécoupée ou une bande mère à largeur fixe, puis indiquez son prix.</span></div><div class="material-band-options" id="materialBandOptions"></div><button class="secondary material-add-band" type="button" data-add-band-option>＋ Ajouter une option d’achat</button></div>
          <div class="material-live-summary" id="materialLiveSummary"></div>
          <div class="modal-actions"><button type="button" class="secondary" data-close-material-calculator>Annuler</button><button type="submit" class="primary">Enregistrer le calcul</button></div>
        </form>
      </section>
    </div>`);

  const modal = document.getElementById(calculatorModalId);
  const form = document.getElementById('materialCalculatorForm');
  const lines = document.getElementById('materialCalculatorLines');
  const bandOptionsContainer = document.getElementById('materialBandOptions');
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

  const suppliesFromRecord = record => {
    const legacy = record?.items?.[0] || {};
    if (Array.isArray(record?.bandOptions) && record.bandOptions.length) return record.bandOptions.map(option => ({targetLineId:option.targetLineId || 'all', supplyMode:option.supplyMode === 'precut' ? 'precut' : 'slit', sourceWidth:option.sourceWidth ?? option.width ?? '', unitPrice:option.unitPrice ?? option.price ?? ''}));
    const sourceWidth = record?.sourceWidth ?? legacy.sourceWidth ?? '';
    const unitPrice = record?.unitPrice ?? legacy.unitPrice ?? legacy.sourcePrice ?? legacy.precutPrice ?? '';
    return [{targetLineId:record ? (record.targetLineId || 'all') : '', supplyMode:record?.supplyMode === 'precut' ? 'precut' : 'slit', sourceWidth, unitPrice}];
  };
  const currentSupplies = () => [...bandOptionsContainer.querySelectorAll('.material-band-option')].map(row => ({targetLineId:row.querySelector('[name="bandTarget"]').value, supplyMode:row.querySelector('[name="bandMode"]').value, sourceWidth:row.querySelector('[name="bandWidth"]').value, unitPrice:row.querySelector('[name="bandPrice"]').value}));

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

  const itemSummary = item => {
    const calc = calculateItem(item, {supplyMode:'precut'});
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

  const cutPlanHtml = (segments, calculations) => segments.length ? `<div class="material-cut-plan">${segments.map((segment,index) => { const cuts = Object.entries(segment.counts).map(([itemIndex,count]) => { const calc = calculations[number(itemIndex)]; return `${count} × ${dimensionLabel(calc.width)} (${safe(calc.part?.name || calc.part?.id || 'Pièce')})`; }).join(' + '); const leftoverWidth = `${number(segment.leftoverWidth).toLocaleString('fr-FR', {maximumFractionDigits:3})} mm`; return `<span><b>Découpe ${index + 1}</b>${cuts}<strong>Poids de bande utilisé : ${weightLabel(segment.sourceWeight)}</strong><small>Reste ${leftoverWidth} · ${weightLabel(segment.leftoverWeight)}</small></span>`; }).join('')}</div>` : '';

  function projectTotals(items, supply) {
    const calculations = items.map(item => calculateItem(item, supply));
    const materials = [...new Set(calculations.map(calc => calc.part?.material).filter(Boolean))];
    const thicknesses = [...new Set(calculations.map(calc => number(calc.thickness)).filter(Boolean))];
    const widths = [...new Set(calculations.map(calc => number(calc.width)).filter(Boolean))];
    const warnings = [];
    if (!number(supply.unitPrice)) warnings.push('Prix par kilogramme manquant');
    if (supply.supplyMode === 'slit' && !number(supply.sourceWidth)) warnings.push('Largeur de bande mère manquante');
    if (supply.supplyMode === 'slit' && materials.length > 1) warnings.push(`Matières incompatibles pour une bande commune : ${materials.join(' / ')}`);
    if (supply.supplyMode === 'slit' && thicknesses.length > 1) warnings.push(`Épaisseurs incompatibles pour une bande commune : ${thicknesses.map(dimensionLabel).join(' / ')}`);
    if (supply.supplyMode === 'slit' && widths.some(width => width > number(supply.sourceWidth))) warnings.push('La bande mère est plus étroite que l’une des bandes nécessaires');
    const allWidthsFit = widths.length > 0 && widths.every(width => width <= number(supply.sourceWidth));
    const calculationsComplete = calculations.length > 0 && calculations.every(calc => calc.rawWeight > 0 && calc.width > 0 && calc.thickness > 0);
    if (!calculationsComplete) warnings.push('Compléter les données de la pièce et de son outil');
    const fixedBandValid = supply.supplyMode === 'slit' && number(supply.sourceWidth) > 0 && materials.length <= 1 && thicknesses.length <= 1 && allWidthsFit;
    const precutValid = supply.supplyMode === 'precut' && widths.length > 0;
    const valid = number(supply.unitPrice) > 0 && calculationsComplete && (fixedBandValid || precutValid);
    const canOptimize = valid && supply.supplyMode === 'slit';
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
      warnings,
      valid
    };
  }

  function compareScenarios(items, supplies) {
    const numberedItems = items.map((item,index) => ({...item, displayNumber:item.displayNumber || index + 1}));
    const scenarios = supplies.map((supply,index) => {
      const targetItems = supply.targetLineId && supply.targetLineId !== 'all' ? numberedItems.filter(item => item.lineId === supply.targetLineId) : numberedItems;
      const totals = projectTotals(targetItems, supply);
      if (!targetItems.length) totals.warnings.push('Sélectionner la pièce correspondant à cette bande');
      const utilization = totals.purchaseWeight > 0 ? totals.requiredWeight / totals.purchaseWeight * 100 : 0;
      return {index, supply, targetItems, totals, utilization};
    });
    return scenarios.map(scenario => {
      const comparable = scenarios.filter(candidate => candidate.supply.targetLineId === scenario.supply.targetLineId && candidate.totals.valid);
      const validCosts = comparable.filter(candidate => candidate.totals.totalCost > 0);
      const validYields = comparable.filter(candidate => candidate.utilization > 0);
      const minimumCost = validCosts.length ? Math.min(...validCosts.map(candidate => candidate.totals.totalCost)) : 0;
      const maximumYield = validYields.length ? Math.max(...validYields.map(candidate => candidate.utilization)) : 0;
      return {...scenario, cheapest:minimumCost > 0 && Math.abs(scenario.totals.totalCost - minimumCost) < .01, bestYield:maximumYield > 0 && Math.abs(scenario.utilization - maximumYield) < .001};
    });
  }

  const supplyTitle = scenario => { const widths = [...new Set(scenario.totals.calculations.map(calc => number(calc.width)).filter(Boolean))]; return scenario.supply.supplyMode === 'precut' ? `Bande prédécoupée · ${widths.length > 1 ? 'largeurs selon les outils' : dimensionLabel(widths[0])}` : `Bande mère fixe ${dimensionLabel(scenario.supply.sourceWidth)}`; };
  const supplyTargetLabel = scenario => scenario.supply.targetLineId === 'all' ? 'Toutes les pièces du projet' : (() => { const item = scenario.targetItems[0], calc = scenario.totals.calculations[0]; return item ? `Pièce ${number(item.displayNumber) || '?'} · ${calc?.part ? `${calc.part.id} · ${calc.part.name}` : 'À sélectionner'}` : 'Pièce à sélectionner'; })();
  const scenarioCardsHtml = scenarios => `<div class="material-scenarios">${scenarios.map(scenario => `<section class="material-scenario ${scenario.cheapest ? 'is-cheapest' : ''} ${scenario.bestYield ? 'is-best-yield' : ''} ${scenario.totals.valid ? '' : 'is-invalid'}"><div class="material-scenario-head"><div><span>OPTION ${scenario.index + 1} · ${safe(supplyTargetLabel(scenario))}</span><b>${supplyTitle(scenario)} · ${costLabel(scenario.supply.unitPrice)}/kg</b></div><div class="material-scenario-badges">${scenario.cheapest ? '<em>PRIX OPTIMAL</em>' : ''}${scenario.bestYield ? '<em>MEILLEUR RENDEMENT</em>' : ''}</div></div><div class="material-scenario-metrics"><span>Poids à acheter <b>${scenario.totals.valid ? weightLabel(scenario.totals.purchaseWeight) : 'Non calculable'}</b></span><span>Reste <b>${scenario.totals.valid ? weightLabel(scenario.totals.leftoverWeight) : '—'}</b></span><span>Utilisation <b>${scenario.totals.valid ? `${scenario.utilization.toLocaleString('fr-FR',{maximumFractionDigits:2})} %` : '—'}</b></span><span>Prix total <b>${scenario.totals.valid ? costLabel(scenario.totals.totalCost) : '—'}</b></span></div>${cutPlanHtml(scenario.totals.segments, scenario.totals.calculations)}${scenario.supply.supplyMode === 'precut' && scenario.totals.valid ? '<div class="material-precut-note">Largeur automatiquement reprise depuis l’outil de la pièce sélectionnée.</div>' : ''}${scenario.totals.warnings.length ? `<div class="material-project-warning">${safe(scenario.totals.warnings.join(' · '))}</div>` : ''}</section>`).join('')}</div>`;

  function partOptions(selected = '') {
    return `<option value="">Sélectionner une pièce</option>${[...data.parts].sort((a,b) => a.id.localeCompare(b.id, 'fr', {numeric:true})).map(part => `<option value="${safe(part.id)}" ${part.id === selected ? 'selected' : ''}>${safe(part.id)} · ${safe(part.name)}</option>`).join('')}`;
  }
  function mouldOptions(partId, selected = '') {
    const moulds = linkedMoulds(partById(partId));
    return `<option value="">${partId ? (moulds.length ? 'Sélectionner le moule de la pièce' : 'Aucun moule associé à cette pièce') : 'Sélectionner d’abord une pièce'}</option>${moulds.map(mould => `<option value="${safe(mould.id)}" ${mould.id === selected ? 'selected' : ''}>${safe(mould.id)} · ${safe(mould.name)}</option>`).join('')}`;
  }
  function bandTargetOptions(selected = 'all') {
    const items = currentItems();
    return `<option value="all" ${selected === 'all' ? 'selected' : ''}>Toutes les pièces</option>${items.map((item,index) => { const part = partById(item.partId); const label = part ? `${part.id} · ${part.name}` : 'Pièce à sélectionner'; return `<option value="${safe(item.lineId)}" ${item.lineId === selected ? 'selected' : ''}>Pièce ${index + 1} · ${safe(label)}</option>`; }).join('')}`;
  }
  function addBandOption(option = {}) {
    const row = document.createElement('div');
    row.className = 'material-band-option';
    const mode = option.supplyMode === 'precut' ? 'precut' : 'slit';
    const targetLineId = option.targetLineId || currentItems()[0]?.lineId || 'all';
    row.innerHTML = `<label>Pour la pièce<select name="bandTarget">${bandTargetOptions(targetLineId)}</select></label><label>Mode d’achat<select name="bandMode"><option value="precut" ${mode === 'precut' ? 'selected' : ''}>Bande prédécoupée</option><option value="slit" ${mode === 'slit' ? 'selected' : ''}>Bande mère à largeur fixe</option></select></label><label>Largeur (mm)<input name="bandWidth" type="number" min="0.01" step="any" value="${safe(option.sourceWidth || '')}" placeholder="Ex. 50"></label><label>Prix (€/kg)<input name="bandPrice" type="number" min="0" step="any" required value="${safe(option.unitPrice || '')}" placeholder="Ex. 15"></label><button class="danger" type="button" data-remove-band-option>Supprimer</button>`;
    bandOptionsContainer.appendChild(row);
    syncBandOptionRow(row);
  }
  function addLine(item = {}) {
    const row = document.createElement('div');
    row.className = 'material-line';
    row.dataset.lineId = item.lineId || `piece-${Date.now()}-${++materialLineSequence}`;
    row.innerHTML = `<label><span class="material-piece-heading">Pièce <b data-material-line-number></b></span><select name="partId" required>${partOptions(item.partId)}</select></label><label>Quantité<input name="quantity" type="number" min="0.01" step="any" required value="${safe(item.quantity || 1)}"></label><label class="material-mould-field">Moule associé<select name="mouldId" required>${mouldOptions(item.partId, item.mouldId)}</select></label><button class="danger material-remove-line" type="button" data-remove-material-line>Supprimer</button><div class="material-line-summary">${itemSummary(item)}</div>`;
    lines.appendChild(row);
    renumberLines();
  }
  function rowItem(row) {
    return {lineId:row.dataset.lineId, partId:row.querySelector('[name="partId"]').value, quantity:row.querySelector('[name="quantity"]').value, mouldId:row.querySelector('[name="mouldId"]').value};
  }
  function currentItems() { return [...lines.querySelectorAll('.material-line')].map((row,index) => ({...rowItem(row), displayNumber:index + 1})); }
  function renumberLines() { [...lines.querySelectorAll('.material-line')].forEach((row,index) => { const numberField = row.querySelector('[data-material-line-number]'); if (numberField) numberField.textContent = index + 1; }); }
  function syncBandTargetOptions(row) {
    const field = row.querySelector('[name="bandTarget"]'), current = field.value;
    const valid = current === 'all' || currentItems().some(item => item.lineId === current);
    const selected = valid ? current : (currentItems()[0]?.lineId || 'all');
    field.innerHTML = bandTargetOptions(selected);
    field.value = selected;
  }
  function selectedToolWidths(targetLineId = 'all') { return [...new Set(currentItems().filter(item => targetLineId === 'all' || item.lineId === targetLineId).map(item => number(mouldById(item.mouldId)?.stripWidth)).filter(Boolean))]; }
  function syncBandOptionRow(row) {
    syncBandTargetOptions(row);
    const mode = row.querySelector('[name="bandMode"]').value, widthInput = row.querySelector('[name="bandWidth"]');
    const widths = selectedToolWidths(row.querySelector('[name="bandTarget"]').value);
    if (mode === 'precut') {
      widthInput.value = widths.length === 1 ? widths[0] : '';
      widthInput.placeholder = widths.length > 1 ? 'Selon chaque outil' : 'Sélectionner le moule';
      widthInput.readOnly = true;
      widthInput.required = false;
      row.classList.add('is-precut');
    } else {
      widthInput.readOnly = false;
      widthInput.required = true;
      widthInput.placeholder = 'Ex. 50';
      row.classList.remove('is-precut');
    }
  }
  function syncBandOptions() { [...bandOptionsContainer.querySelectorAll('.material-band-option')].forEach(syncBandOptionRow); }
  function refreshAllRows() { [...lines.querySelectorAll('.material-line')].forEach(row => { row.querySelector('.material-line-summary').innerHTML = itemSummary(rowItem(row)); }); syncBandOptions(); updateLiveSummary(); }
  function updateRow(row, partChanged = false) {
    if (partChanged) row.querySelector('[name="mouldId"]').innerHTML = mouldOptions(row.querySelector('[name="partId"]').value);
    row.querySelector('.material-line-summary').innerHTML = itemSummary(rowItem(row));
    syncBandOptions();
    updateLiveSummary();
  }
  function updateLiveSummary() {
    syncBandOptions();
    const items = currentItems(), scenarios = compareScenarios(items, currentSupplies());
    const complete = items.map(item => calculateItem(item, {supplyMode:'precut'})).filter(item => item.rawWeight && item.width && item.thickness).length;
    const requiredWeight = items.reduce((sum,item) => sum + calculateItem(item, {supplyMode:'precut'}).rawWeight, 0);
    document.getElementById('materialLiveSummary').innerHTML = `<h3>Comparaison des options d’approvisionnement</h3><div class="material-live-totals"><span>Poids nécessaire des pièces : <b>${weightLabel(requiredWeight)}</b></span><span>Pièces calculables : <b>${complete}/${items.length}</b></span><span>Options comparées : <b>${scenarios.length}</b></span></div>${scenarioCardsHtml(scenarios)}`;
  }
  function openCalculator(record) {
    if (!canEdit()) { toast('Mode lecture seule · modification interdite'); return; }
    editingId = record?.id || '';
    form.reset(); lines.innerHTML = ''; bandOptionsContainer.innerHTML = '';
    form.elements.name.value = record?.name || '';
    form.elements.created.value = record?.created || new Date().toISOString().slice(0,10);
    (record?.items?.length ? record.items : [{}]).forEach(addLine);
    suppliesFromRecord(record).forEach(addBandOption);
    document.getElementById('materialCalculatorEyebrow').textContent = record ? 'MODIFICATION' : 'NOUVEAU';
    document.getElementById('materialCalculatorTitle').textContent = record ? 'Modifier le projet matière' : 'Nouveau projet matière';
    updateLiveSummary(); modal.classList.add('open');
  }
  function closeCalculator() { modal.classList.remove('open'); editingId = ''; }

  function resultCards(record) {
    return (record.items || []).map((item,index) => {
      const calc = calculateItem(item, {supplyMode:'precut'});
      return `<div class="material-result"><div><span class="material-result-label">Pièce ${index + 1}</span><b>Pièce ${index + 1} · ${safe(calc.part?.id || item.partId)} · ${safe(calc.part?.name || 'Pièce inconnue')}</b></div><div><span class="material-result-label">Quantité / moule</span><span>${calc.quantity.toLocaleString('fr-FR')} pièce(s)</span><b>${calc.mould ? `${safe(calc.mould.id)} · ${safe(calc.mould.name)}` : 'Moule non sélectionné'}</b></div><div><span class="material-result-label">Poids nécessaire</span><strong>${calc.rawWeight ? weightLabel(calc.rawWeight) : 'Calcul incomplet'}</strong></div><div><span class="material-result-label">Largeur / épaisseur</span><strong>${dimensionLabel(calc.width)} × ${dimensionLabel(calc.thickness)}</strong></div><div><span class="material-result-label">Utilisation de la bande commune</span><b>${dimensionLabel(calc.width)} réservés à cette pièce</b><span>${safe(calc.part?.material || 'Matière à renseigner')}</span></div>${calc.warnings.length ? `<span class="material-warning">${safe(calc.warnings.join(' · '))}</span>` : ''}</div>`;
    }).join('');
  }
  function calculatorPage() {
    ensureStore();
    const query = String(document.getElementById('globalSearch')?.value || '').trim().toLowerCase();
    const records = data.materialCalculations.filter(record => !query || `${record.id} ${record.name}`.toLowerCase().includes(query));
    return `<section class="material-calculator-intro"><div><span class="eyebrow">PRÉPARATION MATIÈRE</span><h2>Comparaison des bandes mères</h2><p>Ajoutez plusieurs largeurs et prix : le système calcule chaque plan de découpe et compare le coût avec l’utilisation matière.</p></div><div class="material-formula">Prix optimal = coût d’achat total le plus bas<br>Meilleur rendement = pourcentage de matière utile le plus élevé</div></section>${records.length ? `<div class="material-project-list">${records.map(record => { const scenarios = compareScenarios(record.items || [], suppliesFromRecord(record)), expanded = expandedMaterialIds.has(record.id); return `<article class="material-project-card ${expanded ? 'is-expanded' : 'is-collapsed'}"><div class="material-project-head"><div><span class="eyebrow">${safe(record.id)}</span><h3>${safe(record.name)}</h3><small>${safe(record.created)} · ${(record.items || []).length} référence(s) · ${scenarios.length} option(s)</small></div><div class="material-project-actions"><button class="material-toggle secondary" data-toggle-material="${safe(record.id)}" aria-expanded="${expanded}">${expanded ? '▲ Réduire' : '▼ Afficher les détails'}</button><button class="secondary" data-edit-material="${safe(record.id)}">Modifier</button><button class="danger" data-delete-material="${safe(record.id)}">Supprimer</button></div></div><div class="material-project-body" ${expanded ? '' : 'hidden'}>${scenarioCardsHtml(scenarios)}<div class="material-result-head"><span>Pièce</span><span>Quantité / moule</span><span>Poids nécessaire</span><span>Largeur × épaisseur</span><span>Besoin de découpe</span></div><div class="material-result-grid">${resultCards(record)}</div></div></article>`; }).join('')}</div>` : `<div class="material-empty"><b>Aucun calcul matière enregistré</b>Créez un projet pour comparer plusieurs bandes mères.</div>`}`;
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
    if (event.target.closest('[data-add-band-option]')) { addBandOption(); updateLiveSummary(); }
    const removeBand = event.target.closest('[data-remove-band-option]');
    if (removeBand) { removeBand.closest('.material-band-option').remove(); if (!bandOptionsContainer.children.length) addBandOption(); updateLiveSummary(); }
    const remove = event.target.closest('[data-remove-material-line]');
    if (remove) { remove.closest('.material-line').remove(); if (!lines.children.length) addLine(); renumberLines(); updateLiveSummary(); }
    const toggle = event.target.closest('[data-toggle-material]');
    if (toggle) { const id = toggle.dataset.toggleMaterial; if (expandedMaterialIds.has(id)) expandedMaterialIds.delete(id); else expandedMaterialIds.add(id); render(); }
    const edit = event.target.closest('[data-edit-material]');
    if (edit) openCalculator(data.materialCalculations.find(record => record.id === edit.dataset.editMaterial));
    const del = event.target.closest('[data-delete-material]');
    if (del && canEdit() && confirm('Supprimer ce calcul matière ?')) { expandedMaterialIds.delete(del.dataset.deleteMaterial); data.materialCalculations = data.materialCalculations.filter(record => record.id !== del.dataset.deleteMaterial); save(); render(); toast('Calcul matière supprimé'); }
  });
  lines.addEventListener('change', event => {
    const row = event.target.closest('.material-line');
    if (row) updateRow(row, event.target.name === 'partId');
  });
  lines.addEventListener('input', event => { const row = event.target.closest('.material-line'); if (row) updateRow(row); });
  bandOptionsContainer.addEventListener('change', updateLiveSummary);
  bandOptionsContainer.addEventListener('input', updateLiveSummary);
  form.addEventListener('submit', event => {
    event.preventDefault(); if (!canEdit()) return;
    const items = currentItems();
    if (!items.length || items.some(item => !item.partId || !item.mouldId || number(item.quantity) <= 0)) { toast('Sélectionnez une pièce, sa quantité et son moule pour chaque ligne'); return; }
    ensureStore();
    const existing = data.materialCalculations.find(record => record.id === editingId), wasEditing = Boolean(existing);
    const bandOptions = currentSupplies().map(option => ({targetLineId:option.targetLineId, supplyMode:option.supplyMode, sourceWidth:number(option.sourceWidth), unitPrice:number(option.unitPrice)}));
    if (!bandOptions.length || bandOptions.some(option => option.unitPrice <= 0 || (option.supplyMode === 'slit' && option.sourceWidth <= 0))) { toast('Renseignez une largeur fixe si nécessaire et un prix valide pour chaque option'); return; }
    const fixedBands = bandOptions.filter(option => option.supplyMode === 'slit');
    const duplicateWidths = fixedBands.some((option,index) => fixedBands.findIndex(candidate => candidate.targetLineId === option.targetLineId && candidate.sourceWidth === option.sourceWidth) !== index);
    if (duplicateWidths) { toast('Chaque bande candidate doit avoir une largeur différente'); return; }
    const record = {id: existing?.id || nextCalculationId(), name: form.elements.name.value.trim(), created: form.elements.created.value, bandOptions, items: items.map(({displayNumber,...item}) => ({...item, quantity:number(item.quantity)}))};
    if (existing) data.materialCalculations[data.materialCalculations.indexOf(existing)] = record; else data.materialCalculations.unshift(record);
    expandedMaterialIds.add(record.id);
    save(); closeCalculator(); render(); toast(wasEditing ? 'Calcul matière mis à jour' : 'Calcul matière créé');
  });
  modal.addEventListener('click', event => { if (event.target === modal) closeCalculator(); });
  window.addEventListener('moldflow-cloud-ready', ensureStore);
})();
