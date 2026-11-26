(() => {
  const MAX_FILES = 10;
  const MAX_SIZE = 10 * 1024 * 1024;
  const acceptedExtensions = /\.(jpe?g|png|webp|pdf|docx?|xlsx?|txt|csv|zip|dwg|dxf|stp|step|stl|obj|glb|gltf)$/i;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const formatSize = bytes => {
    const size = Number(bytes) || 0;
    return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(size / 1024))} Ko`;
  };
  const fileIcon = file => {
    const type = String(file?.type || '').toLowerCase();
    const name = String(file?.name || '');
    if (type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(name)) return 'IMG';
    if (type.includes('pdf') || /\.pdf$/i.test(name)) return 'PDF';
    if (/\.docx?$/i.test(name)) return 'DOC';
    if (/\.xlsx?$/i.test(name)) return 'XLS';
    if (/\.(dwg|dxf)$/i.test(name)) return 'CAD';
    if (/\.(stp|step|stl|obj|glb|gltf)$/i.test(name)) return '3D';
    if (/\.zip$/i.test(name)) return 'ZIP';
    return 'FILE';
  };

  const projectDetailBeforeAttachments = projectDetail;
  projectDetail = function projectDetailWithAttachments() {
    const html = projectDetailBeforeAttachments.apply(this, arguments);
    const project = data.projects.find(item => item.id === selectedProjectId);
    if (!project) return html;
    const files = Array.isArray(project.documents) ? project.documents.filter(file => file?.path) : [];
    const fileList = files.length
      ? `<div class="project-document-list">${files.map(file => `<article class="project-document-item"><span class="project-document-icon type-${fileIcon(file).toLowerCase()}">${fileIcon(file)}</span><div><b>${escapeHtml(file.name || 'Document')}</b><small>${formatSize(file.size)} · ${escapeHtml(fileIcon(file))}</small></div><button type="button" data-open-project-document="${escapeHtml(file.path)}">Ouvrir</button>${window.MoldCloud?.canManageAttachments() ? `<button type="button" class="danger" data-delete-project-document="${escapeHtml(file.path)}">Supprimer</button>` : ''}</article>`).join('')}</div>`
      : '<div class="project-document-empty">Aucun document associé à ce projet.</div>';
    const uploadZone = window.MoldCloud?.canManageAttachments() ? `<div class="project-document-dropzone" data-project-document-dropzone="${escapeHtml(project.id)}" tabindex="0" role="button" aria-label="Ajouter des documents au projet"><span>＋</span><div><b>Déposez les fichiers ici</b><small>ou cliquez pour sélectionner · 10 fichiers maximum · 10 Mo par fichier</small></div><button type="button" class="primary" data-add-project-documents="${escapeHtml(project.id)}">Choisir des fichiers</button></div>` : '';
    const section = `<section class="card project-documents-card"><div class="card-head"><div><span class="section-kicker">DOCUMENTS ASSOCIÉS</span><h3>Fichiers du projet</h3><span class="sub">Plans, cahiers des charges, devis, photos, fichiers CAO et documents techniques</span></div><span class="project-document-count">${files.length} / ${MAX_FILES}</span></div>${uploadZone}${fileList}</section>`;
    const workflowMarker = '<section class="card workflow-card">';
    return html.includes(workflowMarker) ? html.replace(workflowMarker, `${section}${workflowMarker}`) : `${html}${section}`;
  };

  document.body.insertAdjacentHTML('beforeend', '<input type="file" id="projectDocumentInput" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.dwg,.dxf,.stp,.step,.stl,.obj,.glb,.gltf" hidden>');
  const input = document.querySelector('#projectDocumentInput');
  let targetProjectId = '';

  async function uploadFiles(fileList, projectId) {
    const files = [...(fileList || [])];
    const project = data.projects.find(item => item.id === projectId);
    if (!files.length || !project || !window.MoldCloud?.canManageAttachments()) return;
    const existing = Array.isArray(project.documents) ? project.documents : [];
    if (existing.length + files.length > MAX_FILES) {
      toast(`Maximum ${MAX_FILES} documents associés par projet`);
      return;
    }
    if (files.some(file => file.size > MAX_SIZE)) {
      toast('Chaque document doit faire au maximum 10 Mo');
      return;
    }
    if (files.some(file => !acceptedExtensions.test(file.name))) {
      toast('Format non accepté pour un ou plusieurs fichiers');
      return;
    }
    const zone = document.querySelector(`[data-project-document-dropzone="${CSS.escape(project.id)}"]`);
    zone?.classList.add('uploading');
    const uploaded = [];
    try {
      for (const file of files) uploaded.push(await window.MoldCloud.uploadAchatAttachment(`project-${project.id}`, file));
      project.documents = [...existing, ...uploaded];
      save();
      render();
      toast(`${uploaded.length} document${uploaded.length > 1 ? 's' : ''} ajouté${uploaded.length > 1 ? 's' : ''}`);
    } catch (error) {
      await Promise.all(uploaded.map(file => window.MoldCloud.removeAchatAttachment(file.path).catch(() => null)));
      zone?.classList.remove('uploading');
      toast(error.message || 'Impossible d’envoyer les documents');
    }
  }

  document.addEventListener('click', async event => {
    const add = event.target.closest('[data-add-project-documents]');
    const zone = event.target.closest('[data-project-document-dropzone]');
    if (add || (zone && !event.target.closest('button'))) {
      if (!window.MoldCloud?.canManageAttachments()) return;
      targetProjectId = add?.dataset.addProjectDocuments || zone.dataset.projectDocumentDropzone;
      input.value = '';
      input.click();
      return;
    }
    const open = event.target.closest('[data-open-project-document]');
    if (open) {
      const project = data.projects.find(item => item.id === selectedProjectId);
      const file = project?.documents?.find(item => item.path === open.dataset.openProjectDocument);
      open.disabled = true;
      try {
        const url = await window.MoldCloud.achatAttachmentUrl(open.dataset.openProjectDocument);
        if (!url) throw new Error('Document introuvable');
        await window.ToolDocumentViewer.open(url, file || {name:open.dataset.openProjectDocument.split('/').pop(), path:open.dataset.openProjectDocument});
      } catch (error) {
        toast(error.message || 'Impossible d’ouvrir le document');
      } finally {
        open.disabled = false;
      }
      return;
    }
    const remove = event.target.closest('[data-delete-project-document]');
    if (!remove || !window.MoldCloud?.canManageAttachments()) return;
    const project = data.projects.find(item => item.id === selectedProjectId);
    const path = remove.dataset.deleteProjectDocument;
    if (!project || !confirm('Supprimer définitivement ce document du projet ?')) return;
    remove.disabled = true;
    try {
      await window.MoldCloud.removeAchatAttachment(path);
      project.documents = (project.documents || []).filter(file => file.path !== path);
      save();
      render();
      toast('Document du projet supprimé');
    } catch (error) {
      remove.disabled = false;
      toast(error.message || 'Impossible de supprimer le document');
    }
  });

  document.addEventListener('keydown', event => {
    const zone = event.target.closest('[data-project-document-dropzone]');
    if (!zone || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    targetProjectId = zone.dataset.projectDocumentDropzone;
    input.value = '';
    input.click();
  });

  document.addEventListener('dragover', event => {
    const zone = event.target.closest('[data-project-document-dropzone]');
    if (!zone) return;
    event.preventDefault();
    zone.classList.add('dragging');
  });
  document.addEventListener('dragleave', event => event.target.closest('[data-project-document-dropzone]')?.classList.remove('dragging'));
  document.addEventListener('drop', event => {
    const zone = event.target.closest('[data-project-document-dropzone]');
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove('dragging');
    uploadFiles(event.dataTransfer?.files, zone.dataset.projectDocumentDropzone);
  });
  input.addEventListener('change', () => uploadFiles(input.files, targetProjectId || selectedProjectId));
})();
