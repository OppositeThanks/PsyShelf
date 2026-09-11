const demoSeed = [
  { id: '1', title: 'El hombre en busca de sentido', authors: ['Viktor Frankl'], categories: ['Book'], languages: ['Spanish'], description: 'Resiliencia, logoterapia y búsqueda de sentido vital.', sourceKind: 'google-sheet', status: 'ready', updatedAt: new Date().toISOString() },
  { id: '2', title: 'Pensar rápido, pensar despacio', authors: ['Daniel Kahneman'], categories: ['Book'], languages: ['Spanish'], description: 'Psicología cognitiva y toma de decisiones.', sourceKind: 'google-sheet', status: 'ready', updatedAt: new Date().toISOString() },
  { id: '3', title: 'Del revés (Inside Out)', authors: ['Pixar'], categories: ['Movie'], languages: ['Spanish', 'English'], description: 'Inteligencia emocional y gestión de las emociones.', sourceKind: 'google-sheet', status: 'ready', updatedAt: new Date().toISOString() },
  { id: '4', title: 'Weightless', authors: ['Marconi Union'], categories: ['Music'], languages: ['No spoken language'], description: 'Music associated with relaxation and anxiety reduction.', sourceKind: 'google-sheet', status: 'ready', updatedAt: new Date().toISOString() },
  { id: '5', title: 'The Help', authors: [], categories: ['Movie', 'Draft'], languages: ['English'], description: 'Imported as a draft because the original spreadsheet row was incomplete.', sourceKind: 'google-sheet', status: 'draft', updatedAt: new Date().toISOString() }
];

function makeDemoApi() {
  let resources = structuredClone(demoSeed);
  return {
    listResources: async () => structuredClone(resources),
    addFiles: async () => { throw new Error('File import is available in the Windows desktop build.'); },
    addUrl: async item => {
      const created = { ...item, id: crypto.randomUUID(), authors: splitList(item.authors), categories: splitList(item.categories), languages: splitList(item.languages), sourceKind: 'url', status: 'ready', updatedAt: new Date().toISOString() };
      resources.unshift(created); return created;
    },
    updateResource: async (id, patch) => { const index = resources.findIndex(item => item.id === id); resources[index] = { ...resources[index], ...patch }; return resources[index]; },
    deleteResource: async id => { resources = resources.filter(item => item.id !== id); return { deleted: true, message: 'Entry removed.' }; },
    openResource: async () => ({ opened: true }),
    previewResource: async () => ({ kind: 'missing', helper: { name: 'Windows default application', reason: 'Preview is connected in the desktop build.', builtIn: false } }),
    shareResource: async () => ({ canceled: false, folder: 'Selected folder', fileIncluded: false }),
    analyzeResource: async id => resources.find(item => item.id === id),
    reviewCorrection: async (id, request) => ({ correctionId: 'demo', decision: 'needs-override', explanation: 'The visual preview is not connected to Ollama.', resource: resources.find(item => item.id === id), request }),
    overrideCorrection: async () => resources[0],
    chat: async message => ({ mode: 'catalog-search', answer: `Preview search received: “${message}”. The desktop build connects this panel to your local model.`, resourceIds: [] }),
    agentStatus: async () => ({ available: false, models: [], configuredModel: 'qwen3:4b', modelReady: false }),
    getSettings: async () => ({ model: 'qwen3:4b', backupFolder: '', agent: { available: false, models: [] } }),
    updateSettings: async patch => patch,
    chooseBackupFolder: async () => ({ canceled: true }),
    backupStatus: async () => ({ history: [], safety: [], lastSuccessful: null, error: '' }),
    restoreBackup: async () => { throw new Error('Backup restoration is available in the desktop app.'); },
    syncBackup: async () => ({ folder: 'PsyShelf Backup', updatedAt: new Date().toISOString() }),
    openOfficialUrl: async url => window.open(url, '_blank')
  };
}

