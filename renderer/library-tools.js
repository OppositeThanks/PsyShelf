(() => {
  const desktop = window.psyLibrary;
  const labels = { 'to-read': 'To read', reading: 'Reading', finished: 'Finished' };
  const safe = escapeHtml;
  function dialog(id, title, body) {
    let node = document.getElementById(id);
    if (node) node.remove();
    node = document.createElement('dialog'); node.id = id; node.className = 'organize-dialog';
    node.innerHTML = `<header><h2>${title}</h2><button class="button compact" data-close-tool>Close</button></header><div class="organize-body">${body}</div><p class="tool-status" role="status"></p>`;
    node.querySelector('[data-close-tool]').onclick = () => node.close();
    document.body.append(node); node.showModal(); return node;
  }
  const run = async (node, action) => {
    const status = node.querySelector('.tool-status');
    status.textContent = '';
    try { await action(); } catch (error) { status.textContent = errorMessage(error).replace(/^Error invoking remote method '[^']+': Error: /, ''); }
  };
  let searches = [];
  async function refreshSearches() {
    searches = await desktop.savedSearches();
    $('#savedSearchSelect').innerHTML = '<option value="">Choose a saved search</option>' + searches.map((s,i) => `<option translate="no" value="${i}">${safe(s.name)}</option>`).join('');
  }
  $('#readingFilter').onchange = event => { state.readingStatus = event.target.value; render(); };
  $('#collectionFilter').onchange = event => { state.collection = event.target.value; render(); };
  $('#savedSearchSelect').onchange = event => {
    if (event.target.value === '') return;
    const search = searches[Number(event.target.value)];
    for (const field of ['query','category','language','clinicalTopic','audience','theoreticalApproach','collection','readingStatus']) state[field] = search.filters[field] || '';
    state.sort = search.filters.sort || 'recent';
    $('#searchInput').value = state.query; $('#sortSelect').value = state.sort;
    $('#documentSearchOCR').checked = search.ocr;
    $('#documentSearchLanguage').value = search.ocrLanguage;
    render();
  };
  async function openReading(id) {
    const resource = (await desktop.listResources()).find(r => r.id === id);
    if (!resource) throw new Error('Resource not found.');
    const node = dialog('readingDialog', 'Reading & annotations', `
      <h3 translate="no">${safe(resource.title)}</h3>
      <form id="readingForm" class="tool-form">
        <label>Reading status<select name="readingStatus">${Object.entries(labels).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        <label>Collections (comma-separated)<input name="collections" maxlength="1000" value="${safe((resource.collections || []).join(', '))}"></label>
        <button class="button primary">Save reading details</button>
      </form>
      <div class="button-row"><button class="button" id="resumeReading">Resume reading</button><button class="button" id="relinkReading">Locate replacement file</button><button class="button" id="exportAnnotations">Export annotations</button></div>
      <h3>Bookmarks</h3><div id="bookmarkList"></div>
      <h3>Annotations</h3><div id="annotationList"></div>
      <form id="annotationForm" class="tool-form">
        <label>PDF page (leave empty for other formats)<input name="page" type="number" min="1" max="100000"></label>
        <label>Quoted passage<textarea name="quote" maxlength="10000" rows="3"></textarea></label>
        <label>Annotation note<textarea name="note" maxlength="20000" rows="3"></textarea></label>
        <button class="button primary">Save annotation</button>
      </form>`);
    let annotations = resource.annotations || [], bookmarks = resource.bookmarks || [], editing = null;
    const form = node.querySelector('#readingForm'); form.elements.readingStatus.value = resource.readingStatus;
    form.onsubmit = event => { event.preventDefault(); void run(node, async () => {
      await desktop.updateResource(id, { readingStatus: form.elements.readingStatus.value, collections: splitList(form.elements.collections.value) });
      await loadResources(id); node.querySelector('.tool-status').textContent = 'Saved.';
    }); };
    const draw = () => {
      node.querySelector('#bookmarkList').innerHTML = bookmarks.map(page => `<div class="button-row"><button class="button compact" data-page="${page}"><span>PDF page</span> ${page}</button><button class="button compact" data-remove-bookmark="${page}">Remove bookmark</button></div>`).join('') || '<p>No bookmarks yet.</p>';
      node.querySelector('#annotationList').innerHTML = annotations.map((a,i) => `<article class="annotation-item"><button class="button compact" data-annotation-page="${i}">${a.page ? '<span>PDF page</span> ' + a.page : 'Open source'}</button><blockquote translate="no">${safe(a.quote)}</blockquote><p translate="no">${safe(a.note)}</p><button class="button compact" data-edit="${i}">Edit annotation</button> <button class="button compact" data-remove="${i}">Delete annotation</button></article>`).join('') || '<p>No annotations yet.</p>';
    };
    draw();
    node.onclick = event => { const target = event.target.closest('button'); if (!target) return;
      if (target.dataset.page) void run(node, () => desktop.openPreview(id, Number(target.dataset.page)));
      if (target.dataset.removeBookmark) void run(node, async () => {
        const next = bookmarks.filter(p => p !== Number(target.dataset.removeBookmark));
        await desktop.updateResource(id, { bookmarks: next }); bookmarks = next; draw();
      });
      if (target.dataset.annotationPage !== undefined) void run(node, () => desktop.openPreview(id, annotations[Number(target.dataset.annotationPage)].page));
      if (target.dataset.edit !== undefined) {
        const a = annotations[Number(target.dataset.edit)]; editing = a.id;
        const fields = node.querySelector('#annotationForm').elements; fields.page.value = a.page || ''; fields.quote.value = a.quote; fields.note.value = a.note; fields.note.focus();
      }
      if (target.dataset.remove !== undefined) void run(node, async () => {
        const next = annotations.filter((_,i) => i !== Number(target.dataset.remove));
        await desktop.updateResource(id, { annotations: next }); annotations = next; draw();
      });
    };
    node.querySelector('#annotationForm').onsubmit = event => { event.preventDefault(); void run(node, async () => {
      const fields = event.target.elements;
      const annotation = { id: editing || crypto.randomUUID(), page: fields.page.value ? Number(fields.page.value) : null, quote: fields.quote.value, note: fields.note.value };
      const next = [...annotations.filter(a => a.id !== annotation.id), annotation];
      await desktop.updateResource(id, { annotations: next }); annotations = next; editing = null; event.target.reset(); draw();
      node.querySelector('.tool-status').textContent = 'Saved.';
    }); };
    node.querySelector('#resumeReading').onclick = () => run(node, () => desktop.openPreview(id));
    node.querySelector('#relinkReading').onclick = () => run(node, async () => { if (await desktop.relinkFile(id)) { node.close(); await loadResources(id); } });
    node.querySelector('#exportAnnotations').onclick = () => run(node, async () => { if (await desktop.exportNotes(id)) node.querySelector('.tool-status').textContent = 'Annotations exported.'; });
    node.addEventListener('close', () => void loadResources(id));
  }
  function openTools() {
    if (!desktop) { toast('Available in the Windows desktop app.', true); return; }
    const resources = filteredResources();
    const node = dialog('libraryToolsDialog', 'Organize library', `
      <section><h3>Saved searches</h3><p>Save the current search, filters, sort order, and OCR options.</p><form id="saveSearchForm" class="button-row"><input name="name" aria-label="Saved search name" placeholder="Saved search name" maxlength="120" required><button class="button">Save search</button></form><div id="searchList"></div></section>
      <section><h3>Bulk metadata editing</h3><p>Choose resources from the current results. The chosen field will be replaced for every selected resource.</p>
      <label><input id="bulkAll" type="checkbox"> Select all results</label><div class="bulk-resources">${resources.map(r => `<label><input type="checkbox" name="bulkId" value="${safe(r.id)}"><span translate="no">${safe(r.title)}</span></label>`).join('')}</div>
      <form id="bulkForm" class="tool-form"><label>Field<select name="field"><option value="collections">Collections</option><option value="readingStatus">Reading status</option><option value="categories">Categories</option><option value="languages">Languages</option><option value="clinicalTopic">Clinical topic</option><option value="audience">Audience</option><option value="theoreticalApproach">Theoretical approach</option></select></label>
      <label>Replacement value<input name="value" maxlength="1000"><select name="status" hidden>${Object.entries(labels).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <p>Use commas for collections, categories, and languages. Empty values clear the field.</p>
      <button class="button primary">Review bulk edit</button></form><div id="bulkReview" hidden></div></section>
      <section><h3>Library cleanup</h3><p>Find identical files, repeated links, matching catalog titles, and missing files. Nothing is deleted automatically.</p><div class="button-row"><button class="button" id="scanLibrary">Scan library</button><button class="button" id="cancelScan" hidden>Cancel scan</button></div><div id="scanResults"></div></section>
      <section><h3>Document index</h3><p>Text and OCR are indexed locally on first search. Changed files are reindexed automatically. Clear the index to reclaim disk space or rebuild it on the next search.</p><button class="button" id="clearDocumentIndex">Clear document index</button></section>`);
    const drawSearches = () => {
      node.querySelector('#searchList').innerHTML = searches.map((s,i) => `<div class="button-row"><span translate="no">${safe(s.name)}</span><button class="button compact" data-delete-search="${i}">Delete saved search</button></div>`).join('');
      node.querySelectorAll('[data-delete-search]').forEach(button => button.onclick = () => run(node, async () => { await desktop.saveSearches(searches.filter((_,i) => i !== Number(button.dataset.deleteSearch))); await refreshSearches(); drawSearches(); }));
    };
    void run(node, async () => { await refreshSearches(); drawSearches(); });
    node.querySelector('#saveSearchForm').onsubmit = event => { event.preventDefault(); void run(node, async () => {
      const filters = Object.fromEntries(['query','category','language','clinicalTopic','audience','theoreticalApproach','sort','collection','readingStatus'].map(k => [k,state[k]]));
      await desktop.saveSearches([...searches, { name: event.target.elements.name.value, filters, ocr: $('#documentSearchOCR').checked, ocrLanguage: $('#documentSearchLanguage').value }]);
      await refreshSearches(); drawSearches(); event.target.reset();
    }); };
    node.querySelector('#bulkAll').onchange = event => node.querySelectorAll('[name="bulkId"]').forEach(c => { c.checked = event.target.checked; });
    const bulk = node.querySelector('#bulkForm');
    bulk.elements.field.onchange = () => { bulk.elements.value.hidden = bulk.elements.field.value === 'readingStatus'; bulk.elements.status.hidden = !bulk.elements.value.hidden; node.querySelector('#bulkReview').hidden = true; };
    bulk.onsubmit = event => { event.preventDefault();
      const ids = [...node.querySelectorAll('[name="bulkId"]:checked')].map(c => c.value);
      if (!ids.length) { node.querySelector('.tool-status').textContent = 'Select resources first.'; return; }
      const field = bulk.elements.field.value;
      const value = field === 'readingStatus' ? bulk.elements.status.value : ['collections','categories','languages'].includes(field) ? splitList(bulk.elements.value.value) : bulk.elements.value.value;
      const review = node.querySelector('#bulkReview'); review.hidden = false;
      review.innerHTML = `<p><span>Selected resources:</span> ${ids.length}</p><p translate="no">${safe(Array.isArray(value) ? value.join(', ') : value)}</p><button class="button primary">Apply replacement to selected resources</button>`;
      review.querySelector('button').onclick = () => run(node, async () => { await desktop.bulkEdit(ids, { [field]: value }); await loadResources(); review.hidden = true; node.querySelector('.tool-status').textContent = 'Saved.'; });
    };
    node.querySelector('#clearDocumentIndex').onclick = () => run(node, async () => { await desktop.clearIndex(); node.querySelector('.tool-status').textContent = 'Document index cleared.'; });
    const scanButton = node.querySelector('#scanLibrary'), cancel = node.querySelector('#cancelScan');
    cancel.onclick = () => desktop.cancelLibraryScan();
    node.addEventListener('close', () => void desktop.cancelLibraryScan());
    scanButton.onclick = () => run(node, async () => {
      scanButton.disabled = true; cancel.hidden = false; node.querySelector('.tool-status').textContent = 'Scanning library…';
      try {
        const result = await desktop.scanLibrary();
        if (result.cancelled) { node.querySelector('.tool-status').textContent = 'Scan cancelled.'; return; }
        const row = (r, missing = false) => `<div class="cleanup-row"><span translate="no">${safe(r.title)}<small>${safe(r.filePath || r.url || '')}</small></span><button class="button compact" data-inspect="${safe(r.id)}">View details</button>${missing ? `<button class="button compact" data-relink="${safe(r.id)}">Locate replacement file</button>` : ''}</div>`;
        node.querySelector('#scanResults').innerHTML = result.groups.map(g => `<h4>${g.kind === 'file' ? 'Identical files' : g.kind === 'url' ? 'Repeated links' : 'Possible duplicates (matching titles)'}</h4>${g.items.map(r => row(r)).join('')}`).join('') + '<h4>Missing files</h4>' + result.missing.map(r => row(r,true)).join('') + '<h4>Unreadable or changing files</h4>' + result.unreadable.map(r => row(r,true)).join('');
        node.querySelectorAll('[data-inspect]').forEach(b => b.onclick = () => { node.close(); state.selectedId = b.dataset.inspect; render(); $('.tab[data-tab="details"]').click(); });
        node.querySelectorAll('[data-relink]').forEach(b => b.onclick = () => run(node, async () => { if (await desktop.relinkFile(b.dataset.relink)) { b.closest('.cleanup-row').remove(); await loadResources(); } }));
        node.querySelector('.tool-status').textContent = 'Library scan complete.';
      } finally { scanButton.disabled = false; cancel.hidden = true; }
    });
  }
  $('#libraryToolsButton').onclick = openTools;
  desktop?.onLibraryChanged(() => { void loadResources(); void refreshSearches(); });
  document.addEventListener('library-restored', () => { if (desktop) void refreshSearches().catch(error => toast(errorMessage(error),true)); });
  if (desktop) void refreshSearches().catch(error => toast(errorMessage(error), true));
  window.libraryTools = { openReading: id => openReading(id).catch(error => toast(errorMessage(error), true)), openTools };
})();
