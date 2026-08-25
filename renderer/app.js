const api = window.psyLibrary;
if (!api) throw new Error('PsyShelf must run inside its Windows desktop shell.');
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

const RESOURCE_THEMES = [
  { terms: ['book', 'document'], accent: '#7c5c3e', soft: '#f3e9dd', icon: 'B' },
  { terms: ['music', 'audio'], accent: '#735488', soft: '#eee5f3', icon: '♪' },
  { terms: ['movie', 'series', 'video'], accent: '#9c594a', soft: '#f5e6e2', icon: '▶' },
  { terms: ['art', 'image'], accent: '#a26d33', soft: '#f6ecdc', icon: '◇' },
  { terms: ['url', 'web'], accent: '#356c8e', soft: '#e1eef4', icon: '↗' },
  { terms: ['scientific', 'article'], accent: '#376c58', soft: '#dfeee7', icon: '∑' }
];
const DEFAULT_THEME = { accent: '#496f63', soft: '#e3eee9', icon: '•' };

/** Finds the first element that matches a CSS selector. */
const $ = selector => document.querySelector(selector);

/** Escapes untrusted values before inserting them into HTML templates. */
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** Chooses a visual theme from the resource's primary category. */
function resourceTheme(resource) {
  const category = (resource.categories[0] || 'Other').toLowerCase();
  return RESOURCE_THEMES.find(theme => theme.terms.some(term => category.includes(term))) || DEFAULT_THEME;
}

/** Shows a temporary success or error notification. */
function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.className = 'toast'; }, 3500);
}

/** Converts unknown thrown values into a readable message. */
function errorMessage(error) {
  return error?.message || String(error || 'Something went wrong.');
}

/** Shows an error notification from any thrown value. */
function showError(error) {
  toast(errorMessage(error), true);
}

/** Returns the currently selected resource, if one exists. */
function currentResource() {
  return state.resources.find(resource => resource.id === state.selectedId) || null;
}

/** Applies active filters and sorting to the in-memory catalog. */
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

