(() => {
  const api = window.psyLibrary;
  const el = id => document.getElementById(id);
  const section = el('documentSearchSection');
  document.querySelector('.library-view').append(section);
  let generation = 0;
  let timer;
  let queue = Promise.resolve();
  let busy = false;
  function setBusy(value) {
    busy = value;
    for (const id of ['documentSearchSelected','documentSearchOCR','documentSearchLanguage','documentSearchStart']) el(id).disabled = value;
    el('documentSearchCancel').hidden = !value;
  }
  const cancel = () => api?.cancelDocumentSearch().catch(() => {});
  el('documentSearchCancel').addEventListener('click', () => {
    generation++; clearTimeout(timer); void cancel();
    el('documentSearchStatus').textContent = 'Document search cancelled.';
    el('documentSearchCurrent').textContent = '';
  });
  api?.onDocumentSearchProgress(progress => {
    if (!busy || runningGeneration !== generation) return;
    el('documentSearchStatus').textContent = 'Searching document ' + progress.file + ' of ' + progress.total + '…';
    el('documentSearchCurrent').textContent = progress.title;
  });
  let runningGeneration = 0;
  function scheduleSearch(delay = 450) {
    const request = ++generation;
    clearTimeout(timer);
    if (busy) void cancel();
    const query = el('searchInput').value.trim();
    section.hidden = !query;
    el('documentSearchResults').replaceChildren();
    el('documentSearchCurrent').textContent = '';
    if (!query) return;
    el('documentSearchStatus').textContent = api?.searchDocuments ? 'Searching document contents…' : 'Document search is available in the Windows desktop app.';
    if (api?.searchDocuments) timer = setTimeout(() => { queue = queue.then(() => runSearch(request, query)); }, delay);
  }
  document.addEventListener('library-search', () => scheduleSearch());
  el('documentSearchForm').addEventListener('submit', event => { event.preventDefault(); scheduleSearch(0); });
  async function runSearch(request, query) {
    if (request !== generation) return;
    runningGeneration = request;
    const resourceId = el('documentSearchSelected').checked ? currentResource()?.id : null;
    if (el('documentSearchSelected').checked && !resourceId) { el('documentSearchStatus').textContent = 'Select a resource in the library first.'; return; }
    const resourceIds = state.resources.filter(resource =>
      (!state.collection || (resource.collections || []).includes(state.collection)) &&
      (!state.readingStatus || (resource.readingStatus || 'to-read') === state.readingStatus) &&
      (!state.category || resource.categories.includes(state.category)) &&
      (!state.language || resource.languages.includes(state.language)) &&
      ['clinicalTopic', 'audience', 'theoreticalApproach'].every(field => !state[field] || resource[field] === state[field])
    ).map(resource => resource.id);
    const options = { resourceId, resourceIds, ocr: el('documentSearchOCR').checked, language: el('documentSearchLanguage').value };
    setBusy(true);
    el('documentSearchResults').replaceChildren();
    el('documentSearchStatus').textContent = 'Searching document contents…';
    try {
      const answer = await api.searchDocuments(query, options);
      if (request !== generation) return;
      el('documentSearchStatus').textContent = answer.cancelled ? 'Document search cancelled.' : answer.results.length ? 'Matching passages: ' + answer.results.length : 'No matching passages found.';
      for (const result of answer.results) {
        const card = document.createElement('section'); card.className = 'document-hit';
        const title = document.createElement('strong'); title.setAttribute('translate','no'); title.textContent = result.title;
        const location = document.createElement('p'); location.textContent = result.page ? 'PDF page ' + result.page : 'Text passage (no page number)';
        const excerpt = document.createElement('blockquote'); excerpt.setAttribute('translate','no'); excerpt.textContent = result.excerpt;
        const open = document.createElement('button'); open.type = 'button'; open.className = 'button compact'; open.textContent = result.page ? 'Open source page' : 'Open source';
        open.addEventListener('click', async () => { try { await api.openPreview(result.resourceId, result.page); } catch { el('documentSearchStatus').textContent = 'Could not open this source. It may have moved or been removed.'; } });
        card.append(title, location);
        if (result.ocr) { const note=document.createElement('small');note.textContent='Recognized with OCR — verify against the original.';card.append(note); }
        card.append(excerpt, open);el('documentSearchResults').append(card);
      }
      if (answer.warnings.length) {
        const warnings = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Search limitations'; warnings.append(summary);
        for (const warning of answer.warnings) {
          const line = document.createElement('p');const title = document.createElement('span');title.setAttribute('translate','no');title.textContent = warning.title ? warning.title + ': ' : '';
          const message = document.createElement('span');message.textContent = warning.message;line.append(title,message);warnings.append(line);
        }
        el('documentSearchResults').append(warnings);
      }
    } catch (error) { if (request === generation) el('documentSearchStatus').textContent = String(error.message || '').replace(/^Error invoking remote method '[^']+': Error: /,''); }
    finally { setBusy(false); if (request === generation) el('documentSearchCurrent').textContent=''; }
  }
})();
