const test = require('node:test');
const assert = require('node:assert/strict');
const {
  helperForExtension,
  inferResourceType,
  normalizeList,
  safeFilename,
  searchResources,
  validateHttpUrl
} = require('../src/library-utils.cjs');

test('normalizes and de-duplicates multi-value fields', () => {
  assert.deepEqual(normalizeList('English, Spanish, English'), ['English', 'Spanish']);
});
test('infers broad file categories without rejecting unknown formats', () => {
  assert.equal(inferResourceType('lecture.mkv'), 'Video');
  assert.equal(inferResourceType('notes.strange-format'), 'Other');
});

test('selects free helper applications for specialist formats', () => {
  assert.equal(helperForExtension('book.epub').name, 'calibre');
  assert.equal(helperForExtension('paper.docx').name, 'LibreOffice');
  assert.equal(helperForExtension('paper.pdf').builtIn, true);
});

test('validates shareable web links', () => {
  assert.equal(validateHttpUrl('javascript:alert(1)'), null);
  assert.match(validateHttpUrl('https://example.com/article'), /^https:/);
});

test('creates Windows-safe export names', () => {
  assert.equal(safeFilename('Title: question?'), 'Title- question-');
});

test('searches across title, author, categories and descriptions', () => {
  const result = searchResources([
    { title: 'A', authors: ['Frankl'], categories: ['Book'], languages: ['Spanish'], description: 'Logotherapy' },
    { title: 'B', authors: ['Other'], categories: ['Movie'], languages: ['English'], description: 'Emotion' }
  ], 'Frankl logotherapy');
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'A');
});
