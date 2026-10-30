(() => {
  const machinistOptions = ['Interne', 'Externe'];

  const statusFieldIndex = fields.projects.findIndex(field => field[0] === 'status');
  if (!fields.projects.some(field => field[0] === 'machinist')) {
    fields.projects.splice(Math.max(0, statusFieldIndex), 0, [
      'machinist',
      'Usineur',
      'select',
      machinistOptions
    ]);
  }

  if (!defs.projects.headers.includes('Usineur')) {
    defs.projects.headers.splice(-1, 0, 'Usineur');
    const previousProjectRow = defs.projects.row;
    defs.projects.row = project => {
      const selected = machinistOptions.includes(project.machinist) ? project.machinist : 'Interne';
      const optionsHtml = machinistOptions.map(option =>
        `<option value="${option}" ${option === selected ? 'selected' : ''}>${option}</option>`
      ).join('');
      return `${previousProjectRow(project)}<td><select class="status-select project-machinist-select" data-project-machinist="${project.id}" aria-label="Usineur de ${project.id}">${optionsHtml}</select></td>`;
    };
  }

  const previousListPage = listPage;
  listPage = type => {
    if (type === 'projects') filter = 'Tous';
    const html = previousListPage(type);
    if (type !== 'projects') return html;
    return html.replace(/<div class="filter-group">.*?<\/div>/, '');
  };

  content.addEventListener('change', event => {
    const select = event.target.closest('[data-project-machinist]');
    if (!select) return;
    if (!canEdit()) {
      render();
      toast('Mode lecture seule · modification interdite');
      return;
    }
    const project = data.projects.find(item => item.id === select.dataset.projectMachinist);
    if (!project) return;
    project.machinist = select.value;
    save();
    toast(`Usineur mis à jour : ${select.value}`);
  });
})();