const api = window.psyLibrary || makeDemoApi();
const state = {
  resources: [],
  selectedId: null,
  category: '',
  language: '',
  query: '',
  sort: 'recent',
  agent: null,
  settings: null
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function splitList(value) {
  return [...new Set(String(value || '').split(',').map(item => item.trim()).filter(Boolean))];
}

function resourceTheme(resource) {
  const category = (resource.categories[0] || 'Other').toLowerCase();
  if (category.includes('book') || category.includes('document')) return { accent: '#7c5c3e', soft: '#f3e9dd', icon: 'B' };
  if (category.includes('music') || category.includes('audio')) return { accent: '#735488', soft: '#eee5f3', icon: '♪' };
  if (category.includes('movie') || category.includes('series') || category.includes('video')) return { accent: '#9c594a', soft: '#f5e6e2', icon: '▶' };
  if (category.includes('art') || category.includes('image')) return { accent: '#a26d33', soft: '#f6ecdc', icon: '◇' };
  if (category.includes('url') || category.includes('web')) return { accent: '#356c8e', soft: '#e1eef4', icon: '↗' };
  if (category.includes('scientific') || category.includes('article')) return { accent: '#376c58', soft: '#dfeee7', icon: '∑' };
  return { accent: '#496f63', soft: '#e3eee9', icon: '•' };
}

function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.className = 'toast'; }, 3500);
}

function errorMessage(error) {
  return error?.message || String(error || 'Something went wrong.');
}

function currentResource() {
  return state.resources.find(resource => resource.id === state.selectedId) || null;
}

function filteredResources() {
  const terms = state.query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  let result = state.resources.filter(resource => {
    if (state.category && !resource.categories.includes(state.category)) return false;
    if (state.language && !resource.languages.includes(state.language)) return false;
    if (!terms.length) return true;
    const haystack = [resource.title, ...resource.authors, ...resource.categories, ...resource.languages, resource.description, resource.publicationYear, resource.clinicalTopic, resource.theoreticalApproach, resource.audience, resource.personalNotes].join(' ').toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
  });
  if (state.sort === 'title') result.sort((a, b) => a.title.localeCompare(b.title));
  if (state.sort === 'author') result.sort((a, b) => (a.authors[0] || '').localeCompare(b.authors[0] || ''));
  if (state.sort === 'recent') result.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  if (state.sort === 'rating') result.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  if (state.sort === 'year') result.sort((a, b) => (Number(b.publicationYear) || 0) - (Number(a.publicationYear) || 0));
  return result;
}

