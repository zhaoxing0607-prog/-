(() => {
  const DAY = 86400000;
  const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });

  const parseDate = value => {
    const timestamp = Date.parse(`${String(value || '').slice(0, 10)}T00:00:00Z`);
    return Number.isFinite(timestamp) ? timestamp : null;
  };

  const formatDate = timestamp => dateFormatter.format(new Date(timestamp)).replace('.', '');

  const normalizePeriod = (start, end) => Number.isFinite(start) && Number.isFinite(end) ? {
    from: Math.min(start, end),
    to: Math.max(start, end),
    reversed: end < start
  } : { from: null, to: null, reversed: false };

  function comparisonTimelineForProject(project) {
    if (!project) return '';
    const projectStart = project.start || project.created || new Date().toISOString().slice(0, 10);
    const currentIndex = Math.max(0, projectStatuses.indexOf(project.status));
    const stages = stageDefinitions.map((stage, index) => {
      const detail = project.stageDetails?.[stage[0]] || {};
      const defaultStart = parseDate(addDays(projectStart, stage[2]));
      const defaultEnd = parseDate(addDays(projectStart, stage[3]));
      const planned = normalizePeriod(
        parseDate(detail.plannedStart) ?? defaultStart,
        parseDate(detail.plannedEnd) ?? defaultEnd
      );
      const actual = normalizePeriod(
        parseDate(detail.start) ?? planned.from,
        parseDate(detail.end) ?? planned.to
      );
      const state = index < currentIndex || (index === currentIndex && currentIndex === stageDefinitions.length - 1)
        ? 'done'
        : index === currentIndex ? 'active' : 'pending';
      return { key: stage[0], label: stage[1], planned, actual, state };
    }).filter(stage => Number.isFinite(stage.planned.from) && Number.isFinite(stage.actual.from));

    if (!stages.length) return '';
    const allDates = stages.flatMap(stage => [stage.planned.from, stage.planned.to, stage.actual.from, stage.actual.to]);
    const rangeStart = Math.min(...allDates);
    const rangeEnd = Math.max(...allDates);
    const range = Math.max(DAY, rangeEnd - rangeStart + DAY);
    const ticks = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const timestamp = rangeStart + (rangeEnd - rangeStart) * ratio;
      return `<span style="left:${ratio * 100}%">${formatDate(timestamp)}</span>`;
    }).join('');
    const barStyle = period => {
      const left = ((period.from - rangeStart) / range) * 100;
      const width = Math.max(1.8, ((period.to - period.from + DAY) / range) * 100);
      return `left:${left}%;width:${width}%`;
    };
    const rows = stages.map(stage => {
      const difference = Math.round((stage.actual.to - stage.planned.to) / DAY);
      const varianceClass = difference > 0 ? 'late' : difference < 0 ? 'early' : 'ontime';
      const variance = difference > 0 ? `+${difference} j retard` : difference < 0 ? `${Math.abs(difference)} j avance` : 'Conforme';
      const warning = stage.planned.reversed || stage.actual.reversed ? '<small class="timeline-date-warning">Dates à vérifier</small>' : '';
      return `<div class="project-comparison-row">
        <div class="project-comparison-stage"><b>${stage.label}</b>${warning}</div>
        <div class="project-comparison-date planned-date"><span>Prévu</span><b>${formatDate(stage.planned.from)}</b><small>${formatDate(stage.planned.to)}</small></div>
        <div class="project-comparison-date actual-date"><span>Réel</span><b>${formatDate(stage.actual.from)}</b><small>${formatDate(stage.actual.to)}</small></div>
        <div class="project-comparison-variance ${varianceClass}">${variance}</div>
        <div class="project-comparison-track">
          <div class="project-timeline-bar planned comparison-planned" style="${barStyle(stage.planned)}" title="Prévu · ${formatDate(stage.planned.from)} – ${formatDate(stage.planned.to)}"><span>Prévu</span></div>
          <div class="project-timeline-bar ${stage.state} comparison-actual" style="${barStyle(stage.actual)}" title="Réel · ${formatDate(stage.actual.from)} – ${formatDate(stage.actual.to)}"><span>Réel</span></div>
        </div>
      </div>`;
    }).join('');

    return `<section class="card project-timeline-card comparison-timeline-card">
      <div class="card-head project-timeline-head">
        <div><span class="section-kicker">PLANNING & SUIVI</span><h3>Planning prévu / réel</h3><span class="sub">Comparaison des estimations avec l’avancement actualisé du projet</span></div>
        <div class="project-timeline-legend"><span class="planned">Prévu</span><span class="done">Réel terminé</span><span class="active">Réel en cours</span><span class="pending">À venir</span></div>
      </div>
      <div class="project-timeline-scroll">
        <div class="project-comparison-table">
          <div class="project-comparison-header"><span>Étape</span><span>Dates prévues</span><span>Dates réelles</span><span>Écart</span><div class="project-timeline-axis">${ticks}</div></div>
          ${rows}
        </div>
      </div>
    </section>`;
  }

  const projectDetailBeforeTimeline = projectDetail;
  projectDetail = function projectDetailWithTimeline() {
    const html = projectDetailBeforeTimeline.apply(this, arguments);
    const project = data.projects.find(item => item.id === selectedProjectId);
    const timeline = comparisonTimelineForProject(project);
    if (!timeline) return html;
    const relationMarker = '<section class="card relation-card">';
    return html.includes(relationMarker)
      ? html.replace(relationMarker, `${timeline}${relationMarker}`)
      : `${html}${timeline}`;
  };

  const openStageModalBeforePlanning = openStageModal;
  openStageModal = function openStageModalWithPlanning(key) {
    openStageModalBeforePlanning.apply(this, arguments);
    const project = data.projects.find(item => item.id === selectedProjectId);
    const stage = stageDefinitions.find(item => item[0] === key);
    const fieldsContainer = document.querySelector('#formFields');
    if (!project || !stage || !fieldsContainer) return;
    const detail = project.stageDetails?.[key] || {};
    const projectStart = project.start || project.created || new Date().toISOString().slice(0, 10);
    const plannedStart = detail.plannedStart || addDays(projectStart, stage[2]);
    const plannedEnd = detail.plannedEnd || addDays(projectStart, stage[3]);
    fieldsContainer.insertAdjacentHTML('afterbegin', `
      <div class="field full planning-modal-heading"><span>PLANNING PRÉVISIONNEL</span><small>Dates estimées avant le démarrage de cette étape</small></div>
      <div class="field"><label>Début prévu</label><input name="plannedStart" type="date" value="${plannedStart}"></div>
      <div class="field"><label>Fin prévue</label><input name="plannedEnd" type="date" value="${plannedEnd}"></div>
      <div class="field full planning-modal-heading actual-heading"><span>SUIVI ACTUEL</span><small>Dates réelles ou révisées pendant le projet</small></div>
    `);
    const actualStartLabel = fieldsContainer.querySelector('input[name="start"]')?.closest('.field')?.querySelector('label');
    const actualEndLabel = fieldsContainer.querySelector('input[name="end"]')?.closest('.field')?.querySelector('label');
    if (actualStartLabel) actualStartLabel.textContent = 'Début réel / actualisé';
    if (actualEndLabel) actualEndLabel.textContent = 'Fin réelle / actualisée';
  };
})();
