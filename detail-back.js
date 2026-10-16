(() => {
  const button = document.getElementById('headerBackBtn');
  if (!button || typeof render !== 'function') return;

  const detailTargets = {
    projectDetail: { view: 'projects', label: 'Retour aux fabrications', clear: () => { selectedProjectId = null; } },
    partDetail: { view: 'parts', label: 'Retour au catalogue de pièces', clear: () => { selectedPartId = null; } },
    mouldDetail: { view: 'moulds', label: 'Retour au parc de moules', clear: () => { selectedMouldId = null; } },
    repairDetail: { view: 'repairs', label: 'Retour aux pannes et réparations', clear: () => { selectedRepairId = null; } },
    purchaseDetail: { view: 'purchases', label: 'Retour aux achats', clear: () => { selectedPurchaseId = null; } }
  };

  function updateHeaderBackButton() {
    const target = detailTargets[view];
    button.hidden = !target;
    document.body.classList.toggle('has-header-back', Boolean(target));
    if (!target) return;
    button.title = target.label;
    button.setAttribute('aria-label', target.label);
  }

  button.addEventListener('click', () => {
    const target = detailTargets[view];
    if (!target) return;
    target.clear();
    view = target.view;
    render();
  });

  const originalRender = render;
  render = function renderWithHeaderBack() {
    const result = originalRender.apply(this, arguments);
    updateHeaderBackButton();
    return result;
  };

  updateHeaderBackButton();
})();
