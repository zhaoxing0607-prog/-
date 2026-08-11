(() => {
  const baseListPage = listPage;

  function memoRow(note) {
    return `<tr>
      <td>${badge(note.status || 'À faire')}</td>
      <td><b class="memo-title">${note.title || 'Sans titre'}</b></td>
      <td>${note.projectId ? projectRelationLink(note.projectId) : 'Aucun projet associé'}</td>
      <td>${(note.linkedPartIds || []).map(partRelationChip).join('') || 'Aucune pièce associée'}</td>
      <td><span class="memo-actor">${note.actor || 'XING'}</span></td>
      <td class="memo-preview">${note.content || '—'}</td>
      <td class="row-actions"><button class="edit-btn" data-edit="${note.id}" data-type="notes">Modifier</button><button data-delete="${note.id}" data-type="notes">Supprimer</button></td>
    </tr>`;
  }

  function memoListPage() {
    const query = $('#globalSearch').value.trim().toLowerCase();
    const notes = data.notes
      .slice()
      .filter(note => (!query || Object.values(note).join(' ').toLowerCase().includes(query)) && (filter === 'Tous' || note.status === filter))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const groups = notes.reduce((result, note) => {
      const date = note.date || 'Sans date';
      (result[date] ||= []).push(note);
      return result;
    }, {});
    const dates = Object.keys(groups);
    const headers = defs.notes.headers.filter(header => header !== 'Date');

    return `<div class="toolbar"><div class="filter-group">${options.notes.map(value => `<button class="filter ${filter === value ? 'active' : ''}" data-filter="${value}">${value}</button>`).join('')}</div><span class="sub">${notes.length} note${notes.length > 1 ? 's' : ''}</span></div>
      <div class="memo-day-list">${dates.length ? dates.map((date, index) => `<details class="memo-day" ${index === 0 ? 'open' : ''}>
        <summary><span><b>${date}</b><small>${groups[date].length} note${groups[date].length > 1 ? 's' : ''}</small></span><span class="memo-day-chevron" aria-hidden="true">⌄</span></summary>
        <div class="table-wrap"><table><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${groups[date].map(memoRow).join('')}</tbody></table></div>
      </details>`).join('') : '<div class="empty memo-empty">Aucune note ne correspond aux filtres.</div>'}</div>`;
  }

  listPage = type => type === 'notes' ? memoListPage() : baseListPage(type);
  if (view === 'notes') render();
})();