function filterCounts(field) {
  const counts = new Map();
  for (const resource of state.resources) {
    for (const value of resource[field]) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function renderFilters() {
  $('#libraryCount').textContent = state.resources.length;
  $('#categoryFilters').innerHTML = filterCounts('categories').map(([name, count]) => `
    <button class="filter-button${state.category === name ? ' active' : ''}" data-category="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><span>${count}</span></button>
  `).join('');
  $('#languageFilters').innerHTML = filterCounts('languages').map(([name, count]) => `
    <button class="filter-button${state.language === name ? ' active' : ''}" data-language="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><span>${count}</span></button>
  `).join('');
  $$('[data-category]').forEach(button => button.addEventListener('click', () => {
    state.category = state.category === button.dataset.category ? '' : button.dataset.category;
    state.language = '';
    render();
  }));
  $$('[data-language]').forEach(button => button.addEventListener('click', () => {
    state.language = state.language === button.dataset.language ? '' : button.dataset.language;
    state.category = '';
    render();
  }));
}

function renderCards() {
  const resources = filteredResources();
  const label = state.category || state.language || (state.query ? `Search: “${state.query}”` : 'All resources');
  $('#activeFilterLabel').textContent = label;
  $('#activeFilterLabel').setAttribute('translate', state.category || state.language ? 'no' : 'yes');
  $('#resultCount').textContent = `${resources.length} resource${resources.length === 1 ? '' : 's'}`;
  $('#emptyState').hidden = resources.length > 0;
  $('#resourceGrid').innerHTML = resources.map(resource => {
    const theme = resourceTheme(resource);
    const pills = [...resource.categories.slice(0, 1), ...resource.languages.slice(0, 1)];
    return `
      <button class="resource-card${resource.id === state.selectedId ? ' selected' : ''}" data-id="${escapeHtml(resource.id)}" style="--accent:${theme.accent};--accent-soft:${theme.soft}">
        <div class="card-top"><span class="type-icon">${theme.icon}</span>${resource.status === 'draft' ? '<span class="draft-badge">Needs review</span>' : ''}</div>
        <h3>${escapeHtml(resource.title)}</h3>
        <div class="card-author">${escapeHtml(resource.authors.join(', ') || 'Author not set')}</div>
        <p class="card-description">${escapeHtml(resource.description || 'No description yet.')}</p>
        <div class="card-meta">${pills.map((pill, index) => `<span class="pill${index === 0 ? ' category' : ''}">${escapeHtml(pill)}</span>`).join('')}</div>
      </button>`;
  }).join('');
  $$('.resource-card').forEach(card => card.addEventListener('click', () => {
    state.selectedId = card.dataset.id;
    renderCards();
    renderDetails();
  }));
}

let contextResourceId = null;
let contextScrollTop = 0;
function closeResourceMenu(restoreFocus = false) {
  $('#resourceMenu').hidden = true;
  if (restoreFocus) $$('.resource-card').find(card => card.dataset.id === contextResourceId)?.focus({ preventScroll: true });
  contextResourceId = null;
}

function openResourceMenu(card, x, y) {
  contextResourceId = card.dataset.id;
  contextScrollTop = $('.library-view').scrollTop;
  const menu = $('#resourceMenu');
  menu.hidden = false;
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8))}px`;
  menu.querySelector('button').focus({ preventScroll: true });
}

$('#resourceGrid').addEventListener('contextmenu', event => {
  const card = event.target.closest('.resource-card');
  if (!card) return;
  event.preventDefault();
  openResourceMenu(card, event.clientX, event.clientY);
});
$('#resourceGrid').addEventListener('keydown', event => {
  if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
  const card = event.target.closest('.resource-card');
  if (!card) return;
  event.preventDefault();
  const bounds = card.getBoundingClientRect();
  openResourceMenu(card, bounds.left + 12, bounds.top + 12);
});
$('#resourceMenu').addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  const resource = state.resources.find(item => item.id === contextResourceId);
  if (!action || !resource) return;
  closeResourceMenu(true);
  state.selectedId = resource.id;
  renderCards();
  renderDetails();
  $('.tab[data-tab="details"]').click();
  if (action === 'correct') openCorrection(resource);
  else if (action === 'preview') {
    showPreview(resource);

  } else if (action === 'delete') deleteSelected(resource);
  else $('#detailsPanel').scrollTop = 0;
});
$('#resourceMenu').addEventListener('keydown', event => {
  const items = [...$('#resourceMenu').querySelectorAll('button')];
  const current = items.indexOf(document.activeElement);
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  } else if (event.key === 'Escape' || event.key === 'Tab') {
    if (event.key === 'Escape') event.preventDefault();
    closeResourceMenu(true);
  }
});
document.addEventListener('pointerdown', event => { if (!event.target.closest('#resourceMenu')) closeResourceMenu(); });
$('.library-view').addEventListener('scroll', () => {
  if ($('.library-view').scrollTop !== contextScrollTop) closeResourceMenu();
});
window.addEventListener('resize', () => closeResourceMenu());
window.addEventListener('blur', () => closeResourceMenu());

function renderDetails() {
  const resource = currentResource();
  if (!resource) {
    $('#detailsPanel').innerHTML = `<div class="inspector-empty"><div class="empty-symbol">Ψ</div><h3>Select a resource</h3><p>Preview it, review its metadata, share it, or ask the local agent for help.</p></div>`;
    return;
  }
  const theme = resourceTheme(resource);
  const sourceLabel = resource.sourceKind === 'google-sheet' ? 'Imported from Google Sheet' : resource.sourceKind === 'url' ? 'Web link' : resource.storageMode === 'copy' ? 'Managed file copy' : 'Referenced file';
  const canOpen = Boolean(resource.url || resource.filePath);
  $('#detailsPanel').innerHTML = `
    <div class="detail-content" style="--accent:${theme.accent};--accent-soft:${theme.soft}">
      <div class="detail-hero">
        <span class="type-icon">${theme.icon}</span>
        <h2>${escapeHtml(resource.title)}</h2>
        <p>${escapeHtml(resource.authors.join(', ') || 'Author not set')}</p>
      </div>
      <div class="detail-actions">
        <button class="button primary" id="previewButton" >Preview</button>
        <button class="button ghost" id="analyzeButton">Run metadata agent</button>
        <button class="button ghost" id="correctButton">Request correction</button>
      </div>
      <section class="detail-section">
        <h4>Short description</h4>
        <p class="detail-description" ${resource.description ? '' : 'data-ui'}>${escapeHtml(resource.description || 'No description yet.')}</p>
      </section>
      <section class="detail-section">
        <h4>Classification</h4>
        <div class="tag-row">${[...resource.categories, ...resource.languages].map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join('') || '<span class="pill">Not classified</span>'}</div>
      </section>
      <section class="detail-section">
        <h4>Record</h4>
        <div class="metadata-list">
          <div class="metadata-item"><span>Source</span><strong data-ui>${escapeHtml(sourceLabel)}</strong></div>
          <div class="metadata-item"><span>Status</span><strong data-ui>${resource.status === 'draft' ? 'Needs review' : 'Ready'}</strong></div>
          <div class="metadata-item"><span>Updated</span><strong>${new Date(resource.updatedAt).toLocaleDateString()}</strong></div>
        </div>
      </section>
      <section class="detail-section">
        <h4>Resource details</h4>
        <div class="metadata-list">
          ${[['Year', resource.publicationYear], ['Clinical topic', resource.clinicalTopic], ['Approach', resource.theoreticalApproach], ['Audience', resource.audience], ['Rating', resource.rating ? `${resource.rating} / 5` : null]].map(([label, value]) => `<div class="metadata-item"><span>${label}</span><strong ${value ? '' : 'data-ui'}>${escapeHtml(value || (label === 'Rating' ? 'Not rated' : 'Not set'))}</strong></div>`).join('')}
        </div>
        <h4>Personal notes</h4>
        <p class="detail-description" ${resource.personalNotes ? '' : 'data-ui'}>${escapeHtml(resource.personalNotes || 'No notes yet.')}</p>
        <div class="button-row"><button class="button ghost" id="editResourceDetails">Edit details & notes</button></div>
      </section>
      <section class="detail-section" id="previewSection" hidden>
        <h4>Preview helper</h4>
        <div id="previewContent" class="preview-box"></div>
      </section>
      <section class="detail-section">
        <h4>Share</h4>
        <label class="share-permission"><input id="includeFile" type="checkbox" ${resource.filePath ? '' : 'disabled'}><span>Include the file. I confirm that copyright or permission allows me to share it.</span></label>
        <button class="button ghost" id="shareButton">Export shareable entry</button>
      </section>
      <section class="detail-section"><button class="button danger" id="deleteButton">Remove entry</button></section>
    </div>`;

  $('#previewButton')?.addEventListener('click', () => showPreview(resource));
  $('#analyzeButton').addEventListener('click', analyzeSelected);
  $('#correctButton').addEventListener('click', () => openCorrection(resource));
  $('#shareButton').addEventListener('click', () => shareSelected(resource));
  $('#deleteButton').addEventListener('click', () => deleteSelected(resource));
  $('#editResourceDetails').addEventListener('click', () => {
    const form = $('#resourceDetailsForm');
    form.reset();
    form.elements.resourceId.value = resource.id;
    for (const field of ['publicationYear', 'clinicalTopic', 'theoreticalApproach', 'audience', 'rating', 'personalNotes']) form.elements[field].value = resource[field] ?? '';
    $('#resourceDetailsName').textContent = resource.title;
    $('#resourceDetailsError').textContent = '';
    $('#resourceDetailsDialog').showModal();
  });
}

async function showPreview(resource) {
  try { await api.openPreview(resource.id); }
  catch (error) { toast(errorMessage(error), true); }
}

function helperMarkup(helper, missing) {
  const safe = helper || { name: 'Windows default application', reason: 'Try opening this file with Windows.' };
  return `<div class="helper-box"><strong>${missing ? 'File not found' : `Recommended: ${escapeHtml(safe.name)}`}</strong><p>${escapeHtml(safe.reason)}</p>${safe.url ? `<button class="button ghost" id="openHelperLink" data-url="${escapeHtml(safe.url)}">Visit official download page</button>` : ''}</div>`;
}

async function analyzeSelected() {
  const button = $('#analyzeButton');
  button.disabled = true;
  button.textContent = 'Analyzing locally…';
  try {
    const updated = await api.analyzeResource(state.selectedId);
    replaceResource(updated);
    toast('Metadata reviewed by the local agent.');
  } catch (error) {
    toast(errorMessage(error), true);
    openSettings();
  } finally {
    if (document.body.contains(button)) { button.disabled = false; button.textContent = 'Run metadata agent'; }
  }
}

function openCorrection(resource) {
  const form = $('#correctionForm');
  form.reset();
  form.elements.resourceId.value = resource.id;
  form.elements.title.value = resource.title;
  form.elements.authors.value = resource.authors.join(', ');
  form.elements.categories.value = resource.categories.join(', ');
  form.elements.languages.value = resource.languages.join(', ');
  form.elements.description.value = resource.description;
  $('#correctionResult').hidden = true;
  $('#correctionDialog').showModal();
}

async function shareSelected(resource) {
  const includeFile = $('#includeFile').checked;
  try {
    const result = await api.shareResource(resource.id, includeFile);
    if (!result.canceled) toast(`Share package created${result.fileIncluded ? ' with its file' : ''}.`);
  } catch (error) { toast(errorMessage(error), true); }
}

async function deleteSelected(resource) {
  const confirmation = $('#deleteDialog');
  if (confirmation.open) return;
  confirmation.returnValue = 'cancel';
  $('#deleteDescription').textContent = `You are about to delete “${resource.title}” from your library.`;
  const confirmed = await new Promise(resolve => {
    confirmation.addEventListener('close', () => resolve(confirmation.returnValue === 'delete'), { once: true });
    confirmation.showModal();
  });
  if (!confirmed) return;
  try {
    const result = await api.deleteResource(resource.id);
    if (state.selectedId === resource.id) state.selectedId = null;
    await loadResources();
    toast(result.message || 'Entry removed.');
  } catch (error) { toast(errorMessage(error), true); }
}

function replaceResource(updated) {
  const index = state.resources.findIndex(item => item.id === updated.id);
  if (index >= 0) state.resources[index] = updated;
  else state.resources.unshift(updated);
  render();
}

function render() {
  renderFilters();
  renderCards();
  renderDetails();
}

async function loadResources(selectId = null) {
  state.resources = await api.listResources({});
  if (selectId) state.selectedId = selectId;
  if (state.selectedId && !state.resources.some(item => item.id === state.selectedId)) state.selectedId = null;
  render();
}

async function refreshBackupStatus() {
  try {
    const status = await api.backupStatus();
    $('#backupStatus').textContent = status.error ? 'Backup failed: ' + status.error :
      status.lastSuccessful ? 'Last successful backup: ' + new Date(status.lastSuccessful).toLocaleString() : 'No successful backup found in the selected folder.';
    const list = $('#backupHistory');
    list.replaceChildren();
    for (const item of [...status.safety, ...status.history]) {
      const entry = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = (item.kind === 'before-restore' ? 'Safety copy — ' : '') +
        (item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Unknown date') + ' ';
      label.title = item.folder;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'button compact'; button.textContent = 'Restore';
      button.dataset.restoreFolder = item.folder;
      button.setAttribute('aria-label', 'Restore ' + label.textContent.trim());
      entry.append(label, button);
      list.append(entry);
    }
  } catch (error) { $('#backupStatus').textContent = 'Backup status unavailable: ' + errorMessage(error); }
}

async function refreshSettings() {
  await refreshBackupStatus();
  try {
    state.settings = await api.getSettings();
    $('#appVersion').textContent = `PsyShelf ${state.settings.appVersion}`;
    $('#uninstallApp').disabled = !state.settings.canUninstall;
    window.psyI18n.setLanguage(state.settings.language);
    $('#interfaceLanguage').value = window.psyI18n.language;
    state.agent = state.settings.agent;
    const available = state.agent.available;
    $('#agentModeLabel').textContent = available ? `Local · ${state.agent.models[0] || state.settings.model}` : 'Catalog search · Local AI offline';
    $('#settingsAgentStatus').textContent = available ? `${state.agent.models.length} local model${state.agent.models.length === 1 ? '' : 's'} available` : 'Ollama is not running yet';
    $('#modelInput').value = state.settings.model || 'qwen3:4b';
    $('#settingsModelCommand').textContent = `ollama pull ${$('#modelInput').value}`;
    $('#settingsBackupPath').setAttribute('translate', state.settings.backupFolder ? 'no' : 'yes');
    $('#settingsBackupPath').textContent = state.settings.backupFolder || 'Not configured';
    $('#backupLabel').textContent = state.settings.backupFolder ? 'Automatic cloud-folder backup on' : 'Cloud backup not set';
  } catch (error) {
    $('#agentModeLabel').textContent = 'Status unavailable';
  }
}

function openSettings() {
  refreshSettings();
  if (!$('#settingsDialog').open) $('#settingsDialog').showModal();
}

async function chooseStorageMode() {
  const dialogElement = $('#storageDialog');
  return new Promise(resolve => {
    dialogElement.addEventListener('close', () => resolve(dialogElement.returnValue || 'cancel'), { once: true });
    dialogElement.showModal();
  });
}

$('#addFileButton').addEventListener('click', async () => {
  const storageMode = await chooseStorageMode();
  if (!['copy', 'reference'].includes(storageMode)) return;
  try {
    const created = await api.addFiles({ storageMode });
    if (created.length) {
      await loadResources(created[0].id);
      toast(`${created.length} resource${created.length === 1 ? '' : 's'} added as editable drafts.`);
    }
  } catch (error) { toast(errorMessage(error), true); }
});

$('#addUrlButton').addEventListener('click', () => $('#urlDialog').showModal());
$('#settingsButton').addEventListener('click', openSettings);
$('#backupCard').addEventListener('click', openSettings);
$('#allResourcesButton').addEventListener('click', () => { state.category = ''; state.language = ''; state.query = ''; $('#searchInput').value = ''; render(); });

$$('[data-close]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.close}`).close()));

