(() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  const projectFieldIndex = fields.projects.findIndex(field => field[0] === 'due');
  if (!fields.projects.some(field => field[0] === 'estimatedBudget')) {
    fields.projects.splice(projectFieldIndex + 1, 0,
      ['estimatedBudget', 'Budget prévisionnel (€)', 'number" step="0.01" min="0', '0'],
      ['externalMachiningCost', 'Frais d’usinage externe (€)', 'number" step="0.01" min="0', '0'],
      ['additionalCost', 'Autres dépenses (€)', 'number" step="0.01" min="0', '0']
    );
  }

  function projectCosts(project) {
    if (!project) return '';
    const externalMachining = Number(project.externalMachiningCost || 0);
    const additional = Number(project.additionalCost || 0);
    const budget = Number(project.estimatedBudget || 0);
    const spent = externalMachining + additional;
    const remaining = budget - spent;
    const ratio = budget > 0 ? Math.min(100, Math.max(0, spent / budget * 100)) : 0;
    const budgetState = budget <= 0 ? 'unset' : remaining < 0 ? 'over' : ratio >= 80 ? 'warning' : 'safe';
    const differenceLabel = budget <= 0
      ? 'Budget à renseigner'
      : remaining >= 0 ? `${money(remaining)} disponible` : `${money(Math.abs(remaining))} dépassé`;
    const readonly = canEdit() ? '' : ' disabled';

    return `<section class="card project-cost-card">
      <div class="card-head project-cost-head">
        <div><span class="section-kicker">FINANCES</span><h3>Coûts du projet</h3><span class="sub">Budget prévisionnel et dépenses liées au projet</span></div>
        <span class="project-cost-edit-hint">Cliquez sur un montant pour le modifier</span>
      </div>
      <div class="project-cost-kpis">
        <label class="project-cost-editable"><span>Budget prévisionnel</span><span class="project-cost-inline"><input type="number" min="0" step="0.01" value="${budget}" data-project-cost-field="estimatedBudget" data-project-id="${escapeHtml(project.id)}" aria-label="Budget prévisionnel en euros"${readonly}><em>€</em></span><small>Modification directe</small></label>
        <label class="project-cost-editable"><span>Frais d’usinage externe</span><span class="project-cost-inline"><input type="number" min="0" step="0.01" value="${externalMachining}" data-project-cost-field="externalMachiningCost" data-project-id="${escapeHtml(project.id)}" aria-label="Frais d’usinage externe en euros"${readonly}><em>€</em></span><small>Indépendant du module Achats</small></label>
        <label class="project-cost-editable"><span>Autres dépenses</span><span class="project-cost-inline"><input type="number" min="0" step="0.01" value="${additional}" data-project-cost-field="additionalCost" data-project-id="${escapeHtml(project.id)}" aria-label="Autres dépenses en euros"${readonly}><em>€</em></span><small>Modification directe</small></label>
        <div class="project-cost-total"><span>Total dépensé</span><b>${money(spent)}</b></div>
        <div class="project-cost-difference ${budgetState}"><span>Écart budget</span><b>${differenceLabel}</b></div>
      </div>
      <div class="project-budget-progress ${budgetState}"><div><span>Dépenses</span><b>${budget > 0 ? `${Math.round(spent / budget * 100)} % du budget` : 'Budget non défini'}</b></div><div class="project-budget-track"><span style="width:${ratio}%"></span></div></div>
    </section>`;
  }

  const projectDetailBeforeCosts = projectDetail;
  projectDetail = function projectDetailWithCosts() {
    const html = projectDetailBeforeCosts.apply(this, arguments);
    const project = data.projects.find(item => item.id === selectedProjectId);
    const costs = projectCosts(project);
    if (!costs) return html;
    const workflowMarker = '<section class="card workflow-card">';
    return html.includes(workflowMarker)
      ? html.replace(workflowMarker, `${costs}${workflowMarker}`)
      : `${html}${costs}`;
  };

  content.addEventListener('keydown', event => {
    if (!event.target.matches('[data-project-cost-field]') || event.key !== 'Enter') return;
    event.preventDefault();
    event.target.blur();
  });

  content.addEventListener('change', event => {
    const input = event.target.closest('[data-project-cost-field]');
    if (!input) return;
    if (!canEdit()) {
      render();
      toast('Mode lecture seule · modification interdite');
      return;
    }
    const project = data.projects.find(item => item.id === input.dataset.projectId);
    const field = input.dataset.projectCostField;
    if (!project || !['estimatedBudget', 'externalMachiningCost', 'additionalCost'].includes(field)) return;
    const value = Number(input.value);
    project[field] = Number.isFinite(value) ? Math.max(0, value) : 0;
    save();
    render();
    toast('Coûts du projet mis à jour');
  });
})();
