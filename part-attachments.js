(() => {
  const MAX_FILES = 5;
  const MAX_SIZE = 10 * 1024 * 1024;
  const acceptedExtensions = /\.(jpe?g|png|webp|pdf|docx?|xlsx?|txt|csv|zip)$/i;
  const modelExtensions = /\.(stl|obj|glb|gltf)$/i;
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
    if (/\.zip$/i.test(name)) return 'ZIP';
    if (/\.(stl|obj|glb|gltf)$/i.test(name)) return '3D';
    return 'FILE';
  };

  const basePartDashboard = partDashboard;
  partDashboard = () => {
    const part = data.parts.find(item => item.id === selectedPartId);
    const html = basePartDashboard();
    if (!part) return html;
    const storedDocuments = Array.isArray(part.documents) ? part.documents : [];
    const legacyModel = storedDocuments.find(file => fileIcon(file) === '3D');
    const model = part.model3d?.path ? part.model3d : legacyModel;
    const documents = storedDocuments.filter(file => fileIcon(file) !== '3D');
    const list = documents.length
      ? `<div class="achat-attachment-card-list">${documents.map(file => `<div class="achat-attachment-file"><span class="achat-file-icon ${fileIcon(file)==='3D'?'is-3d':''}">${fileIcon(file)}</span><div><b>${escapeHtml(file.name || 'Document')}</b><small>${formatSize(file.size)}</small></div><button type="button" data-open-part-document="${escapeHtml(file.path)}">${['IMG','PDF','3D'].includes(fileIcon(file)) ? 'Lire dans la fenêtre' : 'Ouvrir / télécharger'}</button>${canEdit() ? `<button type="button" class="danger" data-delete-part-document="${escapeHtml(file.path)}">Supprimer</button>` : ''}</div>`).join('')}</div>`
      : '<div class="empty">Aucun document associé à cette pièce.</div>';
    const modelContent = model
      ? `<div class="part-model-card"><div class="part-model-card-icon">3D</div><div><b>${escapeHtml(model.name || 'Modèle 3D')}</b><small>${formatSize(model.size)} · ${escapeHtml(String(model.name || '').split('.').pop().toUpperCase())}</small></div><button type="button" data-open-part-document="${escapeHtml(model.path)}">Visualiser le modèle</button>${canEdit() ? `<button type="button" class="danger" data-delete-part-model="${escapeHtml(model.path)}">Supprimer</button>` : ''}</div>`
      : '<div class="empty">Aucun modèle 3D associé à cette pièce.</div>';
    return `${html}<section class="card achat-attachments-card part-documents-card"><div class="card-head"><div><span class="section-kicker">DOCUMENTS ASSOCIÉS</span><h3>Documents de la pièce</h3><span class="sub">Photos, plans, fiches techniques, PDF, Word, Excel ou ZIP</span></div>${canEdit() ? `<button type="button" class="primary" data-add-part-documents="${escapeHtml(part.id)}">＋ Ajouter des documents</button>` : ''}</div>${list}</section><section class="card part-model-card-section"><div class="card-head"><div><span class="section-kicker">MODÈLE 3D</span><h3>Modèle 3D de la pièce</h3><span class="sub">STL, OBJ, GLB ou GLTF · rotation et zoom en ligne</span></div>${canEdit() ? `<button type="button" class="primary" data-add-part-model="${escapeHtml(part.id)}">${model ? '↻ Remplacer le modèle 3D' : '＋ Ajouter un modèle 3D'}</button>` : ''}</div>${modelContent}</section>`;
  };

  document.body.insertAdjacentHTML('beforeend', `<input type="file" id="partDocumentInput" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" hidden><input type="file" id="partModelInput" accept=".stl,.obj,.glb,.gltf" hidden><div class="part-document-viewer" id="partDocumentViewer" aria-hidden="true"><section class="part-document-viewer-panel" role="dialog" aria-modal="true" aria-labelledby="partDocumentViewerTitle"><header><div><span class="section-kicker" id="partDocumentViewerEyebrow">LECTURE DU DOCUMENT</span><h3 id="partDocumentViewerTitle">Document associé</h3></div><div><span class="part-3d-help" id="part3dHelp">Glisser pour tourner · molette pour zoomer</span><a id="partDocumentViewerExternal" target="_blank" rel="noopener">Ouvrir dans un nouvel onglet</a><button type="button" data-close-part-document-viewer aria-label="Fermer">×</button></div></header><div class="part-document-viewer-content" id="partDocumentViewerContent"></div></section></div>`);
  const input = document.querySelector('#partDocumentInput');
  const modelInput = document.querySelector('#partModelInput');
  const viewer = document.querySelector('#partDocumentViewer');
  const viewerTitle = document.querySelector('#partDocumentViewerTitle');
  const viewerEyebrow = document.querySelector('#partDocumentViewerEyebrow');
  const viewerContent = document.querySelector('#partDocumentViewerContent');
  const viewerExternal = document.querySelector('#partDocumentViewerExternal');
  const viewer3dHelp = document.querySelector('#part3dHelp');
  let targetPartId = '';
  let destroyModelViewer = () => {};

  const closeViewer = () => {
    viewer.classList.remove('open');
    viewer.setAttribute('aria-hidden', 'true');
    destroyModelViewer();
    destroyModelViewer = () => {};
    viewerContent.replaceChildren();
    viewerExternal.removeAttribute('href');
  };
  const showModelViewer = async (url, file) => {
    const host = document.createElement('div');
    host.className = 'part-model-viewer';
    host.innerHTML = '<div class="part-model-loading">Chargement du modèle 3D…</div>';
    viewerContent.appendChild(host);
    try {
      const [THREE, {OrbitControls}, {STLLoader}, {OBJLoader}, {GLTFLoader}] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
        import('three/addons/loaders/STLLoader.js'),
        import('three/addons/loaders/OBJLoader.js'),
        import('three/addons/loaders/GLTFLoader.js')
      ]);
      if (!viewer.classList.contains('open')) return;
      host.replaceChildren();
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xe9eeeb);
      const camera = new THREE.PerspectiveCamera(42, 1, .01, 100000);
      const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      host.appendChild(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x50635a, 2.4));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
      keyLight.position.set(4, 7, 6);
      scene.add(keyLight);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      let frame = 0, observer = null, disposed = false;
      const disposeObject = object => object?.traverse?.(node => {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach(material => material.dispose?.());
        else node.material?.dispose?.();
      });
      destroyModelViewer = () => {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(frame);
        observer?.disconnect();
        controls.dispose();
        disposeObject(scene);
        renderer.dispose();
      };
      const extension = String(file.name || '').split('.').pop().toLowerCase();
      let model;
      if (extension === 'stl') {
        const geometry = await new STLLoader().loadAsync(url);
        geometry.computeVertexNormals();
        model = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color:0x2d936c, metalness:.15, roughness:.58}));
      } else if (extension === 'obj') {
        model = await new OBJLoader().loadAsync(url);
        model.traverse(node => { if (node.isMesh) node.material = new THREE.MeshStandardMaterial({color:0x2d936c, metalness:.12, roughness:.62}); });
      } else {
        const gltf = await new GLTFLoader().loadAsync(url);
        model = gltf.scene;
      }
      if (disposed || !viewer.classList.contains('open')) {
        disposeObject(model);
        return;
      }
      scene.add(model);
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(center);
      const radius = Math.max(size.x, size.y, size.z, .01);
      camera.position.set(radius * 1.45, radius * .95, radius * 1.45);
      camera.near = Math.max(radius / 1000, .001);
      camera.far = Math.max(radius * 100, 100);
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.update();
      const grid = new THREE.GridHelper(radius * 3, 12, 0x91a79b, 0xcbd6d0);
      grid.position.y = -size.y / 2;
      scene.add(grid);
      const resize = () => {
        const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
      animate();
    } catch (error) {
      if (!viewer.classList.contains('open')) return;
      destroyModelViewer();
      host.innerHTML = `<div class="part-model-error"><b>Impossible d’afficher ce modèle 3D.</b><span>${escapeHtml(error.message || 'Format ou contenu non compatible')}</span><small>Pour GLTF avec des fichiers externes, utilisez de préférence un fichier GLB unique.</small></div>`;
    }
  };
  const showViewer = async (url, file) => {
    viewerTitle.textContent = file.name || 'Document associé';
    viewerExternal.href = url;
    const icon = fileIcon(file);
    viewerEyebrow.textContent = icon === '3D' ? 'VISUALISATION DU MODÈLE 3D' : 'LECTURE DU DOCUMENT';
    viewer3dHelp.hidden = icon !== '3D';
    viewer.classList.add('open');
    viewer.setAttribute('aria-hidden', 'false');
    if (icon === 'IMG') {
      const image = document.createElement('img');
      image.src = url;
      image.alt = file.name || 'Image associée à la pièce';
      viewerContent.appendChild(image);
    } else if (icon === 'PDF') {
      const frame = document.createElement('iframe');
      frame.src = url;
      frame.title = file.name || 'Document PDF associé';
      viewerContent.appendChild(frame);
    } else {
      await showModelViewer(url, file);
    }
    viewer.querySelector('[data-close-part-document-viewer]').focus();
  };

  document.addEventListener('click', async event => {
    const add = event.target.closest('[data-add-part-documents]');
    if (add) {
      if (!canEdit()) return;
      targetPartId = add.dataset.addPartDocuments;
      input.value = '';
      input.click();
      return;
    }

    const addModel = event.target.closest('[data-add-part-model]');
    if (addModel) {
      if (!canEdit()) return;
      targetPartId = addModel.dataset.addPartModel;
      modelInput.value = '';
      modelInput.click();
      return;
    }

    const open = event.target.closest('[data-open-part-document]');
    if (open) {
      const part = data.parts.find(item => item.id === selectedPartId);
      const file = [part?.model3d, ...(part?.documents || [])].filter(Boolean).find(item => item.path === open.dataset.openPartDocument) || {path:open.dataset.openPartDocument, name:'Document'};
      const previewable = ['IMG', 'PDF', '3D'].includes(fileIcon(file));
      const popup = previewable ? null : window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
      open.disabled = true;
      try {
        const url = await window.MoldCloud.achatAttachmentUrl(open.dataset.openPartDocument);
        if (!url) throw new Error('Document introuvable');
        if (previewable) await showViewer(url, file);
        else if (popup) popup.location.replace(url);
        else window.location.href = url;
      } catch (error) {
        popup?.close();
        toast(error.message || 'Impossible d’ouvrir le document');
      } finally {
        open.disabled = false;
      }
      return;
    }

    const removeModel = event.target.closest('[data-delete-part-model]');
    if (removeModel && canEdit()) {
      const part = data.parts.find(item => item.id === selectedPartId);
      const path = removeModel.dataset.deletePartModel;
      if (!part || !confirm('Supprimer définitivement le modèle 3D associé ?')) return;
      removeModel.disabled = true;
      try {
        await window.MoldCloud.removeAchatAttachment(path);
        if (part.model3d?.path === path) delete part.model3d;
        part.documents = (part.documents || []).filter(file => file.path !== path);
        save();
        render();
        toast('Modèle 3D supprimé');
      } catch (error) {
        removeModel.disabled = false;
        toast(error.message || 'Impossible de supprimer le modèle 3D');
      }
      return;
    }

    if (event.target.closest('[data-close-part-document-viewer]') || event.target === viewer) {
      closeViewer();
      return;
    }

    const remove = event.target.closest('[data-delete-part-document]');
    if (!remove || !canEdit()) return;
    const part = data.parts.find(item => item.id === selectedPartId);
    const path = remove.dataset.deletePartDocument;
    if (!part || !confirm('Supprimer définitivement ce document associé ?')) return;
    remove.disabled = true;
    try {
      await window.MoldCloud.removeAchatAttachment(path);
      part.documents = (part.documents || []).filter(file => file.path !== path);
      save();
      render();
      toast('Document supprimé');
    } catch (error) {
      remove.disabled = false;
      toast(error.message || 'Impossible de supprimer le document');
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && viewer.classList.contains('open')) closeViewer();
  });

  input.addEventListener('change', async () => {
    const files = [...(input.files || [])];
    const part = data.parts.find(item => item.id === (targetPartId || selectedPartId));
    if (!files.length || !part || !canEdit()) return;
    const existing = Array.isArray(part.documents) ? part.documents : [];
    if (existing.length + files.length > MAX_FILES) {
      toast(`Maximum ${MAX_FILES} documents associés par pièce`);
      return;
    }
    if (files.some(file => file.size > MAX_SIZE)) {
      toast('Chaque document doit faire au maximum 10 Mo');
      return;
    }
    if (files.some(file => !acceptedExtensions.test(file.name))) {
      toast('Format non accepté : utilisez une image, PDF, Word, Excel, TXT, CSV ou ZIP');
      return;
    }

    const button = document.querySelector(`[data-add-part-documents="${CSS.escape(part.id)}"]`);
    const originalLabel = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'Envoi des documents…';
    }
    const uploaded = [];
    try {
      for (const file of files) uploaded.push(await window.MoldCloud.uploadAchatAttachment(`part-${part.id}`, file));
      part.documents = [...existing, ...uploaded];
      save();
      render();
      toast(`${uploaded.length} document${uploaded.length > 1 ? 's' : ''} ajouté${uploaded.length > 1 ? 's' : ''}`);
    } catch (error) {
      await Promise.all(uploaded.map(file => window.MoldCloud.removeAchatAttachment(file.path).catch(() => null)));
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
      toast(error.message || 'Impossible d’envoyer les documents');
    }
  });

  modelInput.addEventListener('change', async () => {
    const file = modelInput.files?.[0];
    const part = data.parts.find(item => item.id === (targetPartId || selectedPartId));
    if (!file || !part || !canEdit()) return;
    if (!modelExtensions.test(file.name)) {
      toast('Format 3D non accepté : utilisez STL, OBJ, GLB ou GLTF');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast('Le modèle 3D doit faire au maximum 10 Mo');
      return;
    }
    const legacyModel = (part.documents || []).find(item => fileIcon(item) === '3D');
    const previous = part.model3d?.path ? part.model3d : legacyModel;
    const button = document.querySelector(`[data-add-part-model="${CSS.escape(part.id)}"]`);
    const originalLabel = button?.textContent;
    if (button) {
      button.disabled = true;
      button.textContent = 'Envoi du modèle 3D…';
    }
    try {
      const uploaded = await window.MoldCloud.uploadAchatAttachment(`part-${part.id}-model`, file);
      part.model3d = uploaded;
      part.documents = (part.documents || []).filter(item => item.path !== previous?.path && fileIcon(item) !== '3D');
      save();
      render();
      toast('Modèle 3D ajouté');
      if (previous?.path && previous.path !== uploaded.path) window.MoldCloud.removeAchatAttachment(previous.path).catch(() => null);
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
      toast(error.message || 'Impossible d’envoyer le modèle 3D');
    }
  });
})();
