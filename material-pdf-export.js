((root, factory) => {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaterialPdfExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, () => {
  const PAGE_W = 842, PAGE_H = 595, MARGIN = 42;
  const clean = value => String(value ?? '')
    .replace(/€/g, 'EUR')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\xFF]/g, ' ');
  const pdfText = value => clean(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const wrap = (value, maxChars) => {
    const words = clean(value).trim().split(/\s+/).filter(Boolean), lines = [];
    let line = '';
    words.forEach(word => {
      if (!line) line = word;
      else if (`${line} ${word}`.length <= maxChars) line += ` ${word}`;
      else { lines.push(line); line = word; }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };
  const fmt = value => Number(value || 0).toLocaleString('fr-FR', {maximumFractionDigits:3});

  function buildMaterialReportPdf(report) {
    const pages = [];
    let commands = [], y = PAGE_H - MARGIN;
    const color = {green:'0.04 0.37 0.25', dark:'0.08 0.19 0.15', muted:'0.35 0.43 0.39', pale:'0.92 0.97 0.94', line:'0.82 0.88 0.84', orange:'0.89 0.55 0.08', white:'1 1 1'};
    const addText = (value, x, top, size = 9, bold = false, fill = color.dark) => {
      commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${fill} rg ${x} ${top} Td (${pdfText(value)}) Tj ET`);
    };
    const rect = (x, top, width, height, fill, stroke = '') => {
      commands.push(`${fill} rg ${stroke || fill} RG ${x} ${top - height} ${width} ${height} re B`);
    };
    const line = (x1, top, x2, stroke = color.line) => commands.push(`${stroke} RG 0.7 w ${x1} ${top} m ${x2} ${top} l S`);
    const footer = () => {
      line(MARGIN, 28, PAGE_W - MARGIN);
      addText('EXPEDIT TOOLMANAGER - Rapport matière', MARGIN, 14, 7, false, color.muted);
      addText(`Page ${pages.length + 1}`, PAGE_W - MARGIN - 38, 14, 7, true, color.muted);
    };
    const newPage = (continuation = false) => {
      if (commands.length) { footer(); pages.push(commands.join('\n')); }
      commands = []; y = PAGE_H - MARGIN;
      rect(0, PAGE_H, PAGE_W, 9, color.green);
      if (continuation) { addText(`${report.id} - ${report.name} (suite)`, MARGIN, y, 12, true, color.green); y -= 24; }
    };
    const ensure = height => { if (y - height < 42) newPage(true); };
    const section = title => { ensure(30); y -= 8; addText(title.toUpperCase(), MARGIN, y, 10, true, color.green); y -= 10; line(MARGIN, y, PAGE_W - MARGIN, color.green); y -= 15; };
    const textLines = (value, x, width, size = 8, bold = false, fill = color.dark) => {
      const maxChars = Math.max(12, Math.floor(width / (size * .52)));
      const lines = wrap(value, maxChars);
      lines.forEach((entry, index) => addText(entry, x, y - index * (size + 3), size, bold, fill));
      return lines.length * (size + 3);
    };

    newPage();
    addText('EXPEDIT TOOLMANAGER', MARGIN, y, 11, true, color.green);
    addText('RAPPORT DE CALCUL MATIERE', MARGIN, y - 22, 22, true, color.dark);
    y -= 53;
    rect(MARGIN, y, PAGE_W - MARGIN * 2, 56, color.pale, color.line);
    addText(`${report.id} - ${report.name}`, MARGIN + 15, y - 21, 15, true, color.green);
    addText(`Date du calcul : ${report.created || '-'}    |    Rapport exporté : ${report.exportedAt}`, MARGIN + 15, y - 40, 8, false, color.muted);
    y -= 73;

    section("Options d'approvisionnement");
    (report.options || []).forEach((option, index) => {
      const warnings = (option.warnings || []).join(' - '), height = warnings ? 104 : 84;
      ensure(height + 8);
      rect(MARGIN, y, PAGE_W - MARGIN * 2, height, option.valid ? '0.97 0.99 0.98' : '1 0.96 0.95', option.valid ? color.line : '0.91 0.65 0.60');
      addText(`OPTION ${index + 1}`, MARGIN + 13, y - 18, 8, true, color.muted);
      addText(option.title, MARGIN + 13, y - 35, 12, true, color.green);
      const metricY = y - 57, metricW = (PAGE_W - MARGIN * 2 - 26) / 4;
      [['Poids à acheter', option.purchaseWeight], ['Reste', option.leftoverWeight], ['Utilisation', option.utilization], ['Prix total', option.totalCost]].forEach((metric, metricIndex) => {
        const x = MARGIN + 13 + metricIndex * metricW;
        addText(metric[0], x, metricY, 7, false, color.muted);
        addText(metric[1], x, metricY - 14, 10, true, color.dark);
      });
      if (warnings) addText(`Attention : ${warnings}`, MARGIN + 13, y - 91, 7, true, '0.65 0.20 0.14');
      y -= height + 10;
    });

    section('Détail des pièces');
    (report.items || []).forEach((item, index) => {
      const cardHeight = 84;
      ensure(cardHeight + 8);
      rect(MARGIN, y, PAGE_W - MARGIN * 2, cardHeight, index % 2 ? '0.97 0.98 0.97' : color.white, color.line);
      addText(`PIECE N° ${index + 1}`, MARGIN + 12, y - 17, 7, true, color.muted);
      wrap(`${item.id} - ${item.name}`, 31).slice(0,2).forEach((entry,lineIndex) => addText(entry, MARGIN + 12, y - 35 - lineIndex * 13, 10, true, color.green));
      addText(`Quantité : ${item.quantity}`, MARGIN + 215, y - 20, 8, false, color.muted);
      wrap(`Moule : ${item.mould}`, 38).slice(0,2).forEach((entry,lineIndex) => addText(entry, MARGIN + 215, y - 39 - lineIndex * 11, 8, true));
      addText(`Matière : ${item.material}`, MARGIN + 410, y - 20, 8, false, color.muted);
      addText(`Largeur x épaisseur : ${item.width} x ${item.thickness}`, MARGIN + 410, y - 39, 8, true);
      addText('Poids nécessaire', MARGIN + 590, y - 20, 8, false, color.muted);
      addText(item.requiredWeight, MARGIN + 590, y - 39, 11, true, color.dark);
      y -= cardHeight + 8;
    });

    if (commands.length) { footer(); pages.push(commands.join('\n')); }
    return buildPdf(pages);
  }

  function buildToolParametersPdf(rows) {
    return buildParametersPdf(rows, 'Paramètres des moules', 'moule', [
      ['N° de moule', 86, 'toolNumber'], ['Nom du moule', 208, 'toolName'],
      ['Catégorie', 122, 'category'], ['Projet lié', 90, 'projectNumber'],
      ['Largeur (mm)', 80, 'stripWidth'], ['Pas (mm)', 74, 'pitch'],
      ['Épaisseur max. (mm)', 98, 'thickness']
    ]);
  }

  function buildPartParametersPdf(rows) {
    return buildParametersPdf(rows, 'Paramètres des pièces', 'pièce', [
      ['ID', 56, 'id'], ['Code article', 78, 'articleCode'],
      ['Famille', 96, 'family'], ['Nom de la pièce', 135, 'name'],
      ['Matière', 66, 'material'], ['Ép. (mm)', 54, 'thickness'],
      ['Poids (g)', 54, 'weight'], ['Moules associés', 78, 'moulds'],
      ['Commentaire', 83, 'comment'], ['Informations', 58, 'validation']
    ]);
  }

  function buildParametersPdf(rows, title, noun, columns) {
    const pages = [];
    let commands = [], y;
    const text = (value, x, top, size, bold = false, fill = '0.08 0.19 0.15') =>
      commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${fill} rg ${x} ${top} Td (${pdfText(value)}) Tj ET`);
    const background = (top, height, fill) =>
      commands.push(`${fill} rg ${MARGIN} ${top - height} ${PAGE_W - 2 * MARGIN} ${height} re f`);
    const finish = () => {
      text(`Page ${pages.length + 1}`, PAGE_W - MARGIN - 50, 22, 9);
      pages.push(commands.join('\n'));
    };
    const start = () => {
      commands = [];
      text('EXPEDIT TOOLMANAGER', MARGIN, 552, 11, true);
      text(title, MARGIN, 522, 23, true);
      text(`${rows.length} ${noun}(s) sélectionné(s)`, MARGIN, 500, 10);
      background(481, 25, '0.07 0.34 0.25');
      let x = MARGIN;
      for (const [label, width] of columns) {
        text(label, x + 6, 465, 8, true, '1 1 1');
        x += width;
      }
      y = 456;
    };
    const measure = value => [...value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')].reduce((sum, c) =>
      sum + (/[MW@%]/.test(c) ? 9.4 : /[mw]/.test(c) ? 8 : /[A-Z]/.test(c) ? 7 : /[ il.,:!']/i.test(c) && c !== 'I' ? 3 : 6), 0);
    const cellLines = (value, width) => {
      const max = width - 12;
      const display = typeof value === 'number' ? value.toLocaleString('fr-FR', {useGrouping:false, maximumFractionDigits:8}) : value || '-';
      const lines = [];
      let line = '';
      for (let word of clean(display).trim().split(/\s+/)) {
        if (line && measure(`${line} ${word}`) > max) {
          lines.push(line);
          line = '';
        }
        while (measure(word) > max) {
          let end = 1;
          while (measure(word.slice(0, end + 1)) <= max) end++;
          lines.push(word.slice(0, end));
          word = word.slice(end);
        }
        if (word) line = line ? `${line} ${word}` : word;
      }
      if (line) lines.push(line);
      return lines.length ? lines : [''];
    };
    start();
    rows.forEach((row, index) => {
      const cells = columns.map(([, width, key]) => cellLines(row[key], width));
      const lineCount = Math.max(...cells.map(cell => cell.length));
      for (let offset = 0; offset < lineCount;) {
        const remaining = lineCount - offset;
        const pageCapacity = Math.floor((456 - 42 - 12) / 12);
        if ((remaining <= pageCapacity && y - (remaining * 12 + 12) < 42) || y < 66) {
          finish();
          start();
        }
        const count = Math.min(remaining, Math.floor((y - 42 - 12) / 12));
        const height = count * 12 + 12;
        background(y, height, index % 2 ? '0.93 0.97 0.95' : '0.98 0.99 0.98');
        let x = MARGIN;
        cells.forEach((lines, column) => {
          lines.slice(offset, offset + count).forEach((line, i) => text(line, x + 6, y - 15 - i * 12, 9, column === 0));
          x += columns[column][1];
        });
        y -= height;
        offset += count;
      }
    });
    finish();
    return buildPdf(pages);
  }

  function buildPdf(pages) {
    const objects = [''], pageIds = [], contentIds = [], fontRegular = 3 + pages.length * 2, fontBold = fontRegular + 1;
    pages.forEach((page, index) => {
      const pageId = 3 + index * 2, contentId = pageId + 1;
      pageIds.push(pageId); contentIds.push(contentId);
      objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId] = `<< /Length ${page.length} >>\nstream\n${page}\nendstream`;
    });
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
    objects[fontRegular] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[fontBold] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    let pdf = '%PDF-1.4\n', offsets = [0];
    for (let index = 1; index < objects.length; index += 1) { offsets[index] = pdf.length; pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`; }
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let index = 1; index < objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Uint8Array.from(pdf, character => character.charCodeAt(0) & 255);
  }

  function download(bytes, filename) {
    const url = URL.createObjectURL(new Blob([bytes], {type:'application/pdf'})), anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return {buildMaterialReportPdf, buildToolParametersPdf, buildPartParametersPdf, download, fmt};
});
