(() => {
  const MAX_PHOTOS = 4;
  const MAX_SIZE = 3 * 1024 * 1024;
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const form = document.querySelector('#entityForm');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function photosFor(log) {
    return Array.isArray(log?.photos) ? log.photos.filter(photo => photo?.path) : [];
  }

  function galleryHtml(log) {
    const photos = photosFor(log);
    if (!photos.length) return '';
    return `<div class="project-log-photos"><span>Photos · ${photos.length}</span><div class="project-log-photo-grid">${photos.map(photo =>
      `<button type="button" class="project-log-photo" data-open-project-log-photo="${escapeHtml(photo.path)}" aria-label="Agrandir ${escapeHtml(photo.name || 'la photo du journal')}"><img data-project-log-photo="${escapeHtml(photo.path)}" alt="${escapeHtml(photo.name || 'Photo du journal')}"></button>`
    ).join('')}</div></div>`;
  }

  const originalSection = projectLogSection;
  projectLogSection = () => {
    const html = originalSection();
    const project = data.projects.find(item => item.id === selectedProjectId);
    const logs = (project?.workLogs || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (!logs.some(log => photosFor(log).length)) return html;
    const template = document.createElement('template');
    template.innerHTML = html;
    template.content.querySelectorAll('.log-entry').forEach((article, index) => {
      const work = article.children[1];
      if (work && logs[index]) work.insertAdjacentHTML('beforeend', galleryHtml(logs[index]));
    });
    return template.innerHTML;
  };

  async function hydrate(root = document) {
    await Promise.all([...root.querySelectorAll('[data-project-log-photo]')].map(async image => {
      try {
        const url = await window.MoldCloud?.pannePhotoUrl(image.dataset.projectLogPhoto);
        if (url) image.src = url;
      } catch {
        image.closest('.project-log-photo')?.classList.add('photo-unavailable');
      }
    }));
  }

  const originalRender = render;
  render = () => {
    originalRender();
    hydrate();
  };

  const originalOpen = openProjectLog;
  function releasePending() {
    (form._projectLogFiles || []).forEach(item => URL.revokeObjectURL(item.url));
    form._projectLogFiles = [];
  }
  openProjectLog = (projectId, logId = '') => {
    releasePending();
    originalOpen(projectId, logId);
    const project = data.projects.find(item => item.id === projectId);
    const log = (project?.workLogs || []).find(item => item.id === logId);
    const photos = photosFor(log);
    form._projectLogRemovedPhotos = new Set();
    form._projectLogFiles = [];
    document.querySelector('#formFields').insertAdjacentHTML('beforeend', `
      <div class="field full project-log-photo-field">
        <label>Photos du journal <span class="optional-label">(maximum ${MAX_PHOTOS})</span></label>
        <div class="project-log-photo-editor" id="projectLogPhotoEditor">${photos.map(photo => `
          <figure class="project-log-photo-preview" data-project-log-existing="${escapeHtml(photo.path)}">
            <img data-project-log-photo="${escapeHtml(photo.path)}" alt="${escapeHtml(photo.name || 'Photo du journal')}">
            <figcaption>${escapeHtml(photo.name || 'Photo')}</figcaption>
            <button type="button" data-remove-project-log-photo="${escapeHtml(photo.path)}">Retirer</button>
          </figure>`).join('')}</div>
        <input type="file" id="projectLogPhotoInput" accept="image/jpeg,image/png,image/webp" multiple ${window.MoldCloud?.enabled ? '' : 'disabled'}>
        <small>JPG, PNG ou WebP · compression automatique · ${MAX_PHOTOS} photos maximum par entrée.${window.MoldCloud?.enabled ? '' : ' Connectez le stockage cloud pour ajouter des photos.'}</small>
        <div class="ticket-form-error" id="projectLogPhotoError" role="alert"></div>
      </div>`);
    hydrate(form);
    document.querySelector('#projectLogPhotoInput').addEventListener('change', event => {
      const input = event.target;
      const incoming = [...input.files];
      input.value = '';
      const error = document.querySelector('#projectLogPhotoError');
      error.classList.remove('visible');
      if (incoming.some(file => !allowedTypes.has(file.type))) {
        showError('Utilisez uniquement des images JPG, PNG ou WebP.');
        return;
      }
      const retained = photos.filter(photo => !form._projectLogRemovedPhotos.has(photo.path)).length;
      if (retained + form._projectLogFiles.length + incoming.length > MAX_PHOTOS) {
        showError(`Ce journal peut contenir au maximum ${MAX_PHOTOS} photos.`);
        return;
      }
      const editor = document.querySelector('#projectLogPhotoEditor');
      incoming.forEach(file => {
        const key = crypto.randomUUID();
        const url = URL.createObjectURL(file);
        form._projectLogFiles.push({ key, file, url });
        const figure = document.createElement('figure');
        figure.className = 'project-log-photo-preview';
        figure.dataset.projectLogPending = key;
        figure.innerHTML = `<img src="${url}" alt="${escapeHtml(file.name)}"><figcaption>${escapeHtml(file.name)}</figcaption><button type="button" data-remove-project-log-pending="${key}">Retirer</button>`;
        editor.appendChild(figure);
      });
    });
  };

  function showError(message) {
    const error = document.querySelector('#projectLogPhotoError');
    if (!error) return;
    error.textContent = message;
    error.classList.add('visible');
  }

  async function compress(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const makeBlob = (maximum, quality) => {
        const scale = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compression de la photo impossible')), 'image/jpeg', quality));
      };
      let blob = await makeBlob(1600, .82);
      if (blob.size > MAX_SIZE) blob = await makeBlob(1280, .7);
      if (blob.size > MAX_SIZE) throw new Error('La photo reste trop volumineuse après compression.');
      return new File([blob], `journal-${crypto.randomUUID()}.jpg`, { type: 'image/jpeg' });
    } finally {
      bitmap.close?.();
    }
  }

  async function removePhotos(photos) {
    await Promise.allSettled(photos.map(photo => window.MoldCloud?.removePannePhoto(photo.path)));
  }

  document.addEventListener('submit', async event => {
    if (event.target !== form || form.dataset.type !== 'projectLog') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!canEdit()) return;
    const project = data.projects.find(item => item.id === form.dataset.editId);
    const logId = form.dataset.logId;
    const existing = (project?.workLogs || []).find(item => item.id === logId);
    const removed = form._projectLogRemovedPhotos || new Set();
    const retained = photosFor(existing).filter(photo => !removed.has(photo.path));
    const selected = form._projectLogFiles || [];
    if (!project || (logId && !existing)) return showError('Journal introuvable. Rechargez la page.');
    if (retained.length + selected.length > MAX_PHOTOS) return showError(`Maximum ${MAX_PHOTOS} photos par entrée.`);
    const submit = form.querySelector('[type="submit"]');
    const originalLabel = submit.textContent;
    submit.disabled = true;
    submit.textContent = selected.length ? 'Compression et envoi…' : 'Enregistrement…';
    const uploaded = [];
    try {
      const entry = Object.fromEntries(new FormData(form));
      entry.id = logId || `LOG-${project.id}-${Date.now()}`;
      for (const selection of selected) {
        const file = await compress(selection.file);
        const photo = await window.MoldCloud.uploadPannePhoto(`journal-${project.id}-${entry.id}`, file);
        photo.name = selection.file.name;
        uploaded.push(photo);
      }
      entry.photos = [...retained, ...uploaded];
      if (logId) {
        const index = project.workLogs.findIndex(item => item.id === logId);
        project.workLogs[index] = { ...project.workLogs[index], ...entry };
      } else project.workLogs = [entry, ...(project.workLogs || [])];
      project.status = entry.status;
      project.progress = projectProgress[entry.status];
      ensureSupplierPurchase(project);
      save();
      releasePending();
      closeModal();
      render();
      toast(logId ? 'Journal modifié' : 'Journal de travail ajouté');
      await removePhotos(photosFor(existing).filter(photo => removed.has(photo.path)));
    } catch (error) {
      await removePhotos(uploaded);
      showError(error.message || 'Impossible d’enregistrer les photos.');
    } finally {
      submit.disabled = false;
      submit.textContent = originalLabel;
    }
  }, true);

  document.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-project-log-photo]');
    if (remove) {
      form._projectLogRemovedPhotos?.add(remove.dataset.removeProjectLogPhoto);
      remove.closest('.project-log-photo-preview')?.remove();
      return;
    }
    const pending = event.target.closest('[data-remove-project-log-pending]');
    if (pending) {
      const key = pending.dataset.removeProjectLogPending;
      const index = form._projectLogFiles?.findIndex(item => item.key === key) ?? -1;
      if (index >= 0) URL.revokeObjectURL(form._projectLogFiles.splice(index, 1)[0].url);
      pending.closest('.project-log-photo-preview')?.remove();
      return;
    }
    const open = event.target.closest('[data-open-project-log-photo]');
    if (!open) return;
    const path = open.dataset.openProjectLogPhoto;
    const image = open.querySelector('img');
    const viewer = document.querySelector('#projectLogPhotoViewer');
    const large = viewer.querySelector('img');
    large.removeAttribute('src');
    large.alt = image.alt;
    viewer.querySelector('p').textContent = image.alt;
    viewer.classList.add('open');
    viewer.setAttribute('aria-hidden', 'false');
    window.MoldCloud.pannePhotoUrl(path).then(url => { if (viewer.classList.contains('open')) large.src = url; }).catch(() => {
      viewer.querySelector('p').textContent = 'Impossible de charger cette photo.';
    });
  });

  function closeViewer() {
    const viewer = document.querySelector('#projectLogPhotoViewer');
    viewer.classList.remove('open');
    viewer.setAttribute('aria-hidden', 'true');
  }
  document.body.insertAdjacentHTML('beforeend', '<div class="photo-viewer" id="projectLogPhotoViewer" aria-hidden="true"><div class="photo-viewer-panel"><button type="button" class="photo-viewer-close" data-close-project-log-photo aria-label="Fermer">×</button><img alt="Photo du journal agrandie"><p></p></div></div>');
  document.addEventListener('click', event => {
    if (event.target.closest('[data-close-project-log-photo]') || event.target.id === 'projectLogPhotoViewer') closeViewer();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeViewer(); });
  document.addEventListener('click', event => {
    if (event.target.closest('#closeModal, #cancelModal')) releasePending();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('#modalBackdrop')?.classList.contains('open')) releasePending();
  });

  document.querySelector('#content').addEventListener('click', event => {
    const button = event.target.closest('[data-delete-log]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!canEdit() || !confirm('Supprimer ce journal de travail et ses photos ?')) return;
    const project = data.projects.find(item => item.id === button.dataset.logProjectId);
    const log = (project?.workLogs || []).find(item => item.id === button.dataset.deleteLog);
    if (!project || !log) return;
    project.workLogs = project.workLogs.filter(item => item.id !== log.id);
    save();
    render();
    toast('Journal supprimé');
    removePhotos(photosFor(log));
  }, true);
})();
