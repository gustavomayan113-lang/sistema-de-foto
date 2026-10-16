(() => {
  'use strict';

  const PHOTOS_PER_PAGE = 4;

  /** @type {{id:string, file:File, url:string, caption:string}[]} */
  let photos = [];
  let dragId = null;
  /** @type {string[]} */
  let subtitles = [];

  const el = {
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('fileInput'),
    browseBtn: document.getElementById('browseBtn'),
    pages: document.getElementById('pages'),
    emptyState: document.getElementById('emptyState'),
    photoCount: document.getElementById('photoCount'),
    pageCount: document.getElementById('pageCount'),
    downloadPdfBtn: document.getElementById('downloadPdfBtn'),
  };

  function genId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function sanitize(text, fallback) {
    const base = (text || '').trim() || fallback;
    return base
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 40) || fallback;
  }

  function extOf(file) {
    const fromName = file.name && file.name.includes('.') ? file.name.split('.').pop() : null;
    if (fromName) return fromName.toLowerCase();
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/webp') return 'webp';
    return 'jpg';
  }

  // ===== File intake =====

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length !== fileList.length && fileList.length > 0) {
      const invalid = fileList.length - files.length;
      showToast(invalid === 1 ? 'Arquivo inválido ignorado' : `${invalid} arquivos inválidos ignorados`, true);
    }
    files.forEach((file, idx) => {
      photos.push({
        id: genId(),
        file,
        url: URL.createObjectURL(file),
        caption: '',
      });
    });
    render();
  }

  el.browseBtn.addEventListener('click', () => el.fileInput.click());
  el.fileInput.addEventListener('change', e => {
    handleFiles(e.target.files);
    e.target.value = '';
  });
  el.dropzone.addEventListener('click', e => {
    if (e.target === el.browseBtn) return;
    el.fileInput.click();
  });
  ['dragenter', 'dragover'].forEach(evt =>
    el.dropzone.addEventListener(evt, e => {
      e.preventDefault();
      el.dropzone.classList.add('drag-over');
    })
  );
  ['dragleave', 'drop'].forEach(evt =>
    el.dropzone.addEventListener(evt, e => {
      e.preventDefault();
      el.dropzone.classList.remove('drag-over');
    })
  );
  el.dropzone.addEventListener('drop', e => {
    if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  // ===== Rendering =====

  function render() {
    const pagesOfPhotos = chunk(photos, PHOTOS_PER_PAGE);

    while (subtitles.length < pagesOfPhotos.length) subtitles.push('');

    const wasEmpty = photos.length === 0;
    el.photoCount.textContent = photos.length;
    el.pageCount.textContent = pagesOfPhotos.length;
    el.downloadPdfBtn.disabled = photos.length === 0;
    el.emptyState.style.display = photos.length === 0 ? 'flex' : 'none';
    el.pages.style.display = photos.length === 0 ? 'none' : 'flex';

    el.photoCount.parentElement.classList.add('animating');
    el.pageCount.parentElement.classList.add('animating');
    setTimeout(() => {
      el.photoCount.parentElement.classList.remove('animating');
    }, 300);

    el.pages.innerHTML = pagesOfPhotos.map((group, pageIndex) => {
      const slots = group.map(photo => `
        <div class="slot filled" draggable="true" data-id="${photo.id}">
          <button type="button" class="remove-btn" data-action="remove" data-id="${photo.id}" title="Remover foto" aria-label="Remover foto">×</button>
          <img src="${photo.url}" alt="Foto adicionada">
          <input type="text" class="caption-input" data-action="caption" data-id="${photo.id}"
                 placeholder="Escrever legenda..." value="${escapeAttr(photo.caption)}" aria-label="Legenda da foto">
        </div>
      `).join('');

      const emptySlots = PHOTOS_PER_PAGE - group.length;
      const emptyHtml = Array.from({ length: emptySlots })
        .map(() => `<div class="slot empty"><span>vazio</span></div>`)
        .join('');

      const dots = Array.from({ length: 12 }).map(() => '<span></span>').join('');
      const num = String(pageIndex + 1).padStart(2, '0');

      return `
        <section class="page" data-page="${pageIndex}">
          <div class="film-strip top">${dots}</div>
          <div class="page-head">
            <span class="frame-counter">Página ${num}</span>
            <input type="text" class="subtitle-input" data-action="subtitle" data-page="${pageIndex}"
                   placeholder="Subtítulo da página (ex: troca de cabos da seinfra)" value="${escapeAttr(subtitles[pageIndex] || '')}" aria-label="Subtítulo da página">
            <button type="button" class="btn btn-small" data-action="download-page" data-page="${pageIndex}">
              <svg class="btn-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Baixar página
            </button>
          </div>
          <div class="slots">${slots}${emptyHtml}</div>
          <div class="film-strip bottom">${dots}</div>
        </section>
      `;
    }).join('');
  }

  function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  // ===== Event delegation on pages container =====

  el.pages.addEventListener('input', e => {
    if (e.target.dataset.action === 'caption') {
      const photo = photos.find(p => p.id === e.target.dataset.id);
      if (photo) photo.caption = e.target.value;
    }
    if (e.target.dataset.action === 'subtitle') {
      const idx = Number(e.target.dataset.page);
      subtitles[idx] = e.target.value;
    }
  });

  el.pages.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    if (btn.dataset.action === 'remove') {
      const photo = photos.find(p => p.id === btn.dataset.id);
      if (photo) URL.revokeObjectURL(photo.url);
      photos = photos.filter(p => p.id !== btn.dataset.id);
      render();
    }

    if (btn.dataset.action === 'download-page') {
      const pageIndex = Number(btn.dataset.page);
      downloadPage(pageIndex, btn);
    }
  });

  // Drag & drop reordering between slots
  el.pages.addEventListener('dragstart', e => {
    const slot = e.target.closest('.slot.filled');
    if (!slot) return;
    dragId = slot.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
  });

  el.pages.addEventListener('dragover', e => {
    const slot = e.target.closest('.slot');
    if (!slot) return;
    e.preventDefault();
    slot.classList.add('drag-over');
  });

  el.pages.addEventListener('dragleave', e => {
    const slot = e.target.closest('.slot');
    if (slot) slot.classList.remove('drag-over');
  });

  el.pages.addEventListener('drop', e => {
    const slot = e.target.closest('.slot');
    if (!slot) return;
    e.preventDefault();
    slot.classList.remove('drag-over');

    const targetId = slot.dataset.id;
    if (!dragId || dragId === targetId) return;

    const fromIndex = photos.findIndex(p => p.id === dragId);
    if (fromIndex === -1) return;
    const [moved] = photos.splice(fromIndex, 1);

    if (targetId) {
      const toIndex = photos.findIndex(p => p.id === targetId);
      photos.splice(toIndex, 0, moved);
    } else {
      // dropped on an empty slot -> append at end
      photos.push(moved);
    }
    dragId = null;
    render();
  });

  // ===== Download as .zip =====

  async function blobFromPhoto(photo) {
    const res = await fetch(photo.url);
    return res.blob();
  }

  function buildFileName(index, photo) {
    const num = String(index + 1).padStart(2, '0');
    const name = sanitize(photo.caption, 'foto');
    return `${num}-${name}.${extOf(photo.file)}`;
  }

  async function downloadAll(triggerBtn) {
    if (typeof JSZip === 'undefined') {
      alert('Não foi possÃ­vel carregar o gerador de .zip. Verifique sua conexão e tente novamente.');
      return;
    }
    const original = triggerBtn.textContent;
    triggerBtn.disabled = true;
    triggerBtn.textContent = 'Preparando...';

    const zip = new JSZip();
    const pagesOfPhotos = chunk(photos, PHOTOS_PER_PAGE);

    for (let pageIndex = 0; pageIndex < pagesOfPhotos.length; pageIndex++) {
      const pageNum = String(pageIndex + 1).padStart(2, '0');
      const folder = zip.folder(`Pagina-${pageNum}`);
      const captionLines = [];

      for (let i = 0; i < pagesOfPhotos[pageIndex].length; i++) {
        const photo = pagesOfPhotos[pageIndex][i];
        const fileName = buildFileName(i, photo);
        const blob = await blobFromPhoto(photo);
        folder.file(fileName, blob);
        captionLines.push(`${fileName} â€” ${photo.caption || '(sem legenda)'}`);
      }
      folder.file('legendas.txt', captionLines.join('\n'));
    }

    const content = await zip.generateAsync({ type: 'blob' });
    triggerDownload(content, 'revelar-album.zip');

    triggerBtn.disabled = false;
    triggerBtn.textContent = original;
  }

  async function downloadPage(pageIndex, triggerBtn) {
    if (typeof JSZip === 'undefined') {
      alert('Não foi possÃ­vel carregar o gerador de .zip. Verifique sua conexão e tente novamente.');
      return;
    }
    const pagesOfPhotos = chunk(photos, PHOTOS_PER_PAGE);
    const group = pagesOfPhotos[pageIndex];
    if (!group || !group.length) return;

    const original = triggerBtn.textContent;
    triggerBtn.disabled = true;
    triggerBtn.textContent = 'Preparando...';

    const zip = new JSZip();
    const captionLines = [];

    for (let i = 0; i < group.length; i++) {
      const photo = group[i];
      const fileName = buildFileName(i, photo);
      const blob = await blobFromPhoto(photo);
      zip.file(fileName, blob);
      captionLines.push(`${fileName} â€” ${photo.caption || '(sem legenda)'}`);
    }
    zip.file('legendas.txt', captionLines.join('\n'));

    const content = await zip.generateAsync({ type: 'blob' });
    const pageNum = String(pageIndex + 1).padStart(2, '0');
    triggerDownload(content, `revelar-pagina-${pageNum}.zip`);

    triggerBtn.disabled = false;
    triggerBtn.textContent = original;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function showToast(message, isError = false) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : ' success');
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 250);
    }, 2500);
  }
  async function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  async function loadImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function generatePdf() {
    if (typeof window.jspdf === 'undefined') { showToast('Gerador de PDF indisponível', true); return; }
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const M = 12, pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
    let headerH = 18, footerH = 10, gap = 8;
    const usableW = pageW - M * 2;
    const cardW = (usableW - gap) / 2;
    const cardH = 95;
    const imgH = cardW * 0.75;
    const logoImg = new Image(); logoImg.src = 'img/fundo branco.png';
    await new Promise((r) => { logoImg.onload = r; logoImg.onerror = r; });

    const prepared = [];
    for (const photo of photos) {
      const img = new Image(); img.src = URL.createObjectURL(photo.file);
      await new Promise(r => { img.onload = r; img.onerror = r; });
      const canvas = document.createElement('canvas');
      const CW = 1200, CH = 900;
      canvas.width = CW; canvas.height = CH;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(CW / img.width, CH / img.height);
      const sw = img.width * scale, sh = img.height * scale;
      ctx.drawImage(img, (CW - sw) / 2, (CH - sh) / 2, sw, sh);
      prepared.push({ photo, dataURL: canvas.toDataURL('image/jpeg', 0.85) });
      URL.revokeObjectURL(img.src);
    }

    const perPage = 4, totalPages = Math.max(1, Math.ceil(prepared.length / perPage));
    let gi = 0;
    for (let p = 0; p < totalPages; p++) {
      if (p > 0) pdf.addPage();
// header
      let headerLineY = M + 18;
      let lh = 0;
      if (logoImg.width) {
        lh = 52;
        const lw = (logoImg.width / logoImg.height) * lh;
        pdf.addImage(logoImg, 'PNG', M, M - 10, lw, lh);
        headerLineY = M + lh + 2;
      }
pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.setTextColor(11, 15, 13);
      pdf.text('RELATÓRIO FOTOGRÁFICO', pageW - M, lh + 8, { align: 'right' });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(91, 102, 96);
      pdf.text(new Date().toLocaleDateString('pt-BR'), pageW - M, lh + 13, { align: 'right' });
const sub = (subtitles[p] || '').trim();
      if (sub) {
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(31, 157, 85);
        pdf.text(sub, M, lh + 18);
      }
      pdf.setDrawColor(31, 157, 85); pdf.setLineWidth(0.7);
      pdf.line(M, lh + 20, pageW - M, lh + 20);

      const group = prepared.slice(p * perPage, p * perPage + perPage);
      group.forEach((item, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const cx = M + col * (cardW + gap);
        const cy = lh + 24 + row * (cardH + gap);
        pdf.setFillColor(255, 255, 255); pdf.setDrawColor(31, 157, 85); pdf.setLineWidth(0.4);
        // rounded rect approximated as rect (jsPDF roundedRect supported)
        pdf.roundedRect(cx, cy, cardW, cardH, 2, 2, 'FD');
        gi++;
        const iw = cardW - 4, ih = imgH;
        // image (already cropped to 4:3)
        pdf.addImage(item.dataURL, 'JPEG', cx + 2, cy + 2, iw, ih);
        // label badge
        pdf.setFillColor(31, 157, 85);
        pdf.roundedRect(cx + 3, cy + 3, 8, 5, 1, 1, 'F');
        pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
        pdf.text(String(gi).padStart(2, '0'), cx + 7, cy + 6.5, { align: 'center' });
        // caption
        const cap = (item.photo.caption || '').trim();
        if (cap) {
          pdf.setFillColor(243, 245, 244);
          pdf.rect(cx + 2, cy + 2 + ih, iw, cardH - ih - 4, 'F');
          pdf.setTextColor(11, 15, 13); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
          const lines = pdf.splitTextToSize(cap, iw - 4);
          pdf.text(lines.slice(0, 3).map((l, idx) => idx === 2 && lines.length > 3 ? l.slice(0, -3) + '...' : l), cx + 4, cy + 8 + ih);
        }
      });

      // footer
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(91, 102, 96);
      pdf.text(`Página ${p + 1} de ${totalPages}`, M, pageH - M + 2);
      pdf.text('Compac Engenharia', pageW - M, pageH - M + 2, { align: 'right' });
      pdf.setDrawColor(190, 196, 193); pdf.setLineWidth(0.2);
      pdf.line(M, pageH - M - 4, pageW - M, pageH - M - 4);
    }
    pdf.save('relatorio-fotografico.pdf');
  }



  el.downloadPdfBtn.addEventListener('click', async () => {
    const original = el.downloadPdfBtn.textContent;
    el.downloadPdfBtn.disabled = true;
    el.downloadPdfBtn.innerHTML = '<span class="spinner"></span> Gerando PDF...';
    const progressBar = document.getElementById('progressBar');
if (progressBar) { progressBar.classList.add('active'); }
     try {
        await generatePdf();
        showToast('PDF pronto!');
      } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        showToast('Erro ao gerar PDF: ' + (err.message || err), true);
      } finally {
      if (progressBar) {
        progressBar.classList.remove('active');
        progressBar.classList.add('complete');
        setTimeout(() => progressBar.classList.remove('complete'), 500);
      }
      el.downloadPdfBtn.disabled = photos.length === 0;
      el.downloadPdfBtn.innerHTML = original;
    }
  });

render();
})();
