(() => {
  let tickets = [], editingTicketId = null, loading = false;
  const backdrop = document.querySelector('#pressProjectTicketBackdrop');
  const form = document.querySelector('#pressProjectTicketForm');
  if (!backdrop || !form) return;

  const escapeHtml = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  const nextProjectId = () => {
    const max = data.projects.reduce((value, project) => Math.max(value, Number(String(project.id || '').match(/\d+/)?.[0] || 0)), 0);
    return `P-${String(max + 1).padStart(4, '0')}`;
  };
  const projectTabs = () => `<div class="mould-page-tabs project-page-tabs"><button class="mould-page-tab ${projectPage==='emboutissage'?'active':''}" data-project-page="emboutissage"><strong>Projets emboutissage</strong><span>Emboutissage et pièces unitaires</span></button><button class="mould-page-tab ${projectPage==='sertissage'?'active':''}" data-project-page="sertissage"><strong>Projets sertissage</strong><span>Jeux de pose sertissage</span></button><button class="mould-page-tab ${projectPage==='presse'?'active':''}" data-project-page="presse"><strong>Projets presse</strong><span>Presses et équipements de production</span></button></div>`;
  const statusMarkup = ticket => {
    const status = ticket.status === 'approved' ? ['approved', 'Approuvé'] : ticket.status === 'rejected' ? ['rejected', 'Refusé'] : ['pending', 'En attente'];
    return `<span class="ticket-status-wrap"><span class="ticket-status ${status[0]}">${status[1]}</span>${canEdit()?`<button class="delete-ticket" data-delete-press-ticket="${ticket.id}">Supprimer</button>`:''}</span>`;
  };
  const ticketPanel = () => {
    const admin = canEdit(), userId = window.MoldCloud?.getUserId();
    const visible = admin ? tickets : tickets.filter(ticket => ticket.requester_id === userId);
    const rows = visible.map(ticket => {
      const date = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('fr-FR') : '—';
      const requesterCanEdit = !admin && ticket.status === 'pending' && ticket.requester_id === userId;
      return `<div class="ticket-row press-project-ticket-row"><div><b>PP-${String(ticket.id).padStart(4,'0')}</b><span>${date}</span></div><div class="ticket-description"><strong>${escapeHtml(ticket.priority || 'Normal')}</strong><b>${escapeHtml(ticket.project_name)}</b><span>${escapeHtml(ticket.customer || 'Client à définir')} · Demandé par ${escapeHtml(ticket.requester_name)}</span><p>${escapeHtml(ticket.description)}</p></div>${statusMarkup(ticket)}<div class="ticket-actions">${admin&&ticket.status==='pending'?`<button class="approve-ticket" data-approve-press-ticket="${ticket.id}">Approuver</button><button class="reject-ticket" data-reject-press-ticket="${ticket.id}">Refuser</button>`:requesterCanEdit?`<button class="edit-ticket" data-edit-press-ticket="${ticket.id}">Modifier</button>`:ticket.project_id?`<button class="relation-chip" data-project="${escapeHtml(ticket.project_id)}">${escapeHtml(ticket.project_id)}</button>`:''}</div></div>`;
    }).join('');
    return `<section class="card panne-ticket-card press-project-ticket-card"><div class="card-head"><div><span class="section-kicker">${admin?'VALIDATION ADMINISTRATEUR':'DEMANDES DE PROJET'}</span><h3>${admin?'Tickets projet presse':'Mes tickets projet presse'}</h3></div><button class="primary" data-new-press-ticket>＋ Nouveau ticket</button></div><div class="ticket-list">${rows||'<div class="empty">Aucun ticket projet presse.</div>'}</div></section>`;
  };

  const mouldTypeField = fields.projects.find(field => field[0] === 'mouldType');
  if (mouldTypeField && !mouldTypeField[3].includes('Presse')) mouldTypeField[3].push('Presse');

  const previousListPage = listPage;
  listPage = type => {
    if (type !== 'projects') return previousListPage(type);
    const allProjects = data.projects, actualPage = projectPage;
    data.projects = allProjects.filter(project => actualPage === 'presse' ? project.mouldType === 'Presse' : actualPage === 'sertissage' ? project.mouldType === 'Sertissage' : !['Sertissage','Presse'].includes(project.mouldType));
    if (actualPage === 'presse') projectPage = 'emboutissage';
    let html;
    try { html = previousListPage(type); }
    finally { data.projects = allProjects; projectPage = actualPage; }
    html = html.replace(/^<div class="mould-page-tabs">.*?<\/div>/, projectTabs());
    if (actualPage === 'presse') html = html.replace('</div><div class="toolbar">', `</div>${ticketPanel()}<div class="toolbar">`);
    return html;
  };

  const previousOpenModal = openModal;
  openModal = (type, record = null) => {
    previousOpenModal(type, record);
    if (type !== 'projects' || record || projectPage !== 'presse') return;
    const typeField = form.ownerDocument.querySelector('#entityForm').elements.namedItem('mouldType');
    const numberField = form.ownerDocument.querySelector('#entityForm').elements.namedItem('id');
    if (typeField) typeField.value = 'Presse';
    if (numberField) { numberField.value = nextProjectId(); numberField.readOnly = true; numberField.title = 'Numéro attribué automatiquement'; }
    document.querySelector('#modalTitle').textContent = 'Nouveau projet presse';
  };

  function openTicketModal(ticket = null) {
    form.reset();
    editingTicketId = ticket?.id || null;
    form.elements.projectName.value = ticket?.project_name || '';
    form.elements.customer.value = ticket?.customer || '';
    form.elements.priority.value = ticket?.priority || 'Normal';
    form.elements.description.value = ticket?.description || '';
    document.querySelector('#pressProjectTicketRequester').value = ticket?.requester_name || currentMemberName;
    document.querySelector('#pressProjectTicketEyebrow').textContent = ticket ? 'MODIFICATION AVANT VALIDATION' : 'DEMANDE DE PROJET PRESSE';
    document.querySelector('#pressProjectTicketTitle').textContent = ticket ? 'Modifier le ticket projet presse' : 'Créer un ticket projet presse';
    document.querySelector('#pressProjectTicketSubmit').textContent = ticket ? 'Enregistrer les modifications' : 'Envoyer la demande';
    const error = document.querySelector('#pressProjectTicketFormError');
    error.textContent = ''; error.classList.remove('visible');
    backdrop.classList.add('open');
  }
  function closeTicketModal() { backdrop.classList.remove('open'); form.reset(); editingTicketId = null; }
  async function refreshTickets() {
    if (loading || !window.MoldCloud?.getUserId() || !window.MoldCloud?.listPressProjectTickets) return;
    loading = true;
    try { tickets = await window.MoldCloud.listPressProjectTickets() || []; if (view === 'projects' && projectPage === 'presse') render(); }
    catch (error) { console.warn('Press project tickets:', error.message); }
    finally { loading = false; }
  }
  async function approveTicket(id) {
    const ticket = tickets.find(item => String(item.id) === String(id));
    if (!ticket || !canEdit() || !confirm(`Approuver le ticket PP-${String(ticket.id).padStart(4,'0')} et créer le projet presse ?`)) return;
    let project = data.projects.find(item => String(item.sourcePressProjectTicketId) === String(ticket.id));
    if (!project) {
      const today = new Date().toISOString().slice(0,10);
      project = { id: nextProjectId(), name: ticket.project_name, customer: ticket.customer || 'À définir', owner: ticket.requester_name, mouldType: 'Presse', status: 'Amont', progress: projectProgress.Amont, priority: ticket.priority || 'Normal', created: today, start: today, due: '', linkedPartIds: [], workLogs: [], stageDetails: {}, description: ticket.description || '', sourcePressProjectTicketId: ticket.id };
      data.projects.unshift(project); save();
    }
    try { await window.MoldCloud.reviewPressProjectTicket(ticket.id, 'approved', project.id); await refreshTickets(); toast(`Ticket approuvé · ${project.id} créé`); }
    catch (error) { toast(error.message || 'Validation impossible'); }
  }
  async function rejectTicket(id) {
    const ticket = tickets.find(item => String(item.id) === String(id));
    if (!ticket || !canEdit() || !confirm(`Refuser le ticket PP-${String(ticket.id).padStart(4,'0')} ?`)) return;
    try { await window.MoldCloud.reviewPressProjectTicket(ticket.id, 'rejected'); await refreshTickets(); toast('Ticket projet presse refusé'); }
    catch (error) { toast(error.message || 'Validation impossible'); }
  }
  async function deleteTicket(id) {
    if (!canEdit() || !confirm('Supprimer définitivement ce ticket projet presse ?')) return;
    try { await window.MoldCloud.deletePressProjectTicket(id); await refreshTickets(); toast('Ticket projet presse supprimé'); }
    catch (error) { toast(error.message || 'Suppression impossible'); }
  }

  content.addEventListener('click', event => {
    if (event.target.closest('[data-new-press-ticket]')) { openTicketModal(); return; }
    const edit = event.target.closest('[data-edit-press-ticket]');
    if (edit) { const ticket = tickets.find(item => String(item.id) === edit.dataset.editPressTicket); if (ticket?.status === 'pending' && ticket.requester_id === window.MoldCloud?.getUserId()) openTicketModal(ticket); return; }
    const approve = event.target.closest('[data-approve-press-ticket]'); if (approve) { approveTicket(approve.dataset.approvePressTicket); return; }
    const reject = event.target.closest('[data-reject-press-ticket]'); if (reject) { rejectTicket(reject.dataset.rejectPressTicket); return; }
    const remove = event.target.closest('[data-delete-press-ticket]'); if (remove) deleteTicket(remove.dataset.deletePressTicket);
  });
  form.onsubmit = async event => {
    event.preventDefault();
    const submit = document.querySelector('#pressProjectTicketSubmit'), error = document.querySelector('#pressProjectTicketFormError'), payload = { projectName: form.elements.projectName.value.trim(), customer: form.elements.customer.value.trim(), priority: form.elements.priority.value, description: form.elements.description.value.trim() }, wasEditing = Boolean(editingTicketId), label = submit.textContent;
    error.textContent = ''; error.classList.remove('visible'); submit.disabled = true; submit.textContent = wasEditing ? 'Enregistrement…' : 'Envoi en cours…';
    try { await window.MoldCloud[wasEditing?'updatePressProjectTicket':'createPressProjectTicket'](...(wasEditing?[editingTicketId,payload]:[payload])); closeTicketModal(); await refreshTickets(); toast(wasEditing?'Ticket modifié · en attente de validation':'Ticket envoyé · en attente de validation'); }
    catch (ticketError) { error.textContent = String(ticketError.message || '').includes('toolmanager_press_project_tickets') ? 'Configuration Supabase manquante : la table des tickets projet presse doit être installée.' : `Échec de l’enregistrement : ${ticketError.message || 'Erreur inconnue'}`; error.classList.add('visible'); }
    finally { submit.disabled = false; submit.textContent = label; }
  };
  document.querySelector('#closePressProjectTicketModal').onclick = document.querySelector('#cancelPressProjectTicketModal').onclick = closeTicketModal;
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && backdrop.classList.contains('open')) closeTicketModal(); });
  window.addEventListener('toolmanager-role-ready', refreshTickets);
  window.addEventListener('moldflow-cloud-ready', refreshTickets);
  window.addEventListener('focus', refreshTickets);
  setInterval(() => { if (!document.hidden && view === 'projects' && projectPage === 'presse') refreshTickets(); }, 15000);
})();
