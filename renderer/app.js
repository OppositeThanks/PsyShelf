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
    const haystack = [resource.title, ...resource.authors, ...resource.categories, ...resource.languages, resource.description].join(' ').toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
  });
  if (state.sort === 'title') result.sort((a, b) => a.title.localeCompare(b.title));
  if (state.sort === 'author') result.sort((a, b) => (a.authors[0] || '').localeCompare(b.authors[0] || ''));
  if (state.sort === 'recent') result.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
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
        <button class="button primary" id="previewButton" ${canOpen ? '' : 'disabled'}>${resource.url ? 'Open link' : 'Preview or open'}</button>
        <button class="button ghost" id="analyzeButton">Run metadata agent</button>
        <button class="button ghost" id="correctButton">Request correction</button>
      </div>
      <section class="detail-section">
        <h4>Short description</h4>
        <p class="detail-description">${escapeHtml(resource.description || 'No description yet.')}</p>
      </section>
      <section class="detail-section">
        <h4>Classification</h4>
        <div class="tag-row">${[...resource.categories, ...resource.languages].map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join('') || '<span class="pill">Not classified</span>'}</div>
      </section>
      <section class="detail-section">
        <h4>Record</h4>
        <div class="metadata-list">
          <div class="metadata-item"><span>Source</span><strong>${escapeHtml(sourceLabel)}</strong></div>
          <div class="metadata-item"><span>Status</span><strong>${resource.status === 'draft' ? 'Needs review' : 'Ready'}</strong></div>
          <div class="metadata-item"><span>Updated</span><strong>${new Date(resource.updatedAt).toLocaleDateString()}</strong></div>
        </div>
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
}

