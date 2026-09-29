const path = require('node:path');

const fields = ['title', 'authors', 'categories', 'languages', 'description', 'url',
  'publicationYear', 'clinicalTopic', 'theoreticalApproach', 'audience', 'rating'];

function shareMetadata(resource, { includeFile = false, includeNotes = false, sharedAt = new Date().toISOString() } = {}) {
  // An allowlist prevents future private fields from silently becoming public.
  const shared = {};
  for (const field of fields) if (resource[field] !== undefined && resource[field] !== null) shared[field] = structuredClone(resource[field]);
  if (includeNotes === true) shared.personalNotes = String(resource.personalNotes || '');
  shared.sharedAt = sharedAt;
  if (includeFile === true && resource.filePath) {
    const name = path.basename(resource.filePath);
    shared.attachment = name.toLowerCase() === 'resource.json' ? 'attachment-resource.json' : name;
  }
  return shared;
}

module.exports = { shareMetadata };