/** Counts and sorts unique category or language values. */
function filterCounts(field) {
  const counts = new Map();
  for (const resource of state.resources) {
    for (const value of resource[field]) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Renders category and language controls from current state. */
function renderFilters() {
  $('#libraryCount').textContent = state.resources.length;
  $('#categoryFilters').innerHTML = filterCounts('categories').map(([name, count]) => `
    <button class="filter-button${state.category === name ? ' active' : ''}" data-category="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><span>${count}</span></button>
  `).join('');
  $('#languageFilters').innerHTML = filterCounts('languages').map(([name, count]) => `
    <button class="filter-button${state.language === name ? ' active' : ''}" data-language="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><span>${count}</span></button>
  `).join('');
}

/** Renders the current result set as resource cards. */
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
}

/** Returns a readable label for a resource's storage source. */
function sourceLabel(resource) {
  if (resource.sourceKind === 'google-sheet') return 'Imported from Google Sheet';
  if (resource.sourceKind === 'url') return 'Web link';
  return resource.storageMode === 'copy' ? 'Managed file copy' : 'Referenced file';
}

/** Renders actions and metadata for the selected resource. */
function renderDetails() {
  const resource = currentResource();
  if (!resource) {
    $('#detailsPanel').innerHTML = `<div class="inspector-empty"><div class="empty-symbol">Ψ</div><h3>Select a resource</h3><p>Preview it, review its metadata, share it, or ask the local agent for help.</p></div>`;
    return;
  }
  const theme = resourceTheme(resource);
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
          <div class="metadata-item"><span>Source</span><strong>${escapeHtml(sourceLabel(resource))}</strong></div>
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

}

/** Opens a URL or renders a supported local preview inside the details drawer. */
async function showPreview(resource) {
  if (resource.url) {
    try { await api.openResource(resource.id); } catch (error) { showError(error); }
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
  } catch (error) {
    content.innerHTML = `<div class="helper-box"><strong>Preview unavailable</strong><p>${escapeHtml(errorMessage(error))}</p></div>`;
  }
}

/** Builds the helper recommendation shown for unsupported or missing files. */
function helperMarkup(helper, missing) {
  const safe = helper || { name: 'Windows default application', reason: 'Try opening this file with Windows.' };
  return `<div class="helper-box"><strong>${missing ? 'File not found' : `Recommended: ${escapeHtml(safe.name)}`}</strong><p>${escapeHtml(safe.reason)}</p>${safe.url ? `<button class="button ghost" id="openHelperLink" data-url="${escapeHtml(safe.url)}">Visit official download page</button>` : ''}</div>`;
}

/** Runs metadata analysis for the selected resource. */
async function analyzeSelected() {
  const button = $('#analyzeButton');
  button.disabled = true;
  button.textContent = 'Analyzing locally…';
  try {
    const updated = await api.analyzeResource(state.selectedId);
    replaceResource(updated);
    toast('Metadata reviewed by the local agent.');
  } catch (error) {
    showError(error);
    openSettings();
  } finally {
    if (document.body.contains(button)) { button.disabled = false; button.textContent = 'Run metadata agent'; }
  }
}

/** Opens the correction form prefilled with current metadata. */
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

/** Exports the selected resource under the owner's sharing choice. */
async function shareSelected(resource) {
  const includeFile = $('#includeFile').checked;
  try {
    const result = await api.shareResource(resource.id, includeFile);
    if (!result.canceled) toast(`Share package created${result.fileIncluded ? ' with its file' : ''}.`);
  } catch (error) { showError(error); }
}

/** Removes the selected entry after explicit owner confirmation. */
async function deleteSelected(resource) {
  if (!window.confirm(`Remove “${resource.title}” from the library? The original file will be preserved.`)) return;
  try {
    const result = await api.deleteResource(resource.id);
    state.selectedId = null;
    await loadResources();
    toast(result.message || 'Entry removed.');
  } catch (error) { showError(error); }
}

/** Replaces or inserts one resource in state and refreshes the interface. */
function replaceResource(updated) {
  const index = state.resources.findIndex(item => item.id === updated.id);
  if (index >= 0) state.resources[index] = updated;
  else state.resources.unshift(updated);
  render();
}

/** Renders every state-dependent library region. */
function render() {
  renderFilters();
  renderCards();
  renderDetails();
}

/** Reloads catalog data and preserves a valid selection. */
async function loadResources(selectId = null) {
  state.resources = await api.listResources({});
  if (selectId) state.selectedId = selectId;
  if (state.selectedId && !state.resources.some(item => item.id === state.selectedId)) state.selectedId = null;
  render();
}

/** Refreshes local model and backup settings in the interface. */
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

/** Opens the settings dialog after starting a status refresh. */
function openSettings() {
  refreshSettings();
  if (!$('#settingsDialog').open) $('#settingsDialog').showModal();
}

/** Resolves the owner's copy-or-reference choice from the storage dialog. */
async function chooseStorageMode() {
  const dialogElement = $('#storageDialog');
  return new Promise(resolve => {
    dialogElement.addEventListener('close', () => resolve(dialogElement.returnValue || 'cancel'), { once: true });
    dialogElement.showModal();
  });
}

/** Imports files after the owner chooses copy or reference storage. */
async function handleAddFileClick() {
  const storageMode = await chooseStorageMode();
  if (!['copy', 'reference'].includes(storageMode)) return;
  try {
    const created = await api.addFiles({ storageMode });
    if (created.length) {
      await loadResources(created[0].id);
      toast(`${created.length} resource${created.length === 1 ? '' : 's'} added as editable drafts.`);
    }
  } catch (error) { showError(error); }
}

/** Opens the add-link dialog. */
function handleAddUrlClick() {
  $('#urlDialog').showModal();
}

/** Clears every active catalog filter. */
function clearFilters() {
  state.category = '';
  state.language = '';
  state.query = '';
  $('#searchInput').value = '';
  render();
}

/** Closes the dialog named by a button's data attribute. */
function handleDialogClose(event) {
  const button = event.target.closest('[data-close]');
  if (button) $(`#${button.dataset.close}`).close();
}

/** Creates a web-link resource from the add-link form. */
async function handleUrlSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  try {
    const created = await api.addUrl(data);
    form.reset();
    $('#urlDialog').close();
    await loadResources(created.id);
    toast('Link added to your library.');
  } catch (error) { showError(error); }
}

/** Submits a correction for local agent review. */
async function handleCorrectionSubmit(event) {
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
    result.dataset.correctionId = review.correctionId;
    result.innerHTML = `<strong>${review.decision === 'accepted' ? 'Correction accepted' : review.decision === 'rejected' ? 'Agent kept the current metadata' : 'Local review unavailable'}</strong><br>${escapeHtml(review.explanation)}${review.decision !== 'accepted' ? '<br><button class="button compact" id="overrideButton" type="button">Use my final override</button>' : ''}`;
    if (review.decision === 'accepted') {
      replaceResource(review.resource);
      setTimeout(() => $('#correctionDialog').close(), 900);
    }
  } catch (error) { showError(error); }
  finally { submit.disabled = false; submit.textContent = 'Ask agent to review'; }
}

