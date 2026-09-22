const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
  const nodes = new Map();
  function element() {
    return { value: '', textContent: '', checked: false, hidden: false, children: [], events: {},
      addEventListener(name, callback) { this.events[name] = callback; },
      append(...children) { this.children.push(...children); },
      replaceChildren() { this.children = []; }, setAttribute() {} };
  }
  const el = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const document = { ...element(), getElementById: el, querySelector: () => el('library'), createElement: element };
  const timers = new Map(); let nextTimer = 0; const requests = []; let cancellations = 0;
  const api = {
    onDocumentSearchProgress(callback) { this.progress = callback; },
    cancelDocumentSearch: async () => { cancellations++; },
    searchDocuments(query, options) { return new Promise(resolve => requests.push({ query, options, resolve })); }
  };
  const state = { resources: [
    { id: 'a', categories: ['Book'], languages: ['Spanish'], clinicalTopic: 'Anxiety', audience: 'Adolescents', theoreticalApproach: 'CBT' },
    { id: 'b', categories: ['Book'], languages: ['English'], clinicalTopic: 'Grief', audience: 'Adults', theoreticalApproach: 'Humanistic' }
  ], category: '', language: '', clinicalTopic: '', audience: '', theoreticalApproach: '' };
  vm.runInNewContext(fs.readFileSync(require.resolve('../renderer/document-search.js'), 'utf8'), {
    document, window: { psyLibrary: api }, state, currentResource: () => state.resources[0],
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  return { el, state, requests, api, get cancellations() { return cancellations; },
    search(query) { el('searchInput').value = query; document.events['library-search'](); },
    async flush() { for (const callback of timers.values()) callback(); timers.clear(); await new Promise(setImmediate); }
  };
}

test('unified search debounces input and scopes passages to active clinical and language filters', async () => {
  const h = harness();
  h.state.language = 'Spanish'; h.state.clinicalTopic = 'Anxiety'; h.state.audience = 'Adolescents'; h.state.theoreticalApproach = 'CBT';
  h.search('anx'); h.search('anxiety'); await h.flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].query, 'anxiety');
  assert.deepEqual(Array.from(h.requests[0].options.resourceIds), ['a']);
  h.requests[0].resolve({ results: [], warnings: [] }); await h.flush();
  assert.equal(h.el('documentSearchStatus').textContent, 'No matching passages found.');
});

test('replacing a query cancels its worker and never displays stale results or progress', async () => {
  const h = harness(); h.search('old'); await h.flush();
  h.search('new'); await h.flush();
  assert.equal(h.cancellations, 1);
  assert.equal(h.requests.length, 1, 'wait for old worker before starting another');
  h.api.progress({ file: 1, total: 1, title: 'Old title' });
  assert.equal(h.el('documentSearchCurrent').textContent, '');
  h.requests[0].resolve({ results: [{ title: 'Old result' }], warnings: [] }); await h.flush();
  assert.equal(h.requests.length, 2);
  assert.equal(h.el('documentSearchResults').children.length, 0);
  h.requests[1].resolve({ results: [], warnings: [] }); await h.flush();
  assert.equal(h.el('documentSearchStatus').textContent, 'No matching passages found.');
});

test('clearing search hides passages and explicit cancellation stays cancelled', async () => {
  const h = harness(); h.search('anxiety'); await h.flush();
  h.search('');
  assert.equal(h.el('documentSearchSection').hidden, true);
  h.requests[0].resolve({ results: [], warnings: [] }); await h.flush();
  h.search('grief'); await h.flush();
  h.el('documentSearchCancel').events.click();
  h.requests[1].resolve({ results: [], warnings: [] }); await h.flush();
  assert.equal(h.el('documentSearchStatus').textContent, 'Document search cancelled.');
  assert.equal(h.el('documentSearchCancel').hidden, true);
});
