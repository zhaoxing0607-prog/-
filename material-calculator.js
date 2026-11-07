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

  function calculateItem(item) {
    const part = partById(item.partId), mould = mouldById(item.mouldId), quantity = Math.max(0, number(item.quantity));
    const unitWeight = number(part?.weight), utilization = number(mould?.utilization);
    const width = number(mould?.stripWidth), thickness = number(mould?.maxThickness) || number(part?.thickness);
    const finishedWeight = unitWeight * quantity, rawWeight = utilization > 0 ? finishedWeight / (utilization / 100) : 0;
    const supplyMode = item.supplyMode === 'slit' ? 'slit' : 'precut', sourceWidth = number(item.sourceWidth);
    const unitPrice = number(item.unitPrice ?? (supplyMode === 'slit' ? item.sourcePrice : item.precutPrice));
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
    if (!unitPrice) warnings.push('Prix par kilogramme manquant');
    if (supplyMode === 'slit' && !sourceWidth) warnings.push('Largeur de bande mère manquante');
    if (supplyMode === 'slit' && sourceWidth && width && sourceWidth < width) warnings.push('Bande mère plus étroite que la bande nécessaire');
    return {part, mould, quantity, unitWeight, utilization, width, thickness, finishedWeight, rawWeight, supplyMode, sourceWidth, unitPrice, rollCount, leftoverWidth, slitYield, purchaseWeight, leftoverWeight, selectedCost, warnings};
  }

  const itemSummary = item => {
    const calc = calculateItem(item);
    const leftoverWidthLabel = calc.rollCount ? `${calc.leftoverWidth.toLocaleString('fr-FR', {maximumFractionDigits:3})} mm` : 'À calculer';
    const split = calc.supplyMode === 'slit' ? `<span>Découpe en : <b>${calc.rollCount || 0} bande(s)</b></span><span>Rendement refente : <b>${(calc.slitYield * 100).toLocaleString('fr-FR', {maximumFractionDigits:2})} %</b></span><span>Reste : <b>${leftoverWidthLabel} · ${weightLabel(calc.leftoverWeight)}</b></span>` : '<span>Découpe : <b>aucune</b></span><span>Reste : <b>0 g</b></span>';
    return `<span>Poids nécessaire : <b>${calc.rawWeight ? weightLabel(calc.rawWeight) : 'À calculer'}</b></span><span>Largeur : <b>${dimensionLabel(calc.width)}</b></span><span>Épaisseur : <b>${dimensionLabel(calc.thickness)}</b></span>${split}<span>Poids à acheter : <b>${weightLabel(calc.purchaseWeight)}</b></span><span>Prix d’achat : <b>${calc.selectedCost ? costLabel(calc.selectedCost) : 'À calculer'}</b></span>${calc.warnings.map(warning => `<span class="warning">${safe(warning)}</span>`).join('')}`;
  };

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
    const supplyMode = item.supplyMode === 'slit' ? 'slit' : 'precut';
    const unitPrice = item.unitPrice ?? (supplyMode === 'slit' ? item.sourcePrice : item.precutPrice) ?? '';
    row.innerHTML = `<label>Pièce<select name="partId" required>${partOptions(item.partId)}</select></label><label>Quantité<input name="quantity" type="number" min="0.01" step="any" required value="${safe(item.quantity || 1)}"></label><label class="material-mould-field">Moule associé<select name="mouldId" required>${mouldOptions(item.partId, item.mouldId)}</select></label><button class="danger material-remove-line" type="button" data-remove-material-line>Supprimer</button><div class="material-supply-options"><label>Approvisionnement<select name="supplyMode"><option value="precut" ${supplyMode === 'precut' ? 'selected' : ''}>Bande prédécoupée</option><option value="slit" ${supplyMode === 'slit' ? 'selected' : ''}>Bande mère à découper</option></select></label><label class="slit-only">Largeur bande mère (mm)<input name="sourceWidth" type="number" min="0" step="any" value="${safe(item.sourceWidth || '')}" placeholder="Ex. 1000"></label><label>Prix de la bande (€/kg)<input name="unitPrice" type="number" min="0" step="any" value="${safe(unitPrice)}" placeholder="Ex. 2,50"></label></div><div class="material-line-summary">${itemSummary({...item, supplyMode, unitPrice})}</div>`;
    lines.appendChild(row);
    toggleSupplyFields(row);
  }
  function rowItem(row) {
    return {partId: row.querySelector('[name="partId"]').value, quantity: row.querySelector('[name="quantity"]').value, mouldId: row.querySelector('[name="mouldId"]').value, supplyMode: row.querySelector('[name="supplyMode"]').value, sourceWidth: row.querySelector('[name="sourceWidth"]').value, unitPrice: row.querySelector('[name="unitPrice"]').value};
  }
  function currentItems() { return [...lines.querySelectorAll('.material-line')].map(rowItem); }
  function toggleSupplyFields(row) { row.querySelectorAll('.slit-only').forEach(field => field.hidden = row.querySelector('[name="supplyMode"]').value !== 'slit'); }
  function updateRow(row, partChanged = false) {
    if (partChanged) row.querySelector('[name="mouldId"]').innerHTML = mouldOptions(row.querySelector('[name="partId"]').value);
    toggleSupplyFields(row);
    row.querySelector('.material-line-summary').innerHTML = itemSummary(rowItem(row));
    updateLiveSummary();
  }
  function updateLiveSummary() {
    const calculations = currentItems().map(calculateItem), totalPurchaseWeight = calculations.reduce((sum, item) => sum + item.purchaseWeight, 0), totalCost = calculations.reduce((sum, item) => sum + item.selectedCost, 0), complete = calculations.filter(item => item.rawWeight && item.width && item.thickness).length;
    document.getElementById('materialLiveSummary').innerHTML = `<h3>Résultat instantané</h3><div class="material-live-totals"><span>Poids total à acheter : <b>${weightLabel(totalPurchaseWeight)}</b></span><span>Prix total d’achat : <b>${costLabel(totalCost)}</b></span><span>Pièces calculables : <b>${complete}/${calculations.length}</b></span></div>`;
  }
  function openCalculator(record) {
    if (!canEdit()) { toast('Mode lecture seule · modification interdite'); return; }
    editingId = record?.id || '';
    form.reset(); lines.innerHTML = '';
    form.elements.name.value = record?.name || '';
    form.elements.created.value = record?.created || new Date().toISOString().slice(0,10);
    (record?.items?.length ? record.items : [{}]).forEach(addLine);
    document.getElementById('materialCalculatorEyebrow').textContent = record ? 'MODIFICATION' : 'NOUVEAU';
    document.getElementById('materialCalculatorTitle').textContent = record ? 'Modifier le projet matière' : 'Nouveau projet matière';
    updateLiveSummary(); modal.classList.add('open');
  }
  function closeCalculator() { modal.classList.remove('open'); editingId = ''; }

  function resultCards(record) {
    return (record.items || []).map(item => {
      const calc = calculateItem(item);
      const leftoverWidthLabel = calc.rollCount ? `${calc.leftoverWidth.toLocaleString('fr-FR', {maximumFractionDigits:3})} mm` : 'À calculer';
      const supply = calc.supplyMode === 'slit' ? `<b>Bande mère ${dimensionLabel(calc.sourceWidth)}</b><span>Découpe en ${calc.rollCount} bande(s) · rendement ${(calc.slitYield * 100).toLocaleString('fr-FR', {maximumFractionDigits:2})} %</span><span>Reste ${leftoverWidthLabel} / ${weightLabel(calc.leftoverWeight)}</span>` : '<b>Bande prédécoupée</b><span>Aucune découpe · reste 0 g</span>';
      return `<div class="material-result"><div><span class="material-result-label">Pièce</span><b>${safe(calc.part?.id || item.partId)} · ${safe(calc.part?.name || 'Pièce inconnue')}</b></div><div><span class="material-result-label">Quantité / moule</span><span>${calc.quantity.toLocaleString('fr-FR')} pièce(s)</span><b>${calc.mould ? `${safe(calc.mould.id)} · ${safe(calc.mould.name)}` : 'Moule non sélectionné'}</b></div><div><span class="material-result-label">Poids nécessaire</span><strong>${calc.rawWeight ? weightLabel(calc.rawWeight) : 'Calcul incomplet'}</strong><span>À acheter ${weightLabel(calc.purchaseWeight)}</span></div><div><span class="material-result-label">Largeur / épaisseur</span><strong>${dimensionLabel(calc.width)} × ${dimensionLabel(calc.thickness)}</strong></div><div><span class="material-result-label">Approvisionnement / découpe</span>${supply}</div><div><span class="material-result-label">Prix d’achat</span><strong>${calc.selectedCost ? costLabel(calc.selectedCost) : 'Prix manquant'}</strong><span>${calc.unitPrice ? `${costLabel(calc.unitPrice)} / kg` : ''}</span></div>${calc.warnings.length ? `<span class="material-warning">${safe(calc.warnings.join(' · '))}</span>` : ''}</div>`;
    }).join('');
  }
  function calculatorPage() {
    ensureStore();
    const query = String(document.getElementById('globalSearch')?.value || '').trim().toLowerCase();
    const records = data.materialCalculations.filter(record => !query || `${record.id} ${record.name}`.toLowerCase().includes(query));
    return `<section class="material-calculator-intro"><div><span class="eyebrow">PRÉPARATION MATIÈRE</span><h2>Calcul des besoins initiaux</h2><p>Choisissez une seule méthode d’approvisionnement. Le résultat est calculé uniquement pour la bande sélectionnée.</p></div><div class="material-formula">Poids d’achat = poids nécessaire + reste de découpe<br>Prix d’achat = poids d’achat × prix par kg</div></section>${records.length ? `<div class="material-project-list">${records.map(record => `<article class="material-project-card"><div class="material-project-head"><div><span class="eyebrow">${safe(record.id)}</span><h3>${safe(record.name)}</h3><small>${safe(record.created)} · ${(record.items || []).length} référence(s)</small></div><div class="material-project-actions"><button class="secondary" data-edit-material="${safe(record.id)}">Modifier</button><button class="danger" data-delete-material="${safe(record.id)}">Supprimer</button></div></div><div class="material-result-head"><span>Pièce</span><span>Quantité / moule</span><span>Poids nécessaire</span><span>Largeur × épaisseur</span><span>Approvisionnement / découpe</span><span>Prix d’achat</span></div><div class="material-result-grid">${resultCards(record)}</div></article>`).join('')}</div>` : `<div class="material-empty"><b>Aucun calcul matière enregistré</b>Créez un projet pour calculer la bande sélectionnée.</div>`}`;
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
  form.addEventListener('submit', event => {
    event.preventDefault(); if (!canEdit()) return;
    const items = currentItems();
    if (!items.length || items.some(item => !item.partId || !item.mouldId || number(item.quantity) <= 0)) { toast('Sélectionnez une pièce, sa quantité et son moule pour chaque ligne'); return; }
    ensureStore();
    const existing = data.materialCalculations.find(record => record.id === editingId), wasEditing = Boolean(existing);
    const record = {id: existing?.id || nextCalculationId(), name: form.elements.name.value.trim(), created: form.elements.created.value, items: items.map(item => ({...item, quantity:number(item.quantity), sourceWidth:number(item.sourceWidth), unitPrice:number(item.unitPrice)}))};
    if (existing) data.materialCalculations[data.materialCalculations.indexOf(existing)] = record; else data.materialCalculations.unshift(record);
    save(); closeCalculator(); render(); toast(wasEditing ? 'Calcul matière mis à jour' : 'Calcul matière créé');
  });
  modal.addEventListener('click', event => { if (event.target === modal) closeCalculator(); });
  window.addEventListener('moldflow-cloud-ready', ensureStore);
})();