$('#urlForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    const created = await api.addUrl(data);
    form.reset();
    $('#urlDialog').close();
    await loadResources(created.id);
    toast('Link added to your library.');
  } catch (error) { toast(errorMessage(error), true); }
});

$('#correctionForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Reviewing locally…';
  const data = Object.fromEntries(new FormData(form));
  const resourceId = data.resourceId;
  delete data.resourceId;
  try {
    const review = await api.reviewCorrection(resourceId, data);
    const result = $('#correctionResult');
    result.hidden = false;
    result.className = `review-result ${review.decision}`;
    result.innerHTML = `<strong>${review.decision === 'accepted' ? 'Correction accepted' : review.decision === 'rejected' ? 'Agent kept the current metadata' : 'Local review unavailable'}</strong><br>${escapeHtml(review.explanation)}${review.decision !== 'accepted' ? '<br><button class="button compact" id="overrideButton" type="button">Use my final override</button>' : ''}`;
    if (review.decision === 'accepted') {
      replaceResource(review.resource);
      setTimeout(() => $('#correctionDialog').close(), 900);
    } else {
      $('#overrideButton').addEventListener('click', async () => {
        try {
          const updated = await api.overrideCorrection(review.correctionId);
          replaceResource(updated);
          $('#correctionDialog').close();
          toast('Your final override was applied.');
        } catch (error) { toast(errorMessage(error), true); }
      });
    }
  } catch (error) { toast(errorMessage(error), true); }
  finally { submit.disabled = false; submit.textContent = 'Ask agent to review'; }
});

