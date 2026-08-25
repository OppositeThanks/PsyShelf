const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildChatMessages,
  parseStructuredResponse,
  validateCorrectionResponse,
  validateMetadataResponse
} = require('../src/agent-contracts.cjs');

const resource = {
  title: 'Existing title',
  authors: ['Existing author'],
  categories: ['Book'],
  languages: ['English'],
  description: 'Existing description.',
  filePath: 'private/path.pdf'
};

test('removes model thinking before parsing structured output', () => {
  assert.deepEqual(parseStructuredResponse('<think>private reasoning</think>{"decision":"accept","explanation":"Verified."}'), {
    decision: 'accept',
    explanation: 'Verified.'
  });
});

test('validates metadata and preserves trusted fallback fields', () => {
  const metadata = validateMetadataResponse(JSON.stringify({
    title: '',
    authors: ['New author', 'New author'],
    categories: [],
    languages: ['French'],
    description: 'Updated description.'
  }), resource);
  assert.equal(metadata.title, resource.title);
  assert.deepEqual(metadata.authors, ['New author']);
  assert.deepEqual(metadata.categories, resource.categories);
  assert.deepEqual(metadata.languages, ['French']);
});

test('rejects correction decisions outside the declared schema', () => {
  assert.throws(() => validateCorrectionResponse('{"decision":"maybe","explanation":"Unsure."}'), /invalid correction decision/);
});

test('limits chat context to catalog metadata', () => {
  const messages = buildChatMessages([resource], 'What is this about?');
  assert.doesNotMatch(messages[1].content, /private\/path/);
  assert.match(messages[1].content, /Existing title/);
});
