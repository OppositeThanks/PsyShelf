window.startPdfReader = async data => {
  const api = window.psyPreview;
  const host = document.querySelector('#content');
  const status = document.querySelector('#status');
  const pdfjs = await import('../node_modules/pdfjs-dist/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/build/pdf.worker.mjs', location.href).href;
  const task = pdfjs.getDocument({ data: await api.pdfBytes(), isEvalSupported: false, useSystemFonts: true });
  const pdf = await task.promise;
  let reading = await api.reading(), current = Math.min(data.page || 1, pdf.numPages), busy = false, saving = false;
  let selectedQuote = '', textOffset;
  const toolbar = document.createElement('nav'); toolbar.className = 'pdf-toolbar'; toolbar.setAttribute('aria-label', 'PDF navigation');
  toolbar.innerHTML = '<button id="previousPage">Previous page</button><form id="pageForm"><label>PDF page <input id="pdfPage" type="number" min="1" aria-label="PDF page"></label><span id="pdfTotal"></span><button>Go</button></form><button id="nextPage">Next page</button><button id="bookmarkPage">Bookmark page</button><label>Reading status <select id="pdfReadingStatus"><option value="to-read">To read</option><option value="reading">Reading</option><option value="finished">Finished</option></select></label>';
  host.before(toolbar);
  host.innerHTML = '<div class="pdf-layout"><div id="pdfSheet"><canvas id="pdfCanvas"></canvas><div class="textLayer" id="pdfText"></div></div><aside class="pdf-notes"><h2>Annotations</h2><p>Select text on the page, then choose Highlight selection.</p><button id="highlightSelection">Highlight selection</button><form id="pdfAnnotationForm"><label>Quoted passage<textarea id="pdfQuote" maxlength="10000" rows="4"></textarea></label><label>Annotation note<textarea id="pdfNote" maxlength="20000" rows="3"></textarea></label><button>Save annotation</button></form><div id="pdfAnnotations"></div><h2>Bookmarks</h2><div id="pdfBookmarks"></div></aside></div>';
  const el = id => document.getElementById(id);
  el('pdfTotal').textContent = ' / ' + pdf.numPages; el('pdfPage').max = pdf.numPages;
  const report = error => { status.hidden = false; status.textContent = String(error.message || error).replace(/^Error invoking remote method '[^']+': Error: /, ''); };
  async function save(patch) { reading = await api.saveReading(patch); }
  async function edit(action) {
    if (busy || saving) return;
    saving = true;
    try { await action(); } catch (error) { report(error); }
    finally { saving = false; }
  }
  function drawAnnotations() {
    const list = el('pdfAnnotations'); list.replaceChildren();
    const spans = [...el('pdfText').querySelectorAll('span')].filter(span => span.firstChild?.nodeType === Node.TEXT_NODE);
    let text = ''; const positions = spans.map(span => { const start = text.length; text += span.textContent; return { node: span.firstChild, start, end: text.length }; });
    const ranges = [];
    for (const annotation of reading.annotations.filter(a => a.page === current)) {
      const article = document.createElement('article'); article.className = 'annotation-item';
      const quote = document.createElement('blockquote'); quote.setAttribute('translate','no'); quote.textContent = annotation.quote;
      const note = document.createElement('p'); note.setAttribute('translate','no'); note.textContent = annotation.note;
      article.append(quote,note); list.append(article);
      const anchored = Number.isInteger(annotation.textOffset) && text.slice(annotation.textOffset, annotation.textOffset + annotation.quote.length) === annotation.quote;
      const start = annotation.quote ? anchored ? annotation.textOffset : text.indexOf(annotation.quote) : -1;
      if (start >= 0) {
        const end = start + annotation.quote.length;
        const first = positions.find(p => p.end > start), last = positions.find(p => p.end >= end);
        if (first && last) { const range = new Range(); range.setStart(first.node, start-first.start); range.setEnd(last.node,end-last.start); ranges.push(range); }
      }
    }
    CSS.highlights.set('annotations', new Highlight(...ranges));
    el('pdfBookmarks').replaceChildren();
    for (const page of reading.bookmarks) {
      const button = document.createElement('button'); button.textContent = 'PDF page ' + page;
      button.onclick = () => void navigate(page); el('pdfBookmarks').append(button);
    }
    el('bookmarkPage').textContent = reading.bookmarks.includes(current) ? 'Remove bookmark' : 'Bookmark page';
    el('pdfReadingStatus').value = reading.readingStatus;
  }
  async function navigate(number) {
    if (busy || saving || !Number.isInteger(number) || number < 1 || number > pdf.numPages) return;
    busy = true;
    toolbar.querySelectorAll('button,input,select').forEach(e => e.disabled = true);
    el('pdfAnnotationForm').querySelector('button').disabled = true;
    status.hidden = true;
    try {
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const available = host.clientWidth > 700 ? host.clientWidth - 330 : host.clientWidth - 40;
      const viewport = page.getViewport({ scale: Math.min(1.5, Math.min(760, Math.max(260, available)) / base.width) });
      const canvas = el('pdfCanvas'), sheet = el('pdfSheet'), layer = el('pdfText');
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      sheet.style.width = viewport.width + 'px'; sheet.style.height = viewport.height + 'px';
      sheet.style.setProperty('--scale-factor', viewport.scale); sheet.style.setProperty('--total-scale-factor', viewport.scale);
      layer.replaceChildren(); CSS.highlights.delete('annotations');
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      await new pdfjs.TextLayer({ textContentSource: await page.getTextContent(), container: layer, viewport }).render();
      current = number; el('pdfPage').value = current; el('pdfQuote').value = ''; el('pdfNote').value = ''; selectedQuote = ''; textOffset = undefined;
      reading = await api.reading();
      await save({ lastPage: current }); drawAnnotations(); host.scrollTop = 0; page.cleanup();
    } catch (error) { report(error); }
    finally {
      busy = false; toolbar.querySelectorAll('button,input,select').forEach(e => e.disabled = false);
      el('previousPage').disabled = current === 1; el('nextPage').disabled = current === pdf.numPages;
      el('pdfAnnotationForm').querySelector('button').disabled = false;
    }
  }
  el('previousPage').onclick = () => void navigate(current-1);
  el('nextPage').onclick = () => void navigate(current+1);
  el('pageForm').onsubmit = event => { event.preventDefault(); void navigate(Number(el('pdfPage').value)); };
  el('pdfReadingStatus').onchange = event => edit(() => save({ readingStatus: event.target.value }));
  el('bookmarkPage').onclick = () => edit(async () => {
    reading = await api.reading(); await save({ bookmarks: reading.bookmarks.includes(current) ? reading.bookmarks.filter(p => p !== current) : [...reading.bookmarks,current] }); drawAnnotations();
  });
  el('highlightSelection').onmousedown = event => event.preventDefault();
  el('highlightSelection').onclick = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount || !el('pdfText').contains(selection.anchorNode) || !el('pdfText').contains(selection.focusNode)) { status.hidden = false; status.textContent = 'Select a passage on the PDF page first.'; return; }
    const range = selection.getRangeAt(0);
    const prefix = document.createRange(); prefix.selectNodeContents(el('pdfText')); prefix.setEnd(range.startContainer,range.startOffset);
    textOffset = prefix.toString().length; selectedQuote = range.toString().slice(0,10000);
    el('pdfQuote').value = selectedQuote; el('pdfNote').focus();
  };
  el('pdfAnnotationForm').onsubmit = async event => {
    event.preventDefault();
    if (busy || saving) return;
    saving = true;
    const button = event.target.querySelector('button'); button.disabled = true;
    try {
      reading = await api.reading();
      const annotation = { id: crypto.randomUUID(), page: current, quote: el('pdfQuote').value, note: el('pdfNote').value };
      if (annotation.quote === selectedQuote && textOffset !== undefined) annotation.textOffset = textOffset;
      await save({ annotations: [...reading.annotations, annotation] });
      event.target.reset(); drawAnnotations(); status.hidden = false; status.textContent = 'Annotation saved.';
    } catch(error) { report(error); }
    finally { saving = false; button.disabled = false; }
  };
  await navigate(current);
  window.addEventListener('beforeunload', () => { void task.destroy(); });
};