$('#searchInput').addEventListener('input', event => { state.query = event.target.value.trim(); renderCards(); });
$('#sortSelect').addEventListener('change', event => { state.sort = event.target.value; renderCards(); });
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault(); $('#searchInput').focus();
  }
});

$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.tab').forEach(item => item.classList.toggle('active', item === tab));
  $$('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === `${tab.dataset.tab}Panel`));
}));

$('#chatForm').addEventListener('submit', async event => {
  event.preventDefault();
  const input = $('#chatInput');
  const message = input.value.trim();
  if (!message) return;
  const messages = $('#chatMessages');
  messages.insertAdjacentHTML('beforeend', `<div class="message user">${escapeHtml(message)}</div><div class="message agent loading">Thinking on your computer…</div>`);
  input.value = '';
  messages.scrollTop = messages.scrollHeight;
  try {
    const answer = await api.chat(message);
    messages.querySelector('.loading')?.remove();
    messages.insertAdjacentHTML('beforeend', `<div class="message agent">${escapeHtml(answer.answer)}</div>`);
  } catch (error) {
    messages.querySelector('.loading')?.remove();
    messages.insertAdjacentHTML('beforeend', `<div class="message agent">${escapeHtml(errorMessage(error))}</div>`);
  }
  messages.scrollTop = messages.scrollHeight;
});

