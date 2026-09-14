(() => {
  const api = window.psyLibrary;
  const el = id => document.getElementById(id);
  const dialog = el('documentSearchDialog');
  let busy = false;
  function setBusy(value) {
    busy = value;
    for (const id of ['documentSearchQuery','documentSearchSelected','documentSearchOCR','documentSearchLanguage','documentSearchStart']) el(id).disabled = value;
    el('documentSearchCancel').hidden = !value;
  }
  el('openDocumentSearch').addEventListener('click', () => {
    if (!api?.searchDocuments) return;
    if (!busy) {
      el('documentSearchQuery').value ||= document.getElementById('searchInput')?.value || '';
      el('documentSearchLanguage').value = {English:'eng',French:'fra',Spanish:'spa'}[window.psyI18n.language] || 'eng';
    }
    dialog.showModal(); el('documentSearchQuery').focus();
  });
  const cancel = () => api?.cancelDocumentSearch().catch(() => {});
  el('documentSearchCancel').addEventListener('click', cancel);
  dialog.addEventListener('close', () => { if (busy) void cancel(); });
  api?.onDocumentSearchProgress(progress => {
    if (!busy) return;
    el('documentSearchStatus').textContent = 'Searching document ' + progress.file + ' of ' + progress.total + '…';
    el('documentSearchCurrent').textContent = progress.title;
  });
  el('documentSearchForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const resourceId = el('documentSearchSelected').checked ? currentResource()?.id : null;
    if (el('documentSearchSelected').checked && !resourceId) { el('documentSearchStatus').textContent = 'Select a resource in the library first.'; return; }
    const query = el('documentSearchQuery').value.trim(); if (!query) return;
    const options = { resourceId, ocr: el('documentSearchOCR').checked, language: el('documentSearchLanguage').value };
    setBusy(true);
    el('documentSearchResults').replaceChildren();
    el('documentSearchStatus').textContent = 'Searching document contents…';
    try {
      const answer = await api.searchDocuments(query, options);
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
    } catch (error) { el('documentSearchStatus').textContent = String(error.message || '').replace(/^Error invoking remote method '[^']+': Error: /,''); }
    finally { setBusy(false);el('documentSearchCurrent').textContent=''; }
  });
})();