async function showPreview(resource) {
  if (resource.url) {
    try { await api.openResource(resource.id); } catch (error) { toast(errorMessage(error), true); }
    return;
  }
  const section = $('#previewSection');
  const content = $('#previewContent');
  section.hidden = false;
  content.innerHTML = '<div class="helper-box"><p>Checking preview support…</p></div>';
  try {
    const preview = await api.previewResource(resource.id);
    if (preview.kind === 'image') content.innerHTML = `<img src="${escapeHtml(preview.fileUrl)}" alt="Preview of ${escapeHtml(resource.title)}">`;
    else if (preview.kind === 'audio') content.innerHTML = `<audio controls src="${escapeHtml(preview.fileUrl)}"></audio>`;
    else if (preview.kind === 'video') content.innerHTML = `<video controls src="${escapeHtml(preview.fileUrl)}"></video>`;
    else if (preview.kind === 'pdf') content.innerHTML = `<iframe src="${escapeHtml(preview.fileUrl)}" title="PDF preview"></iframe>`;
    else if (preview.kind === 'text') content.innerHTML = `<pre class="preview-text">${escapeHtml(preview.content)}</pre>`;
    else content.innerHTML = helperMarkup(preview.helper, preview.kind === 'missing');
    content.insertAdjacentHTML('beforeend', `<div class="helper-box"><button class="button ghost" id="openOriginal">Open with Windows</button></div>`);
    $('#openOriginal').addEventListener('click', () => api.openResource(resource.id).catch(error => toast(errorMessage(error), true)));
    const helperButton = $('#openHelperLink');
    if (helperButton) helperButton.addEventListener('click', () => api.openOfficialUrl(helperButton.dataset.url).catch(error => toast(errorMessage(error), true)));
  } catch (error) {
    content.innerHTML = `<div class="helper-box"><strong>Preview unavailable</strong><p>${escapeHtml(errorMessage(error))}</p></div>`;
  }
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
  if (!window.confirm(`Remove “${resource.title}” from the library? The original file will be preserved.`)) return;
  try {
    const result = await api.deleteResource(resource.id);
    state.selectedId = null;
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

async function refreshSettings() {
  try {
    state.settings = await api.getSettings();
    state.agent = state.settings.agent;
    const available = state.agent.available;
    $('#agentModeLabel').textContent = available ? `Local · ${state.agent.models[0] || state.settings.model}` : 'Catalog search · Local AI offline';
    $('#settingsAgentStatus').textContent = available ? `${state.agent.models.length} local model${state.agent.models.length === 1 ? '' : 's'} available` : 'Ollama is not running yet';
    $('#modelInput').value = state.settings.model || 'qwen3:4b';
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
  if (event.key === 'Escape' && $('#floatingChat').classList.contains('open')) closeFloatingChat();
});

const appShell = $('.app-shell');
const detailsToggle = $('#detailsToggle');
const agentBubble = $('#agentBubble');
const floatingChat = $('#floatingChat');
const BUBBLE_POSITION_KEY = 'psyshelf-agent-bubble-position';
const CHAT_POSITION_KEY = 'psyshelf-agent-chat-position';

function setDetailsCollapsed(collapsed) {
  appShell.classList.toggle('details-collapsed', collapsed);
  $('#collapseDetails').setAttribute('aria-expanded', String(!collapsed));
  detailsToggle.setAttribute('aria-expanded', String(!collapsed));
  localStorage.setItem('psyshelf-details-collapsed', String(collapsed));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function storedPosition(key) {
  try {
    const position = JSON.parse(localStorage.getItem(key));
    return Number.isFinite(position?.left) && Number.isFinite(position?.top) ? position : null;
  } catch {
    return null;
  }
}

function placeInsideViewport(element, position) {
  const margin = 12;
  const rect = element.getBoundingClientRect();
  const left = clamp(position.left, margin, window.innerWidth - rect.width - margin);
  const top = clamp(position.top, margin, window.innerHeight - rect.height - margin);
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  element.style.right = 'auto';
  element.style.bottom = 'auto';
  return { left, top };
}

function defaultBubblePosition() {
  return { left: window.innerWidth - 78, top: window.innerHeight - 78 };
}

function positionChatNearBubble() {
  const bubbleRect = agentBubble.getBoundingClientRect();
  const chatRect = floatingChat.getBoundingClientRect();
  const above = bubbleRect.top - chatRect.height - 12;
  const position = {
    left: bubbleRect.right - chatRect.width,
    top: above >= 12 ? above : bubbleRect.bottom + 12
  };
  return placeInsideViewport(floatingChat, position);
}

function openFloatingChat() {
  floatingChat.classList.add('open');
  floatingChat.setAttribute('aria-hidden', 'false');
  agentBubble.classList.add('open');
  agentBubble.setAttribute('aria-expanded', 'true');
  const saved = storedPosition(CHAT_POSITION_KEY);
  requestAnimationFrame(() => {
    placeInsideViewport(floatingChat, saved || positionChatNearBubble());
    $('#chatInput').focus();
  });
}

function closeFloatingChat() {
  floatingChat.classList.remove('open');
  floatingChat.setAttribute('aria-hidden', 'true');
  agentBubble.classList.remove('open');
  agentBubble.setAttribute('aria-expanded', 'false');
}

function toggleFloatingChat() {
  if (floatingChat.classList.contains('open')) closeFloatingChat();
  else openFloatingChat();
}

function makeDraggable(target, handle, storageKey, afterMove) {
  let drag = null;
  let suppressClick = false;
  handle.addEventListener('pointerdown', event => {
    const interactiveTarget = event.target.closest('button, input, textarea');
    if (event.button !== 0 || (interactiveTarget && interactiveTarget !== handle)) return;
    const rect = target.getBoundingClientRect();
    drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    placeInsideViewport(target, { left: drag.left + dx, top: drag.top + dy });
  });
  const finish = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const position = placeInsideViewport(target, target.getBoundingClientRect());
    localStorage.setItem(storageKey, JSON.stringify(position));
    suppressClick = drag.moved;
    drag = null;
    afterMove?.();
  };
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
  handle.addEventListener('click', event => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  }, true);
}

setDetailsCollapsed(localStorage.getItem('psyshelf-details-collapsed') === 'true');
requestAnimationFrame(() => {
  placeInsideViewport(agentBubble, storedPosition(BUBBLE_POSITION_KEY) || defaultBubblePosition());
});

$('#collapseDetails').addEventListener('click', () => setDetailsCollapsed(true));
detailsToggle.addEventListener('click', () => setDetailsCollapsed(false));
agentBubble.addEventListener('click', toggleFloatingChat);
$('#closeChat').addEventListener('click', closeFloatingChat);
makeDraggable(agentBubble, agentBubble, BUBBLE_POSITION_KEY, () => {
  if (floatingChat.classList.contains('open') && !storedPosition(CHAT_POSITION_KEY)) positionChatNearBubble();
});
makeDraggable(floatingChat, $('#chatDragHandle'), CHAT_POSITION_KEY);
window.addEventListener('resize', () => {
  placeInsideViewport(agentBubble, agentBubble.getBoundingClientRect());
  placeInsideViewport(floatingChat, floatingChat.getBoundingClientRect());
});

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
  try { const result = await api.syncBackup(); toast(`Backup updated in ${result.folder}.`); }
  catch (error) { toast(errorMessage(error), true); }
});

Promise.all([loadResources(), refreshSettings()]).catch(error => toast(errorMessage(error), true));
