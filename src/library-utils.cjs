const path = require('node:path');

const BUILT_IN = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.mov',
  '.txt', '.md', '.csv', '.json', '.html', '.htm', '.xml'
]);

const recommendations = {
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
function normalizeList(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(items.map(item => String(item).trim()).filter(Boolean))];
}

function inferResourceType(filename = '') {
  const ext = path.extname(filename).toLowerCase();
  if (['.pdf', '.epub', '.mobi', '.azw', '.azw3', '.doc', '.docx', '.odt'].includes(ext)) return 'Book / document';
  if (['.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv'].includes(ext)) return 'Video';
  if (['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma'].includes(ext)) return 'Audio / music';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.psd', '.tiff', '.bmp'].includes(ext)) return 'Art / image';
  if (['.ppt', '.pptx', '.odp'].includes(ext)) return 'Presentation';
  if (['.xls', '.xlsx', '.ods', '.csv'].includes(ext)) return 'Spreadsheet';
  if (['.html', '.htm', '.url'].includes(ext)) return 'Web resource';
  return 'Other';
}

function previewKind(filename = '') {
  const ext = path.extname(filename).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) return 'image';
  if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) return 'audio';
  if (['.mp4', '.webm', '.mov'].includes(ext)) return 'video';
  if (ext === '.pdf') return 'pdf';
  if (['.txt', '.md', '.csv', '.json', '.html', '.htm', '.xml'].includes(ext)) return 'text';
  return 'external';
}

function helperForExtension(filename = '') {
  const ext = path.extname(filename).toLowerCase();
  if (BUILT_IN.has(ext)) {
    return { builtIn: true, name: 'PsyShelf preview', reason: 'This format can be previewed inside PsyShelf.', url: null };
  }
  if (['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.odt', '.odp', '.ods', '.rtf'].includes(ext)) return { builtIn: false, ...recommendations.office };
  if (['.epub', '.mobi', '.azw', '.azw3', '.fb2'].includes(ext)) return { builtIn: false, ...recommendations.ebook };
  if (['.avi', '.mkv', '.wmv', '.flac', '.aac', '.wma'].includes(ext)) return { builtIn: false, ...recommendations.media };
  if (['.zip', '.7z', '.rar', '.tar', '.gz'].includes(ext)) return { builtIn: false, ...recommendations.archive };
  if (['.psd', '.xcf', '.tif', '.tiff', '.raw'].includes(ext)) return { builtIn: false, ...recommendations.image };
  return {
    builtIn: false,
    name: 'Windows default application',
    reason: 'PsyShelf will ask Windows to open this format with an installed compatible application.',
    url: null
  };
}

function validateHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function safeFilename(value) {
  return String(value || 'resource')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/[. ]+$/g, '')
    .slice(0, 120) || 'resource';
}

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
