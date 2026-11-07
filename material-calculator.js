(() => {
  const calculatorView = 'materials';
  const calculatorModalId = 'materialCalculatorBackdrop';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number = value => Number(String(value ?? 0).replace(',', '.')) || 0;
  const weightLabel = grams => grams >= 1000 ? `${(grams / 1000).toLocaleString('fr-FR', {maximumFractionDigits:3})} kg` : `${grams.toLocaleString('fr-FR', {maximumFractionDigits:2})} g`;
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
    const warnings = [];
    if (!part) warnings.push('Pièce introuvable');
    if (!mould) warnings.push('Choisir le moule associé');
    if (!unitWeight) warnings.push('Poids unitaire manquant');
    if (!utilization) warnings.push('Taux d’utilisation manquant');
    if (!width) warnings.push('Largeur de bande manquante');
    if (!thickness) warnings.push('Épaisseur manquante');
    return {part, mould, quantity, unitWeight, utilization, width, thickness, finishedWeight, rawWeight, warnings};
  }

  const itemSummary = item => {
    const calc = calculateItem(item);
    return `<span>Poids de la bande : <b>${calc.rawWeight ? weightLabel(calc.rawWeight) : 'À calculer'}</b></span><span>Largeur : <b>${dimensionLabel(calc.width)}</b></span><span>Épaisseur : <b>${dimensionLabel(calc.thickness)}</b></span>${calc.warnings.map(warning => `<span class="warning">${safe(warning)}</span>`).join('')}`;
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
    row.innerHTML = `<label>Pièce<select name="partId" required>${partOptions(item.partId)}</select></label><label>Quantité<input name="quantity" type="number" min="0.01" step="any" required value="${safe(item.quantity || 1)}"></label><label class="material-mould-field">Moule associé<select name="mouldId" required>${mouldOptions(item.partId, item.mouldId)}</select></label><button class="danger material-remove-line" type="button" data-remove-material-line>Supprimer</button><div class="material-line-summary">${itemSummary(item)}</div>`;
    lines.appendChild(row);
  }
  function rowItem(row) {
    return {partId: row.querySelector('[name="partId"]').value, quantity: row.querySelector('[name="quantity"]').value, mouldId: row.querySelector('[name="mouldId"]').value};
  }
  function currentItems() { return [...lines.querySelectorAll('.material-line')].map(rowItem); }
  function updateRow(row, partChanged = false) {
    if (partChanged) row.querySelector('[name="mouldId"]').innerHTML = mouldOptions(row.querySelector('[name="partId"]').value);
    row.querySelector('.material-line-summary').innerHTML = itemSummary(rowItem(row));
    updateLiveSummary();
  }
  function updateLiveSummary() {
    const calculations = currentItems().map(calculateItem), knownRaw = calculations.reduce((sum, item) => sum + item.rawWeight, 0), complete = calculations.filter(item => !item.warnings.length).length;
    document.getElementById('materialLiveSummary').innerHTML = `<h3>Résultat instantané</h3><div class="material-live-totals"><span>Poids total de bande : <b>${weightLabel(knownRaw)}</b></span><span>Pièces calculables : <b>${complete}/${calculations.length}</b></span><span>Formule : poids fini ÷ taux d’utilisation</span></div>`;
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
      return `<div class="material-result"><div><span class="material-result-label">Pièce</span><b>${safe(calc.part?.id || item.partId)} · ${safe(calc.part?.name || 'Pièce inconnue')}</b></div><div><span class="material-result-label">Quantité / moule</span><span>${calc.quantity.toLocaleString('fr-FR')} pièce(s)</span><b>${calc.mould ? `${safe(calc.mould.id)} · ${safe(calc.mould.name)}` : 'Moule non sélectionné'}</b></div><div><span class="material-result-label">Poids de la bande</span><strong>${calc.rawWeight ? weightLabel(calc.rawWeight) : 'Calcul incomplet'}</strong></div><div><span class="material-result-label">Largeur</span><strong>${dimensionLabel(calc.width)}</strong></div><div><span class="material-result-label">Épaisseur</span><strong>${dimensionLabel(calc.thickness)}</strong></div>${calc.warnings.length ? `<span class="material-warning">${safe(calc.warnings.join(' · '))}</span>` : ''}</div>`;
    }).join('');
  }
  function calculatorPage() {
    ensureStore();
    const query = String(document.getElementById('globalSearch')?.value || '').trim().toLowerCase();
    const records = data.materialCalculations.filter(record => !query || `${record.id} ${record.name}`.toLowerCase().includes(query));
    return `<section class="material-calculator-intro"><div><span class="eyebrow">PRÉPARATION MATIÈRE</span><h2>Calcul des besoins initiaux</h2><p>Sélectionnez les pièces, leurs quantités et le moule associé. Le résultat indique le poids, la largeur et l’épaisseur de la bande.</p></div><div class="material-formula">Poids de la bande = poids unitaire × quantité ÷ taux d’utilisation<br>Largeur et épaisseur reprises depuis le moule associé</div></section>${records.length ? `<div class="material-project-list">${records.map(record => `<article class="material-project-card"><div class="material-project-head"><div><span class="eyebrow">${safe(record.id)}</span><h3>${safe(record.name)}</h3><small>${safe(record.created)} · ${(record.items || []).length} référence(s)</small></div><div class="material-project-actions"><button class="secondary" data-edit-material="${safe(record.id)}">Modifier</button><button class="danger" data-delete-material="${safe(record.id)}">Supprimer</button></div></div><div class="material-result-head"><span>Pièce</span><span>Quantité / moule</span><span>Poids de la bande</span><span>Largeur</span><span>Épaisseur</span></div><div class="material-result-grid">${resultCards(record)}</div></article>`).join('')}</div>` : `<div class="material-empty"><b>Aucun calcul matière enregistré</b>Créez un projet pour calculer le poids, la largeur et l’épaisseur de la bande.</div>`}`;
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
    const record = {id: existing?.id || nextCalculationId(), name: form.elements.name.value.trim(), created: form.elements.created.value, items: items.map(item => ({...item, quantity:number(item.quantity)}))};
    if (existing) data.materialCalculations[data.materialCalculations.indexOf(existing)] = record; else data.materialCalculations.unshift(record);
    save(); closeCalculator(); render(); toast(wasEditing ? 'Calcul matière mis à jour' : 'Calcul matière créé');
  });
  modal.addEventListener('click', event => { if (event.target === modal) closeCalculator(); });
  window.addEventListener('moldflow-cloud-ready', ensureStore);
})();