$('#openOllama').addEventListener('click', () => api.openOfficialUrl('https://ollama.com/download/windows').catch(error => toast(errorMessage(error), true)));
$('#copyModelCommand').addEventListener('click', async () => {
  const command = `ollama pull ${$('#modelInput').value.trim() || 'qwen3:4b'}`;
  try { await navigator.clipboard.writeText(command); toast('Model command copied.'); } catch { toast(command); }
});
$('#saveModel').addEventListener('click', async () => {
  try { await api.updateSettings({ model: $('#modelInput').value }); await refreshSettings(); toast('Local model preference saved.'); }
  catch (error) { toast(errorMessage(error), true); }
});
$('#chooseBackup').addEventListener('click', async () => {
  try { const result = await api.chooseBackupFolder(); if (!result.canceled) { await refreshSettings(); toast('Cloud backup folder connected.'); } }
  catch (error) { toast(errorMessage(error), true); }
});
$('#syncNow').addEventListener('click', async () => {
  const button = $('#syncNow');
  button.disabled = true;
  try { const result = await api.syncBackup(); toast(`Backup updated in ${result.folder}.`); }
  catch (error) { toast(errorMessage(error), true); }
  finally { button.disabled = false; await refreshBackupStatus(); }
});

async function restoreFrom(folder) {
  const button = $('#restoreBackup');
  if (button.disabled) return;
  button.disabled = true;
  try {
    const result = await api.restoreBackup(folder);
    if (result.canceled) return;
    state.selectedId = null;
    state.query = ''; state.category = ''; state.language = '';
    $('#searchInput').value = '';
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    await loadResources();
    toast('Library restored. Safety backup: ' + result.safetyFolder);
  } catch (error) { toast(errorMessage(error), true); }
  finally { button.disabled = false; await refreshBackupStatus(); }
}
$('#restoreBackup').addEventListener('click', () => restoreFrom());
$('#backupHistory').addEventListener('click', event => {
  const button = event.target.closest('[data-restore-folder]');
  if (button) restoreFrom(button.dataset.restoreFolder);
});