/** Applies the owner's final override from the correction result. */
async function handleCorrectionResultClick(event) {
  if (!event.target.closest('#overrideButton')) return;
  try {
    const updated = await api.overrideCorrection(event.currentTarget.dataset.correctionId);
    replaceResource(updated);
    $('#correctionDialog').close();
    toast('Your final override was applied.');
  } catch (error) { showError(error); }
}

/** Toggles a category or language filter through event delegation. */
function handleFilterClick(event) {
  const button = event.target.closest('.filter-button');
  if (!button) return;
  if (button.dataset.category) {
    state.category = state.category === button.dataset.category ? '' : button.dataset.category;
    state.language = '';
  } else if (button.dataset.language) {
    state.language = state.language === button.dataset.language ? '' : button.dataset.language;
    state.category = '';
  }
  render();
}

/** Selects a resource card through one persistent grid listener. */
function handleResourceGridClick(event) {
  const card = event.target.closest('.resource-card');
  if (!card) return;
  state.selectedId = card.dataset.id;
  renderCards();
  renderDetails();
}

/** Routes selected-resource buttons through one persistent details listener. */
function handleDetailsClick(event) {
  const button = event.target.closest('button');
  const resource = currentResource();
  if (!button || !resource) return;
  if (button.id === 'previewButton') showPreview(resource);
  else if (button.id === 'analyzeButton') analyzeSelected();
  else if (button.id === 'correctButton') openCorrection(resource);
  else if (button.id === 'shareButton') shareSelected(resource);
  else if (button.id === 'deleteButton') deleteSelected(resource);
  else if (button.id === 'openOriginal') api.openResource(resource.id).catch(showError);
  else if (button.id === 'openHelperLink') api.openOfficialUrl(button.dataset.url).catch(showError);
}

/** Updates the text-search query as the owner types. */
function handleSearchInput(event) {
  state.query = event.target.value.trim();
  renderCards();
}

/** Applies the selected resource sort order. */
function handleSortChange(event) {
  state.sort = event.target.value;
  renderCards();
}

/** Handles global search focus and floating-chat dismissal shortcuts. */
function handleKeyboardShortcut(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault(); $('#searchInput').focus();
  }
  if (event.key === 'Escape' && $('#floatingChat').classList.contains('open')) closeFloatingChat();
}

const appShell = $('.app-shell');
const detailsToggle = $('#detailsToggle');
const agentBubble = $('#agentBubble');
const floatingChat = $('#floatingChat');
const BUBBLE_POSITION_KEY = 'psyshelf-agent-bubble-position';
const CHAT_POSITION_KEY = 'psyshelf-agent-chat-position';

/** Folds or restores the details drawer and remembers that choice. */
function setDetailsCollapsed(collapsed) {
  appShell.classList.toggle('details-collapsed', collapsed);
  $('#collapseDetails').setAttribute('aria-expanded', String(!collapsed));
  detailsToggle.setAttribute('aria-expanded', String(!collapsed));
  localStorage.setItem('psyshelf-details-collapsed', String(collapsed));
}

/** Restricts a numeric value to an inclusive range. */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Reads a valid saved screen position from local storage. */
function storedPosition(key) {
  try {
    const position = JSON.parse(localStorage.getItem(key));
    return Number.isFinite(position?.left) && Number.isFinite(position?.top) ? position : null;
  } catch {
    return null;
  }
}

/** Moves an element to a position that remains inside the viewport. */
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

/** Returns the default bottom-right position for the Ask bubble. */
function defaultBubblePosition() {
  return { left: window.innerWidth - 78, top: window.innerHeight - 78 };
}

/** Places the chat panel beside the current Ask bubble position. */
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

/** Opens and positions the floating Ask Library panel. */
function openFloatingChat() {
  floatingChat.classList.add('open');
  floatingChat.setAttribute('aria-hidden', 'false');
  agentBubble.classList.add('open');
  agentBubble.setAttribute('aria-expanded', 'true');
  const saved = storedPosition(CHAT_POSITION_KEY);
  requestAnimationFrame(() => {
    if (saved) placeInsideViewport(floatingChat, saved);
    else positionChatNearBubble();
    $('#chatInput').focus();
  });
}

/** Closes the floating Ask Library panel. */
function closeFloatingChat() {
  floatingChat.classList.remove('open');
  floatingChat.setAttribute('aria-hidden', 'true');
  agentBubble.classList.remove('open');
  agentBubble.setAttribute('aria-expanded', 'false');
}

/** Toggles the floating Ask Library panel. */
function toggleFloatingChat() {
  if (floatingChat.classList.contains('open')) closeFloatingChat();
  else openFloatingChat();
}

/** Adds pointer dragging and saved positioning to a floating element. */
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
  /** Finishes a drag gesture and stores its final position. */
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

