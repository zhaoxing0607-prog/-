(() => {
  const MAX_PHOTOS = 2;
  const MAX_SIZE = 3 * 1024 * 1024;
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const photoHtml = photo => `<figure class="repair-photo" data-photo-path="${photo.path}"><button type="button" class="open-repair-photo" data-open-repair-photo aria-label="Agrandir la photo ${photo.name || ''}"><img alt="${photo.name || 'Photo de la panne'}" data-panne-photo="${photo.path}"></button><figcaption>${photo.name || 'Photo'}</figcaption>${canEdit() ? `<button type="button" class="delete-repair-photo" data-delete-repair-photo="${photo.path}">Supprimer la photo</button>` : ''}</figure>`;

  async function hydratePhotos(root = document) {
    const images = [...root.querySelectorAll('[data-panne-photo]')];
    await Promise.all(images.map(async image => {
      try {
        const url = await window.MoldCloud?.pannePhotoUrl(image.dataset.pannePhoto);
        if (url) image.src = url;
      } catch {
        image.closest('.repair-photo')?.classList.add('repair-photo-unavailable');
      }
    }));
  }

  const baseRepairDashboard = repairDashboard;
  repairDashboard = () => {
    const repair = data.repairs.find(item => item.id === selectedRepairId);
    let html = baseRepairDashboard();
    if (!repair) return html;
    const photos = Array.isArray(repair.photos) ? repair.photos : [];
    const addButton = canEdit() && photos.length < MAX_PHOTOS ? `<button type="button" class="primary add-repair-photo" data-add-repair-photo="${repair.id}">＋ Ajouter des photos</button>` : '';
    const section = `<section class="card repair-photos-card"><div class="card-head"><div><span class="section-kicker">CONSTAT VISUEL</span><h3>Photos de la panne</h3></div><div class="repair-photo-head-actions"><span class="photo-counter">${photos.length} / ${MAX_PHOTOS}</span>${addButton}</div></div>${photos.length ? `<div class="repair-photos-grid">${photos.map(photoHtml).join('')}</div>` : '<div class="empty">Aucune photo ajoutée pour cette panne.</div>'}</section>`;
    return html + section;
  };

  const baseRender = render;
  render = () => {
    baseRender();
    hydratePhotos();
  };

  document.body.insertAdjacentHTML('beforeend', '<div class="photo-viewer" id="repairPhotoViewer" aria-hidden="true"><div class="photo-viewer-panel"><button type="button" class="photo-viewer-close" data-close-photo-viewer aria-label="Fermer">×</button><img id="repairPhotoViewerImage" alt="Photo de la panne agrandie"><p id="repairPhotoViewerName"></p></div></div>');

  function closeViewer() {
    const viewer = document.querySelector('#repairPhotoViewer');
    viewer.classList.remove('open');
    viewer.setAttribute('aria-hidden', 'true');
  }

  async function openViewer(photo, sourceImage = null) {
    const viewer = document.querySelector('#repairPhotoViewer');
    const image = document.querySelector('#repairPhotoViewerImage');
    image.removeAttribute('src');
    image.alt = photo.name || 'Photo de la panne';
    document.querySelector('#repairPhotoViewerName').textContent = photo.name || 'Chargement de la photo…';
    viewer.classList.add('open');
    viewer.setAttribute('aria-hidden', 'false');
    try {
      image.src = sourceImage?.src || await window.MoldCloud?.pannePhotoUrl(photo.path);
      document.querySelector('#repairPhotoViewerName').textContent = photo.name || 'Photo de la panne';
    } catch {
      document.querySelector('#repairPhotoViewerName').textContent = 'Impossible de charger cette photo.';
    }
  }

  function editorHtml(photos) {
    const existing = photos.map(photo => `<figure class="repair-photo repair-photo-edit" data-photo-path="${photo.path}"><img alt="${photo.name || 'Photo de la panne'}" data-panne-photo="${photo.path}"><figcaption>${photo.name || 'Photo'}</figcaption><button type="button" class="remove-repair-photo" data-remove-photo="${photo.path}">Retirer</button></figure>`).join('');
    return `<div class="field full repair-photo-field"><label>Photos de la panne <span class="optional-label">(maximum 2)</span></label><div class="repair-photo-editor" id="repairPhotoEditor">${existing || '<div class="photo-empty">Aucune photo. Ajoutez jusqu’à 2 photos.</div>'}</div><input type="file" name="repairPhotos" id="repairPhotosInput" accept="image/jpeg,image/png,image/webp" multiple><small>JPG, PNG ou WebP · compression automatique avant envoi · 2 photos maximum.</small><div class="ticket-form-error" id="repairPhotoError" role="alert"></div></div>`;
  }

  const baseOpenModal = openModal;
  openModal = (type, record = null) => {
    baseOpenModal(type, record);
    if (type !== 'repairs') return;
    const form = document.querySelector('#entityForm');
    const photos = Array.isArray(record?.photos) ? record.photos : [];
    form._removedRepairPhotos = new Set();
    form._selectedRepairFiles = [];
    document.querySelector('#formFields').insertAdjacentHTML('beforeend', editorHtml(photos));
    hydratePhotos(form);
    const input = document.querySelector('#repairPhotosInput');
    input.addEventListener('change', () => {
      const incoming = [...input.files];
      const retained = photos.filter(photo => !form._removedRepairPhotos.has(photo.path)).length;
      const remaining = MAX_PHOTOS - retained - form._selectedRepairFiles.length;
      const error = document.querySelector('#repairPhotoError');
      error.classList.remove('visible');
      if (incoming.length > remaining) {
        error.textContent = `Vous pouvez conserver au maximum ${MAX_PHOTOS} photos pour cette panne.`;
        error.classList.add('visible');
        input.value = '';
        return;
      }
      if (incoming.some(file => !acceptedTypes.includes(file.type))) {
        error.textContent = 'Utilisez une image JPG, PNG ou WebP.';
        error.classList.add('visible');
        input.value = '';
        return;
      }
      form._selectedRepairFiles.push(...incoming);
      input.value = '';
      const editor = document.querySelector('#repairPhotoEditor');
      editor.querySelector('.photo-empty')?.remove();
      incoming.forEach(file => {
        const url = URL.createObjectURL(file);
        const figure = document.createElement('figure');
        figure.className = 'repair-photo repair-photo-edit repair-photo-pending';
        figure.innerHTML = `<img src="${url}" alt="${file.name}"><figcaption>${file.name}</figcaption><button type="button" class="remove-repair-photo" data-remove-new-photo="${file.name}">Retirer</button>`;
        editor.appendChild(figure);
      });
    });
  };

  document.addEventListener('click', event => {
    const addPhoto = event.target.closest('[data-add-repair-photo]');
    if (addPhoto) {
      const repair = data.repairs.find(item => item.id === addPhoto.dataset.addRepairPhoto);
      if (!repair || !canEdit()) return;
      openModal('repairs', repair);
      setTimeout(() => {
        const field = document.querySelector('#repairPhotosInput');
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        field?.focus();
      }, 30);
      return;
    }
    const open = event.target.closest('[data-open-repair-photo]');
    if (open) {
      const photo = open.closest('.repair-photo');
      const image = photo.querySelector('img');
      openViewer({ path: photo.dataset.photoPath, name: photo.querySelector('figcaption')?.textContent || '' }, image);
      return;
    }
    const openFromList = event.target.closest('[data-open-repair-photos]');
    if (openFromList) {
      const repair = data.repairs.find(item => item.id === openFromList.dataset.openRepairPhotos);
      const photo = repair?.photos?.[0];
      if (photo) openViewer(photo);
      return;
    }
    if (event.target.closest('[data-close-photo-viewer]') || event.target.id === 'repairPhotoViewer') {
      closeViewer();
      return;
    }
    const deletePhoto = event.target.closest('[data-delete-repair-photo]');
    if (deletePhoto) {
      const path = deletePhoto.dataset.deleteRepairPhoto;
      const repair = data.repairs.find(item => item.id === selectedRepairId);
      if (!canEdit() || !repair || !path || !confirm('Supprimer définitivement cette photo de la panne ?')) return;
      deletePhoto.disabled = true;
      window.MoldCloud.removePannePhoto(path).then(() => {
        repair.photos = (repair.photos || []).filter(photo => photo.path !== path);
        save();
        render();
        toast('Photo supprimée');
      }).catch(error => {
        deletePhoto.disabled = false;
        toast(error.message || 'Impossible de supprimer la photo');
      });
      return;
    }
    const remove = event.target.closest('[data-remove-photo]');
    if (remove) {
      const form = document.querySelector('#entityForm');
      form?._removedRepairPhotos?.add(remove.dataset.removePhoto);
      remove.closest('.repair-photo')?.remove();
      return;
    }
    const removeNew = event.target.closest('[data-remove-new-photo]');
    if (removeNew) {
      const form = document.querySelector('#entityForm');
      if (form?._selectedRepairFiles) {
        const position = form._selectedRepairFiles.findIndex(file => file.name === removeNew.dataset.removeNewPhoto);
        if (position >= 0) form._selectedRepairFiles.splice(position, 1);
      }
      removeNew.closest('.repair-photo')?.remove();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeViewer();
  });

  async function compressImage(file) {
    const bitmap = await createImageBitmap(file);
    const render = async (maximum, quality) => {
      const scale = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) throw new Error('La compression de la photo a échoué');
      return blob;
    };
    let blob = await render(1600, .82);
    if (blob.size > MAX_SIZE) blob = await render(1280, .7);
    bitmap.close?.();
    if (blob.size > MAX_SIZE) throw new Error('Une photo reste trop volumineuse après compression');
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' });
  }

  document.querySelector('#entityForm').addEventListener('submit', async event => {
    const form = event.currentTarget;
    if (form.dataset.type !== 'repairs') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!canEdit()) return;
    const submit = form.querySelector('[type="submit"]');
    const originalText = submit.textContent;
    const error = document.querySelector('#repairPhotoError');
    const editId = form.dataset.editId;
    const existing = editId ? data.repairs.find(item => item.id === editId) : null;
    const retained = (existing?.photos || []).filter(photo => !form._removedRepairPhotos?.has(photo.path));
    const files = form._selectedRepairFiles || [];
    if (retained.length + files.length > MAX_PHOTOS) {
      error.textContent = `Cette panne peut contenir au maximum ${MAX_PHOTOS} photos.`;
      error.classList.add('visible');
      return;
    }
    submit.disabled = true;
    submit.textContent = files.length ? 'Compression et envoi…' : 'Enregistrement…';
    try {
      const values = new FormData(form);
      const obj = Object.fromEntries(values);
      const count = Math.max(1, Number(obj.componentCount) || 1);
      obj.components = Array.from({ length: count }, (_, index) => ({ name: values.get(`compName${index}`) || '', qty: Number(values.get(`compQty${index}`) || 1), material: values.get(`compMaterial${index}`) || 'Fer', heatTreated: values.has(`compHeat${index}`) }));
      Object.keys(obj).filter(key => /^comp(Name|Qty|Material|Heat)/.test(key)).forEach(key => delete obj[key]);
      ['componentCount', 'cost'].forEach(key => { if (key in obj) obj[key] = Number(obj[key] || 0); });
      const repairId = editId || obj.id;
      const compressed = [];
      for (const file of files) compressed.push(await compressImage(file));
      const uploaded = [];
      for (const file of compressed) uploaded.push(await window.MoldCloud.uploadPannePhoto(repairId, file));
      obj.photos = [...retained, ...uploaded];
      if (editId) {
        const index = data.repairs.findIndex(item => item.id === editId);
        if (index !== -1) data.repairs[index] = { ...data.repairs[index], ...obj };
      } else data.repairs.unshift(obj);
      const repair = data.repairs.find(item => item.id === repairId);
      ensureRepairPurchases(repair);
      if (repair.status === 'Terminé') {
        const mould = data.moulds.find(item => item.id === repair.mould);
        if (mould) mould.status = 'Dispo';
      }
      save();
      await Promise.all([...form._removedRepairPhotos].map(path => window.MoldCloud.removePannePhoto(path).catch(() => null)));
      closeModal();
      view = 'repairs';
      filter = 'Tous';
      render();
      toast(files.length ? 'Panne enregistrée · photos compressées' : 'Panne enregistrée');
    } catch (saveError) {
      error.textContent = saveError.message || 'Impossible d’enregistrer les photos';
      error.classList.add('visible');
    } finally {
      submit.disabled = false;
      submit.textContent = originalText;
    }
  }, true);
})();