$('#resourceDetailsFields').append($('#extraDetailsTemplate').content.cloneNode(true));
$('#urlForm .field-grid').append($('#extraDetailsTemplate').content.cloneNode(true));
$('#resourceDetailsForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  const { resourceId, ...details } = Object.fromEntries(new FormData(form));
  try {
    replaceResource(await api.updateResource(resourceId, details));
    $('#resourceDetailsDialog').close();
    toast('Resource details saved.');
  } catch (error) { $('#resourceDetailsError').textContent = errorMessage(error); }
  finally { button.disabled = false; }
});

let setupRecommendation = null;
let setupScanGeneration = 0;

async function scanAgentHardware() {
  const generation = ++setupScanGeneration;
  setupRecommendation = null;
  $('#setupResults').hidden = true;
  $('#setupRescan').disabled = true;
  $('#setupScanStatus').textContent = 'Checking your computer…';
  $('#setupActionStatus').textContent = '';
  try {
    const { specs, recommendation, agent } = await api.scanHardware();
    if (generation !== setupScanGeneration) return;
    setupRecommendation = recommendation.model;
    const rows = [
      ['System', specs.platform], ['Processor', `${specs.cpu} · ${specs.threads} logical processors`],
      ['Memory', `${specs.totalGB.toFixed(1)} GiB total · ${specs.freeGB.toFixed(1)} GiB available now`],
      ['Graphics', specs.gpu], ['Free disk', specs.diskGB === null ? 'Could not detect; check space before downloading.' : `${specs.diskGB.toFixed(1)} GB on the estimated model drive`],
      ['Model folder', `${specs.modelPath} (estimated; Ollama may use a different location)`]
    ];
    $('#setupSpecs').innerHTML = rows.map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join('');
    $('#setupModelTitle').textContent = recommendation.model ? `Recommended: ${recommendation.model}` : 'Use the library without AI for now';
    $('#setupReason').textContent = recommendation.reason;
    $('#setupDownloadSize').textContent = recommendation.model ? `Approximately ${recommendation.downloadGB} GB to download. Allow extra space for Ollama and installation. Close memory-heavy apps before using the agent.` : '';
    $('#setupSteps').hidden = !recommendation.model;
    $('#setupCommand').textContent = recommendation.model ? `ollama pull ${recommendation.model}` : '';
    $('#setupScanStatus').textContent = 'Computer check complete.';
    $('#setupActionStatus').textContent = agent.available ? (agent.models.includes(recommendation.model) ? 'This model is already installed. You can connect it in step 3.' : 'Ollama is running. Follow step 2 to download the recommended model.') : 'Ollama is offline or not installed. Start with step 1.';
    $('#setupResults').hidden = false;
  } catch (error) {
    $('#setupScanStatus').textContent = `Could not check this computer: ${errorMessage(error)} You can scan again or continue to the library.`;
  } finally { if (generation === setupScanGeneration) $('#setupRescan').disabled = false; }
}