/** Places the Ask bubble at its saved or default position. */
function initializeBubblePosition() {
  placeInsideViewport(agentBubble, storedPosition(BUBBLE_POSITION_KEY) || defaultBubblePosition());
}

/** Keeps an unsaved chat panel next to the bubble after dragging. */
function repositionUnsavedChat() {
  if (floatingChat.classList.contains('open') && !storedPosition(CHAT_POSITION_KEY)) positionChatNearBubble();
}

/** Re-clamps floating elements when the application window changes size. */
function handleWindowResize() {
  placeInsideViewport(agentBubble, agentBubble.getBoundingClientRect());
  placeInsideViewport(floatingChat, floatingChat.getBoundingClientRect());
}

/** Folds the resource details drawer. */
function collapseDetails() {
  setDetailsCollapsed(true);
}

/** Restores the resource details drawer. */
function expandDetails() {
  setDetailsCollapsed(false);
}

/** Sends one catalog-grounded question to the local agent. */
async function handleChatSubmit(event) {
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
}

/** Opens the allowlisted official Ollama download page. */
function handleOpenOllama() {
  api.openOfficialUrl('https://ollama.com/download/windows').catch(showError);
}

/** Copies the configured Ollama model-install command. */
async function handleCopyModelCommand() {
  const command = `ollama pull ${$('#modelInput').value.trim() || 'qwen3:4b'}`;
  try { await navigator.clipboard.writeText(command); toast('Model command copied.'); } catch { toast(command); }
}

/** Saves the preferred local model name. */
async function handleSaveModel() {
  try { await api.updateSettings({ model: $('#modelInput').value }); await refreshSettings(); toast('Local model preference saved.'); }
  catch (error) { showError(error); }
}

/** Connects a cloud-synchronized backup folder. */
async function handleChooseBackup() {
  try { const result = await api.chooseBackupFolder(); if (!result.canceled) { await refreshSettings(); toast('Cloud backup folder connected.'); } }
  catch (error) { showError(error); }
}

/** Starts an immediate backup to the configured sync folder. */
async function handleSyncNow() {
  try { const result = await api.syncBackup(); toast(`Backup updated in ${result.folder}.`); }
  catch (error) { showError(error); }
}

/** Wires static controls and initializes persistent floating UI state. */
function initializeInterface() {
  setDetailsCollapsed(localStorage.getItem('psyshelf-details-collapsed') === 'true');
  requestAnimationFrame(initializeBubblePosition);
  makeDraggable(agentBubble, agentBubble, BUBBLE_POSITION_KEY, repositionUnsavedChat);
  makeDraggable(floatingChat, $('#chatDragHandle'), CHAT_POSITION_KEY);

  $('#addFileButton').addEventListener('click', handleAddFileClick);
  $('#addUrlButton').addEventListener('click', handleAddUrlClick);
  $('#settingsButton').addEventListener('click', openSettings);
  $('#backupCard').addEventListener('click', openSettings);
  $('#allResourcesButton').addEventListener('click', clearFilters);
  $('#urlForm').addEventListener('submit', handleUrlSubmit);
  $('#correctionForm').addEventListener('submit', handleCorrectionSubmit);
  $('#correctionResult').addEventListener('click', handleCorrectionResultClick);
  $('#categoryFilters').addEventListener('click', handleFilterClick);
  $('#languageFilters').addEventListener('click', handleFilterClick);
  $('#resourceGrid').addEventListener('click', handleResourceGridClick);
  $('#detailsPanel').addEventListener('click', handleDetailsClick);
  $('#searchInput').addEventListener('input', handleSearchInput);
  $('#sortSelect').addEventListener('change', handleSortChange);
  $('#collapseDetails').addEventListener('click', collapseDetails);
  detailsToggle.addEventListener('click', expandDetails);
  agentBubble.addEventListener('click', toggleFloatingChat);
  $('#closeChat').addEventListener('click', closeFloatingChat);
  $('#chatForm').addEventListener('submit', handleChatSubmit);
  $('#openOllama').addEventListener('click', handleOpenOllama);
  $('#copyModelCommand').addEventListener('click', handleCopyModelCommand);
  $('#saveModel').addEventListener('click', handleSaveModel);
  $('#chooseBackup').addEventListener('click', handleChooseBackup);
  $('#syncNow').addEventListener('click', handleSyncNow);
  document.addEventListener('click', handleDialogClose);
  document.addEventListener('keydown', handleKeyboardShortcut);
  window.addEventListener('resize', handleWindowResize);
}

initializeInterface();
Promise.all([loadResources(), refreshSettings()]).catch(showError);
