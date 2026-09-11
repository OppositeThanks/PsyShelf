const fs = require('node:fs/promises');
const path = require('node:path');

const LIMITS = { files: 30, bytes: 32 * 1024 * 1024, pages: 600, characters: 1000000, sources: 8 };
const stopwords = new Set('a an the of in on to for and or is are was were what how why does do can could tell me about please summarize summary this that it with from my library le la les de du des un une et en pour sur est sont que qui quoi comment dans mon ma mes pouvez vous expliquer el los las del y o una unos unas es son qué cómo por para con mi mis puedes explicar'.split(' '));
const normalize = text => String(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
function termsFor(query) { return [...new Set(normalize(query).match(/[\p{L}\p{N}]{2,}/gu) || [])].filter(word => !stopwords.has(word)).slice(0, 30); }
function score(text, terms) { const value = normalize(text); return terms.reduce((sum, term) => sum + (value.includes(term) ? 1 : 0), 0); }

async function extractDocument(filename) {
  const stat = await fs.stat(filename);
  if (!stat.isFile() || stat.size > LIMITS.bytes) return { pages: [], warning: 'File too large or unavailable.' };
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: new Uint8Array(await fs.readFile(filename)), isEvalSupported: false, useSystemFonts: true, verbosity: 0 });
    let pdf;
    try {
      pdf = await task.promise;
      const pages = [];
      let characters = 0;
      let empty = 0;
      for (let number = 1; number <= Math.min(pdf.numPages, LIMITS.pages) && characters < LIMITS.characters; number++) {
        const page = await pdf.getPage(number);
        const content = await page.getTextContent();
        const raw = content.items.map(item => item.str ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
        const text = raw.slice(0, LIMITS.characters - characters);
        characters += text.length;
        if (!text) empty++;
        pages.push({ page: number, text });
        page.cleanup();
      }
      return { pages, warning: pages.length < pdf.numPages || characters >= LIMITS.characters ? 'Document search was limited.' : empty ? 'Some PDF pages have no readable text. Scans need OCR.' : null };
    } finally { await task.destroy(); }
  }
  if (['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm'].includes(extension)) {
    const raw = await fs.readFile(filename, 'utf8');
    const text = raw.slice(0, LIMITS.characters).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
    return { pages: [{ page: null, text }], warning: raw.length > LIMITS.characters ? 'Document search was limited.' : null };
  }
  return { pages: [], warning: 'This file format is not searched yet.' };
}

// Retrieval is lexical. A source identifier is assigned only to text actually extracted locally.
async function retrieve(resources, query) {
  const terms = termsFor(query);
  const ranked = resources.map(resource => ({ resource, score: score([resource.title, resource.description, ...(resource.categories || [])].join(' '), terms) })).sort((a,b) => b.score - a.score);
  const candidates = [];
  const warnings = [];
  if (ranked.length > LIMITS.files) warnings.push({ title: '', message: 'Only the first 30 candidate resources were searched. Narrow your question if needed.' });
  for (const { resource, score: metadataScore } of ranked.slice(0, LIMITS.files)) {
    let extracted = { pages: [] };
    if (resource.filePath) {
      try { extracted = await extractDocument(resource.filePath); }
      catch { extracted = { pages: [], warning: 'File unreadable, missing, or password-protected.' }; }
      if (extracted.warning) warnings.push({ title: resource.title, message: extracted.warning });
    }
    let found = false;
    for (const page of extracted.pages) {
      // Overlapping passages retain enough surrounding context without exhausting the local model.
      for (let start = 0; start < page.text.length; start += 700) {
        const text = page.text.slice(start, start + 1000).trim();
        const relevance = score(text, terms);
        if (text && (relevance || metadataScore)) {
          found = true;
          candidates.push({ resourceId: resource.id, title: resource.title, page: page.page, kind: 'document', excerpt: text, score: relevance * 3 + metadataScore, offset: start });
        }
      }
    }
    if (!found && metadataScore) candidates.push({ resourceId: resource.id, title: resource.title, page: null, kind: 'catalog', excerpt: [resource.title, (resource.authors || []).join(', '), resource.description].filter(Boolean).join('\n').slice(0, 1000), score: metadataScore, offset: 0 });
  }
  const sources = [];
  const perResource = new Map();
  for (const candidate of candidates.sort((a,b) => b.score - a.score)) {
    if ((perResource.get(candidate.resourceId) || 0) >= 3) continue;
    if (sources.some(source => source.resourceId === candidate.resourceId && source.page === candidate.page && Math.abs(source.offset - candidate.offset) < 1000)) continue;
    perResource.set(candidate.resourceId, (perResource.get(candidate.resourceId) || 0) + 1);
    sources.push({ ...candidate, id: `S${sources.length + 1}` });
    if (sources.length === LIMITS.sources) break;
  }
  return { sources, warnings };
}

function validateAnswer(value, sources) {
  const known = new Set(sources.map(source => source.id));
  if (!value || !Array.isArray(value.claims) || !value.claims.length || value.claims.length > 8) return null;
  const claims = [];
  for (const claim of value.claims) {
    if (!claim || typeof claim.text !== 'string' || !claim.text.trim() || claim.text.length > 2000 || !Array.isArray(claim.sourceIds) || !claim.sourceIds.length || claim.sourceIds.some(id => !known.has(id))) return null;
    claims.push({ text: claim.text.trim(), sourceIds: [...new Set(claim.sourceIds)] });
  }
  return claims;
}
module.exports = { LIMITS, extractDocument, retrieve, validateAnswer, termsFor };
