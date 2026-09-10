const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDetails } = require('../src/resource-details.cjs');
test('resource details support empty values, edits and preservation during unrelated updates', () => {
  const details = normalizeDetails({ publicationYear: '2020', rating: '4', personalNotes: ' Notes ' });
  assert.equal(details.publicationYear, 2020);
  assert.equal(details.rating, 4);
  assert.equal(details.personalNotes, 'Notes');
  assert.deepEqual(normalizeDetails({}, details), details);
  assert.equal(normalizeDetails({ rating: '' }, details).rating, null);
  assert.equal(normalizeDetails({ personalNotes: '' }, details).personalNotes, '');
});
test('invalid ratings and publication years are rejected', () => {
  for (const rating of [-1, 0, 6, 2.5, 'bad']) assert.throws(() => normalizeDetails({ rating }));
  for (const publicationYear of [0, -20, 2020.5, 10000, 'bad']) assert.throws(() => normalizeDetails({ publicationYear }));
});
