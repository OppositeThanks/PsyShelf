const path = require('node:path');

const BUILT_IN = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.mov',
  '.txt', '.md', '.csv', '.json', '.html', '.htm', '.xml'
]);

const RECOMMENDATIONS = {
  office: {
    name: 'LibreOffice',
    reason: 'Free viewer and editor for Word, PowerPoint, Excel, and OpenDocument files.',
    url: 'https://www.libreoffice.org/download/download-libreoffice/'
  },
  ebook: {
    name: 'calibre',
    reason: 'Free reader and library manager for EPUB, MOBI, AZW, and many e-book formats.',
    url: 'https://calibre-ebook.com/download_windows'
  },
  media: {
    name: 'VLC media player',
    reason: 'Free player with broad support for audio and video formats.',
    url: 'https://www.videolan.org/vlc/'
  },
  archive: {
    name: '7-Zip',
    reason: 'Free tool for ZIP, 7Z, RAR, and other archive formats.',
    url: 'https://www.7-zip.org/download.html'
  },
  image: {
    name: 'GIMP',
    reason: 'Free editor and viewer for layered or specialist image formats.',
    url: 'https://www.gimp.org/downloads/'
  }
};

const RESOURCE_TYPES = [
  { type: 'Book / document', extensions: new Set(['.pdf', '.epub', '.mobi', '.azw', '.azw3', '.doc', '.docx', '.odt']) },
  { type: 'Video', extensions: new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv']) },
  { type: 'Audio / music', extensions: new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma']) },
  { type: 'Art / image', extensions: new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.psd', '.tif', '.tiff', '.bmp']) },
  { type: 'Presentation', extensions: new Set(['.ppt', '.pptx', '.odp']) },
  { type: 'Spreadsheet', extensions: new Set(['.xls', '.xlsx', '.ods', '.csv']) },
  { type: 'Web resource', extensions: new Set(['.html', '.htm', '.url']) }
];

const PREVIEW_TYPES = [
  { kind: 'image', extensions: new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']) },
  { kind: 'audio', extensions: new Set(['.mp3', '.wav', '.ogg', '.m4a']) },
  { kind: 'video', extensions: new Set(['.mp4', '.webm', '.mov']) },
  { kind: 'pdf', extensions: new Set(['.pdf']) },
  { kind: 'text', extensions: new Set(['.txt', '.md', '.csv', '.json', '.html', '.htm', '.xml']) }
];

const HELPER_GROUPS = [
  { recommendation: RECOMMENDATIONS.office, extensions: new Set(['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.odt', '.odp', '.ods', '.rtf']) },
  { recommendation: RECOMMENDATIONS.ebook, extensions: new Set(['.epub', '.mobi', '.azw', '.azw3', '.fb2']) },
  { recommendation: RECOMMENDATIONS.media, extensions: new Set(['.avi', '.mkv', '.wmv', '.flac', '.aac', '.wma']) },
  { recommendation: RECOMMENDATIONS.archive, extensions: new Set(['.zip', '.7z', '.rar', '.tar', '.gz']) },
  { recommendation: RECOMMENDATIONS.image, extensions: new Set(['.psd', '.xcf', '.tif', '.tiff', '.raw']) }
];

/** Returns a normalized lowercase extension for a filename. */
function extensionOf(filename = '') {
  return path.extname(filename).toLowerCase();
}

/** Normalizes comma-delimited or array values into unique non-empty strings. */
function normalizeList(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(items.map(item => String(item).trim()).filter(Boolean))];
}

/** Infers a broad library category without rejecting unknown formats. */
function inferResourceType(filename = '') {
  const extension = extensionOf(filename);
  return RESOURCE_TYPES.find(group => group.extensions.has(extension))?.type || 'Other';
}

/** Selects the built-in preview renderer for a filename. */
function previewKind(filename = '') {
  const extension = extensionOf(filename);
  return PREVIEW_TYPES.find(group => group.extensions.has(extension))?.kind || 'external';
}

/** Recommends either PsyShelf preview or a verified free helper application. */
function helperForExtension(filename = '') {
  const extension = extensionOf(filename);
  if (BUILT_IN.has(extension)) {
    return { builtIn: true, name: 'PsyShelf preview', reason: 'This format can be previewed inside PsyShelf.', url: null };
  }
  const helper = HELPER_GROUPS.find(group => group.extensions.has(extension));
  if (helper) return { builtIn: false, ...helper.recommendation };
  return {
    builtIn: false,
    name: 'Windows default application',
    reason: 'PsyShelf will ask Windows to open this format with an installed compatible application.',
    url: null
  };
}

/** Accepts only normalized HTTP or HTTPS URLs. */
function validateHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Converts a title into a Windows-safe filename component. */
function safeFilename(value) {
  return String(value || 'resource')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/[. ]+$/g, '')
    .slice(0, 120) || 'resource';
}

/** Ranks catalog resources by how many query terms they match. */
function searchResources(resources, query) {
  const terms = String(query || '').toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return resources;
  return resources
    .map(resource => {
      const haystack = [
        resource.title,
        ...(resource.authors || []),
        ...(resource.categories || []),
        ...(resource.languages || []),
        resource.description
      ].join(' ').toLocaleLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { resource, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.resource.title.localeCompare(b.resource.title))
    .map(item => item.resource);
}

module.exports = {
  helperForExtension,
  inferResourceType,
  normalizeList,
  previewKind,
  safeFilename,
  searchResources,
  validateHttpUrl
};
