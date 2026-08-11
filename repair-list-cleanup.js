(() => {
  const costColumn = defs.repairs.headers.indexOf('Coût');
  if (costColumn === -1) return;

  defs.repairs.headers.splice(costColumn, 1);
  const rowWithCost = defs.repairs.row;
  defs.repairs.row = repair => rowWithCost(repair).replace(`<td>${money(repair.cost)}</td>`, '');
})();
