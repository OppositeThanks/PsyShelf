const { extractDocument } = require('./source-evidence.cjs');
const { DocumentOCR } = require('./document-ocr.cjs');
const normalize = value => String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

async function searchDocuments(resources, query, { ocr = false, language = 'eng', progress = () => {}, cacheDir } = {}) {
  const terms = [...new Set(normalize(query).split(/\s+/).filter(Boolean))];
  if (!terms.length) return { results: [], warnings: [] };
  const engine = ocr ? new DocumentOCR(language) : null;
  const results = [], warnings = [];
  const files = resources.filter(resource => resource.filePath);
  try {
    outer: for (let index = 0; index < files.length; index++) {
      const resource = files[index];
      const report = page => progress({ file: index + 1, total: files.length, title: resource.title, page: page || null });
      report();
      let document;
      try { document = await require('./document-index.cjs').indexedDocument(resource.filePath, { ocr: engine, progress: report, cacheDir }, extractDocument); }
      catch { warnings.push({ title: resource.title, message: 'File unreadable, missing, or password-protected.' }); continue; }
      if (document.warning) warnings.push({ title: resource.title, message: document.warning });
      for (const page of document.pages) {
        for (let offset = 0; offset < page.text.length; offset += 650) {
          const excerpt = page.text.slice(offset, offset + 1000).trim();
          if (!terms.every(term => normalize(excerpt).includes(term))) continue;
          if (results.some(hit => hit.resourceId === resource.id && hit.page === page.page && Math.abs(hit.offset - offset) < 1000)) continue;
          if (results.length >= 100) { warnings.push({ title: '', message: 'Showing the first 100 passages. Narrow your search for more specific results.' }); break outer; }
          results.push({ resourceId: resource.id, title: resource.title, page: page.page, excerpt, ocr: Boolean(page.ocr), offset });
        }
      }
    }
    return { results, warnings };
  } finally { await engine?.close(); }
}
module.exports = { searchDocuments };
