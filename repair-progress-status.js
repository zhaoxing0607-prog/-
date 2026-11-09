(() => {
  const repairProgress = {
    'À traiter': 20,
    'Achat requis': 40,
    'Usinage': 60,
    'En réparation': 80,
    'Terminé': 100
  };

  const previousRepairRow = defs.repairs.row;
  defs.repairs.row = repair => {
    const html = previousRepairRow(repair);
    const percent = repairProgress[repair.status] || 0;
    return html.replace(
      /<select class="status-select repair-status[^"]*" data-repair-status="[^"]+">.*?<\/select>/,
      select => `<div class="repair-progress-control ${percent === 100 ? 'complete' : ''}" style="--repair-progress:${percent}%"><div class="repair-progress-track" aria-hidden="true"><span></span></div><div class="repair-progress-copy" aria-hidden="true"><strong>${repair.status}</strong><em>${percent}%</em></div>${select}</div>`
    );
  };
})();
