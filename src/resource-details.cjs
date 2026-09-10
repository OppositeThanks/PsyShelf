function normalizeDetails(input = {}, current = {}) {
  const result = {};
  for (const field of ['publicationYear', 'rating']) {
    const raw = input[field] === undefined ? current[field] : input[field];
    const value = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    const max = field === 'rating' ? 5 : 9999;
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > max)) {
      throw new Error(field === 'rating' ? 'Rating must be a whole number from 1 to 5, or empty.' : 'Publication year must be a whole number from 1 to 9999, or empty.');
    }
    result[field] = value;
  }
  for (const field of ['clinicalTopic', 'theoreticalApproach', 'audience', 'personalNotes']) {
    result[field] = String(input[field] === undefined ? current[field] ?? '' : input[field] ?? '').trim();
  }
  return result;
}
module.exports = { normalizeDetails };
