(() => {
  const MAX_FILE = 50 * 1024 * 1024;
  const MAX_EXPANDED = 60 * 1024 * 1024;
  const SLIDE = /^ppt\/slides\/slide\d+\.xml$/i;
  const REL = /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/i;
  const MEDIA = /^ppt\/media\/[^/]+\.(png|jpe?g|gif|webp)$/i;
  let library;
  const unzipLibrary = () => library ||= import('https://cdn.jsdelivr.net/npm/fflate@0.8.3/esm/browser.js').catch(error => {
    library = undefined;
    throw error;
  });
  const elements = (xml, name) => [...xml.getElementsByTagNameNS('*', name)];
  const relationshipId = (node, name) => [...node.attributes].find(attr => attr.localName === name && attr.namespaceURI?.endsWith('/relationships'))?.value;
  const relations = xml => new Map(elements(xml, 'Relationship')
    .filter(node => node.getAttribute('TargetMode') !== 'External')
    .map(node => [node.getAttribute('Id'), node.getAttribute('Target')]));
  const resolvePath = (base, target, allowed) => {
    if (!target) return null;
    try {
      const url = new URL(target, 'https://pptx.invalid/' + base);
      const path = decodeURIComponent(url.pathname.slice(1));
      return url.origin === 'https://pptx.invalid' && allowed.test(path) ? path : null;
    } catch { return null; }
  };
  const display = async (host, url) => {
    const [zip, response] = await Promise.all([unzipLibrary(), fetch(url)]);
    if (!response.ok) throw new Error('Impossible de charger la présentation.');
    const buffer = await response.arrayBuffer();
    if (!host.isConnected) return;
    if (buffer.byteLength > MAX_FILE) throw new Error('Présentation trop volumineuse.');
    let expanded = 0, count = 0;
    const entries = zip.unzipSync(new Uint8Array(buffer), {filter: ({name, originalSize}) => {
      if (!(SLIDE.test(name) || REL.test(name) || MEDIA.test(name) || name === 'ppt/presentation.xml' || name === 'ppt/_rels/presentation.xml.rels')) return false;
      expanded += originalSize;
      if (expanded > MAX_EXPANDED || ++count > 1500 || originalSize > 15 * 1024 * 1024) throw new Error('Présentation trop volumineuse pour l’aperçu.');
      return true;
    }});
    const parser = new DOMParser(), decoder = new TextDecoder();
    const read = path => Object.hasOwn(entries, path)
      ? parser.parseFromString(decoder.decode(entries[path]), 'application/xml')
      : parser.parseFromString('<empty/>', 'application/xml');
    const order = relations(read('ppt/_rels/presentation.xml.rels'));
    const slideIds = elements(read('ppt/presentation.xml'), 'sldId');
    const slides = slideIds.map(node => resolvePath('ppt/presentation.xml', order.get(relationshipId(node, 'id')), SLIDE)).filter(path => path && Object.hasOwn(entries, path));
    if (!slides.length) throw new Error('Aucune diapositive PPTX lisible.');

    const make = (tag, text) => {
      const node = document.createElement(tag);
      if (text) node.textContent = text;
      return node;
    };
    const page = make('article');
    const picker = make('select');
    picker.setAttribute('aria-label', 'Diapositive');
    slides.forEach((_, i) => {
      const option = make('option', 'Diapositive ' + (i + 1) + ' / ' + slides.length);
      option.value = String(i);
      picker.appendChild(option);
    });
    const render = i => {
      const path = slides[i], xml = read(path);
      const slideRelations = relations(read(path.replace('/slides/', '/slides/_rels/') + '.rels'));
      const content = [];
      const tree = elements(xml, 'spTree')[0];
      if (tree) for (const shape of tree.children) {
        for (const p of elements(shape, 'p')) {
          const text = elements(p, 't').map(run => run.textContent).join('');
          if (text.trim()) content.push(make('p', text));
        }
        const imagePaths = new Set(elements(shape, 'blip').map(blip => resolvePath(path, slideRelations.get(relationshipId(blip, 'embed')), MEDIA)));
        for (const imagePath of imagePaths) {
          if (!imagePath || !Object.hasOwn(entries, imagePath)) continue;
          const extension = imagePath.split('.').pop().toLowerCase();
          const image = make('img');
          const imageUrl = URL.createObjectURL(new Blob([entries[imagePath]], {type:'image/' + (extension === 'jpg' ? 'jpeg' : extension)}));
          image.onload = image.onerror = () => URL.revokeObjectURL(imageUrl);
          image.src = imageUrl;
          image.alt = 'Image de la diapositive ' + (i + 1);
          content.push(image);
        }
      }
      page.replaceChildren(...(content.length ? content : [make('p', 'Aucun texte ou image compatible sur cette diapositive.')]));
    };
    picker.addEventListener('change', () => render(Number(picker.value)));
    host.replaceChildren(make('p', 'Aperçu simplifié : texte et images, sans mise en page ni animations.'), picker, page);
    render(0);
  };
  window.ToolPresentationPreview = {display};
})();
