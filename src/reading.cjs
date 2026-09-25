const statuses = ['to-read', 'reading', 'finished'];
function normalizeReading(input = {}, current = {}) {
  const value = key => input[key] === undefined ? current[key] : input[key];
  const readingStatus = value('readingStatus') || 'to-read';
  if (!statuses.includes(readingStatus)) throw new Error('Invalid reading details.');
  const page = raw => {
    const n = Number(raw || 1);
    if (!Number.isInteger(n) || n < 1 || n > 100000) throw new Error('Invalid source page.');
    return n;
  };
  const collections = value('collections') || [];
  const bookmarks = value('bookmarks') || [];
  const annotations = value('annotations') || [];
  if (!Array.isArray(collections) || collections.length > 100 || collections.some(v => typeof v !== 'string' || !v.trim() || v.length > 120) ||
      !Array.isArray(bookmarks) || bookmarks.length > 1000 || !Array.isArray(annotations) || annotations.length > 1000) throw new Error('Invalid reading details.');
  return {
    readingStatus, lastPage: page(value('lastPage')),
    collections: [...new Set(collections.map(v => v.trim()))],
    bookmarks: [...new Set(bookmarks.map(page))].sort((a,b) => a-b),
    annotations: annotations.map(item => {
      if (!item || typeof item.id !== 'string' || item.id.length > 100 || typeof item.quote !== 'string' || typeof item.note !== 'string' || item.quote.length > 10000 || item.note.length > 20000 || !(item.quote.trim() || item.note.trim())) throw new Error('Invalid reading details.');
      const result = { id: item.id, page: item.page === null ? null : page(item.page), quote: item.quote, note: item.note };
      if (item.textOffset !== undefined) {
        if (!Number.isInteger(item.textOffset) || item.textOffset < 0 || item.textOffset > 10000000) throw new Error('Invalid reading details.');
        result.textOffset = item.textOffset;
      }
      return result;
    })
  };
}
function annotationMarkdown(resource) {
  const reference = [resource.authors.join(', '), resource.publicationYear, resource.title, resource.url].filter(Boolean).join('. ');
  return `# ${resource.title}\n\n${reference}\n\n` + (resource.annotations || []).map(a =>
    `## ${a.page === null ? '—' : a.page}\n\n${a.quote.split('\n').map(line => '> ' + line).join('\n')}\n\n${a.note}\n`).join('\n');
}
module.exports = { normalizeReading, annotationMarkdown, statuses };