function openAgentSetup() {
  if (!api.scanHardware) { toast('Computer setup is available in the Windows desktop app.'); return; }
  $('#settingsDialog').close();
  if (!$('#agentSetupDialog').open) $('#agentSetupDialog').showModal();
  scanAgentHardware();
}

$('#runAgentSetup').addEventListener('click', openAgentSetup);
$('#setupRescan').addEventListener('click', scanAgentHardware);
$('#agentSetupDialog').addEventListener('close', () => {
  setupScanGeneration++;
  api.dismissSetup?.().catch(error => toast(`Could not save setup preference: ${errorMessage(error)}`, true));
});
$('#setupGetOllama').addEventListener('click', () => api.openOfficialUrl('https://ollama.com/download/windows').catch(error => toast(errorMessage(error), true)));
$('#setupCopyCommand').addEventListener('click', async () => {
  if (!setupRecommendation) return;
  try { await navigator.clipboard.writeText(`ollama pull ${setupRecommendation}`); $('#setupActionStatus').textContent = 'Command copied. Paste it into a new PowerShell window and press Enter.'; }
  catch { $('#setupActionStatus').textContent = 'Copy the command shown in step 2 manually.'; }
});
$('#setupUseModel').addEventListener('click', async () => {
  if (!setupRecommendation) return;
  const model = setupRecommendation;
  $('#setupUseModel').disabled = true;
  $('#setupRescan').disabled = true;
  $('#setupActionStatus').textContent = 'Checking the local installation…';
  try {
    await api.useSetupModel(model);
    await refreshSettings();
    $('#setupActionStatus').textContent = `${model} is installed and selected. Your library agent is ready. You can continue to the library.`;
  } catch (error) { $('#setupActionStatus').textContent = errorMessage(error); }
  finally { $('#setupUseModel').disabled = false; $('#setupRescan').disabled = false; }
});
$('#modelInput').addEventListener('input', () => { $('#settingsModelCommand').textContent = `ollama pull ${$('#modelInput').value.trim() || 'qwen3:4b'}`; });
$('#interfaceLanguage').addEventListener('change', async event => {
  const previous = window.psyI18n.language;
  try {
    await api.updateSettings({ language: event.target.value });
    window.psyI18n.setLanguage(event.target.value);
    if (state.settings) state.settings.language = event.target.value;
  } catch (error) { event.target.value = previous; toast(errorMessage(error), true); }
});
api.onLanguageChange?.(language => {
  window.psyI18n.setLanguage(language);
  $('#interfaceLanguage').value = language;
});

Promise.all([loadResources(), refreshSettings()]).then(() => {
  if (api.scanHardware && state.settings && !state.settings.agentSetupSeen) openAgentSetup();
}).catch(error => toast(errorMessage(error), true));

$('#uninstallApp').addEventListener('click', async () => {
  const button = $('#uninstallApp');
  button.disabled = true;
  try { await api.uninstall(); }
  catch (error) { toast(errorMessage(error), true); }
  finally { button.disabled = !state.settings?.canUninstall; }
});
