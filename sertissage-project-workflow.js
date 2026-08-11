(() => {
  const unifiedProjectStatuses = ['Amont', 'En conception', 'Mise en plan', 'Usinage', 'Test', 'Validé'];
  const statusMigration = {
    'Conception': 'En conception',
    'Affectation aux fournisseurs': 'Mise en plan',
    'Mise au plan et essai': 'Test'
  };

  projectStatuses.splice(0, projectStatuses.length, ...unifiedProjectStatuses);
  sertissageProjectStatuses.splice(0, sertissageProjectStatuses.length, ...unifiedProjectStatuses);
  options.projects.splice(0, options.projects.length, 'Tous', ...unifiedProjectStatuses);

  Object.assign(projectProgress, {
    'Amont': 10,
    'En conception': 30,
    'Mise en plan': 40,
    'Usinage': 60,
    'Test': 80,
    'Validé': 100
  });

  stageDefinitions[0][1] = 'AMONT';
  stageDefinitions[1][1] = 'EN CONCEPTION';
  stageDefinitions[2][1] = 'MISE EN PLAN';
  stageDefinitions[3][1] = 'USINAGE';
  stageDefinitions[4][1] = 'TEST';
  stageDefinitions[5][1] = 'VALIDÉ';

  function normalizeUnifiedProjects() {
    data.projects.forEach(project => {
      project.status = statusMigration[project.status] || project.status;
      normalizeProjectStatus(project);
    });
  }

  normalizeUnifiedProjects();
  window.addEventListener('moldflow-cloud-ready', () => {
    normalizeUnifiedProjects();
    localStorage.setItem('mouldOpsDataFr', JSON.stringify(data));
    render();
  });
})();
